// ===================================================================
// PUBLIC API ROUTES (/api/*)
// Called by the React client inside the post. Each handler validates
// input, delegates to core/ modules, and returns a typed response.
// ===================================================================

import { defaultBuild, isPlayerBuild } from '../../shared/game/playerBuild';
import { CONQUEST_VERSION, isConquestVersion } from '../../shared/game/conquestAreas';
import { randomUUID } from 'node:crypto';
import { redisKeys } from '../core/redisKeys';
import { discardPlayerItem, getItems, offerApple, recordAppleFinds, spendPlayerItem } from '../core/playerItems';
import { isItemId, isShopApple, SHOP_APPLE } from '../../shared/game/items';
import { Hono } from 'hono';
import { context, reddit, redis } from '@devvit/web/server';
import { replayForScore, replayForScoreAndUnlocks } from '../../shared/game/replayForScore';
import { getUnlocks, recordUnlocks } from '../core/playerUnlocks';
import { isCardId } from '../../shared/game/cards';
import { isStarterName, starterDeck } from '../../shared/game/starters';
import { isCarryCardId, isCarrySelection, isCarriedDeck, isShopStockKey, isTestCarryCardId } from '../../shared/game/carryCards';
import { updatePlayerAlbum } from '../core/playerRingShop';
import { bankHellCard, bindRunItems, creditPandoraBounty, currentShopStock, recordShopBossClear, buyRing, getAdminRingShop, getRingShop, offerAdminShopFruit, openAdminRingShop, readPlayerProgress, recordVictories } from '../core/playerRingShop';
import { isPandoraRunEffect } from '../../shared/game/pandora';
import { isShopOfferId, shopRingIds } from '../../shared/game/ringShop';
import { appleAtVictory, goldRewardFor, scoreForVictory } from '../../shared/game/gold';
import { MAX_RUN_ACTIONS } from '../../shared/game/rules';
import {
  computeScore,
  isRunAction,
  isRunOver,
} from '../../shared/game/run';
import type {
  BuyRingResponse,
  RingShopResponse,
  FinishRunRequest,
  FinishRunResponse,
  InitResponse,
  LeaderboardResponse,
  ProfileResponse,
  SaveUnitStatsRequest,
  SaveUnitStatsResponse,
  StartRunResponse,
  RunProfile,
  UseItemRequest,
  UseItemResponse,
  DiscardItemResponse,
} from '../../shared/types/api';
import { getDailyKey } from '../../shared/utils/dailyKey';
import { getCurrentPostDailyKey } from '../core/dailyPost';
import {
  getBestScore,
  getRank,
  getTopScores,
  recordScore,
} from '../core/leaderboard';
import { beginRun, completeRun, hasStartedRankedRun } from '../core/rankedRun';
import { getStreak, recordPlay } from '../core/streaks';
import { jsonError, toErrorMessage } from '../http/errors';
import { isAdminUsername, isCurrentUserAdmin } from '../core/admins';
import { activateUnitOverrides, saveUnitOverride } from '../core/unitOverrides';
import { HEROES } from '../../shared/game/heroes';
import { getUnitOverrides, isUnitStatOverride } from '../../shared/game/unitOverrides';

export const api = new Hono();

// --- MIDDLEWARE ---
// Every request runs the shared rules with the admin's current unit
// stats, so a run replay scores with the numbers the player fought.
api.use('*', async (_c, next) => {
  await activateUnitOverrides();
  await next();
});

// --- HELPERS ---

/** True when the body holds a bounded list of well-formed run actions. */
const isFinishRunRequest = (body: unknown): body is FinishRunRequest =>
  typeof body === 'object' &&
  body !== null &&
  (!('runId' in body) || (typeof body.runId === 'string' && /^[a-f0-9-]{36}$/.test(body.runId))) &&
  'actions' in body &&
  Array.isArray(body.actions) &&
  body.actions.length <= MAX_RUN_ACTIONS &&
  body.actions.every((action: unknown) => isRunAction(action));

/** True when the body names a catalog hero and a valid override or null. */
const isSaveUnitStatsRequest = (body: unknown): body is SaveUnitStatsRequest =>
  typeof body === 'object' &&
  body !== null &&
  'heroId' in body &&
  typeof body.heroId === 'string' &&
  Object.hasOwn(HEROES, body.heroId) &&
  'override' in body &&
  (body.override === null || isUnitStatOverride(body.override));

/** Saves a ranked score and returns the player's best and rank. */
const recordRankedScore = async (
  dailyKey: string,
  username: string,
  score: number
) => {
  const bestScoreToday = await recordScore(dailyKey, username, score);
  const rank = await getRank(dailyKey, username);
  return { bestScoreToday, rank };
};

async function getBuild(id:string) {
  const raw = await redis.get(redisKeys.playerBuild(id));
  const data:unknown = raw ? JSON.parse(raw) : null;
  return isPlayerBuild(data) ? data : defaultBuild();
}

api.get('/profile',async c => {
  const id=context.userId;
  if(!id)return jsonError(c,401,'Sign in to load your profile');
  const visit = c.req.query('testVisit');
  const adminAlbum = c.req.query('album') === '1' && await isCurrentUserAdmin() ? (isShopVisitId(visit) ? { visit } : {}) : undefined;
  const [build, progress, items, unlocks] = await Promise.all([getBuild(id), readPlayerProgress(id, adminAlbum), getItems(id), getUnlocks(id)]);
  return c.json<ProfileResponse>({ build, ...progress, items, unlocks });
});
const isShopVisitId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);

api.get('/shop/rings', async c => {
  const id = context.userId;
  if (!id) return jsonError(c, 401, 'Sign in to enter the jewelry shop');
  c.header('Cache-Control', 'private, no-store');
  const day = await currentShopStock(id);
  const admin = await isCurrentUserAdmin();
  if (!admin) return c.json<RingShopResponse>(await getRingShop(id, day));
  const visit = c.req.query('testVisit');
  if (visit === undefined) return c.json<RingShopResponse>(await openAdminRingShop(id, day));
  if (!isShopVisitId(visit)) return jsonError(c, 400, 'Invalid shop test visit');
  return c.json<RingShopResponse>(await getAdminRingShop(id, day, visit));
});
api.post('/shop/apple', async c => {
  const id = context.userId;
  if (!id) return jsonError(c, 401, 'Sign in to offer an Apple');
  const body: unknown = await c.req.json().catch(() => null);
  const choice = body && typeof body === 'object' && 'itemId' in body ? body.itemId : SHOP_APPLE;
  if (!isShopApple(choice)) return jsonError(c, 400, 'Choose an Apple or a Realm Apple.');
  const testVisit = body && typeof body === 'object' && 'testVisit' in body ? body.testVisit : undefined;
  const admin = await isCurrentUserAdmin();
  if (admin) {
    if (!isShopVisitId(testVisit)) return jsonError(c, 400, 'Reopen the Shop to start a test visit.');
    const shop = await offerAdminShopFruit(id, testVisit, choice);
    if (!shop) return jsonError(c, 400, 'Test fruit is gone or the visit expired. Reopen the Shop.');
    return c.json({ items: shop.testItems ?? {}, shop });
  }
  if (testVisit !== undefined) return jsonError(c, 403, 'Test shop is for admins only.');
  const items = await offerApple(id, choice);
  if (!items) return jsonError(c, 400, 'You do not have an Apple for Metatron.');
  return c.json({ items });
});
api.post('/shop/rings/buy', async c => {
  const id = context.userId;
  if (!id) return jsonError(c, 401, 'Sign in to buy jewelry');
  const body: unknown = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || !('ringId' in body) || !isShopOfferId(body.ringId) ||
    !('offerDay' in body) || !isShopStockKey(body.offerDay))
    return jsonError(c, 400, 'Invalid jewelry offer');
  const visit = 'testVisit' in body ? body.testVisit : undefined;
  if (visit !== undefined && !isShopVisitId(visit))
    return jsonError(c, 400, 'Invalid shop test visit');
  const expectedFree = 'expectedFree' in body && body.expectedFree === true;
  return c.json<BuyRingResponse>(await buyRing(id, await currentShopStock(id), body.offerDay, body.ringId, await isCurrentUserAdmin(), visit, expectedFree));
});
api.post('/profile',async c => {
  const id=context.userId;
  if(!id)return jsonError(c,401,'Sign in to save your profile');
  const build:unknown=await c.req.json();
  if(!isPlayerBuild(build))return jsonError(c,400,'Invalid character or starter deck');
  await redis.set(redisKeys.playerBuild(id),JSON.stringify(build));
  return c.json({saved:true});
});
// --- POST /api/profile/use-item ---
// Spends one item from the player's bag; admins (checked here) spend none.
api.post('/profile/use-item', async (c) => {
  const id = context.userId;
  if (!id) return jsonError(c, 401, 'Sign in to use items');
  const { itemId } = await c.req.json<Partial<UseItemRequest>>();
  if (!isItemId(itemId)) return jsonError(c, 400, 'Unknown item');
  if (isShopApple(itemId)) return jsonError(c, 400, 'Offer the Apple at Metatron’s shop.');
  const result = await spendPlayerItem(id, itemId, await isCurrentUserAdmin());
  if (!result) return jsonError(c, 400, 'You have none of that item');
  return c.json<UseItemResponse>(result);
});
// --- POST /api/profile/discard-item ---
// The Inventory trash: destroys every copy of one item in the player's bag.
api.post('/profile/discard-item', async (c) => {
  const id = context.userId;
  if (!id) return jsonError(c, 401, 'Sign in to trash items');
  const { itemId } = await c.req.json<Partial<UseItemRequest>>();
  if (!isItemId(itemId)) return jsonError(c, 400, 'Unknown item');
  return c.json<DiscardItemResponse>({ items: await discardPlayerItem(id, itemId) });
});
// --- POST /api/profile/album ---
api.post('/profile/album', async (c) => {
  const id = context.userId;
  if (!id) return jsonError(c, 401, 'Sign in to edit your Album');
  const action: unknown = await c.req.json().catch(() => null);
  if (!action || typeof action !== 'object' || !('id' in action) || !('type' in action) ||
    !isCarryCardId(action.id)) return jsonError(c, 400, 'Invalid Album card');
  if ('testVisit' in action) return jsonError(c, 400, 'Edit your cards in the Album');
  if (isTestCarryCardId(action.id)) return jsonError(c, 400, 'Invalid Album card');
  const selection = action.type === 'trash' ? { type: 'trash' as const, id: action.id }
    : action.type === 'swap' && 'with' in action && isCarryCardId(action.with) && !isTestCarryCardId(action.with)
      ? { type: 'swap' as const, id: action.id, with: action.with } : undefined;
  if (!selection) return jsonError(c, 400, 'Invalid Album action');
  const carryCards = await updatePlayerAlbum(id, selection);
  return carryCards ? c.json({ carryCards }) : jsonError(c, 400, 'Those cards are no longer in those slots');
});

// --- GET /api/init ---
// Everything the game needs on first paint: day, player, best score, streak.
api.get('/init', async (c) => {
  const { postId, userId } = context;
  if (!postId) return jsonError(c, 400, 'postId is missing from context');

  try {
    const dailyKey = getCurrentPostDailyKey();
    const username = (await reddit.getCurrentUsername()) ?? null;
    const [bestScoreToday, streak, startedRanked, progress] = await Promise.all([
      username ? getBestScore(dailyKey, username) : null,
      userId ? getStreak(userId, getDailyKey()) : { current: 0, best: 0 },
      userId ? hasStartedRankedRun(dailyKey, userId) : false,
      userId ? readPlayerProgress(userId) : { wins: 0, xpStartWins: 0, bonusXp: 0, gold: 0 },
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId,
      dailyKey,
      appVersion: context.appVersion,
      username,
      ...(userId && { accountId: userId, lifetimeWins: progress.wins, xpStartWins: progress.xpStartWins, bonusXp: progress.bonusXp, gold: progress.gold }),
      ...('pandoraFreeDay' in progress && progress.pandoraFreeDay && { pandoraFreeDay: progress.pandoraFreeDay }),
      bestScoreToday,
      streak,
      hasStartedRankedRun: startedRanked,
      isAdmin: isAdminUsername(username),
      // The middleware already loaded them for this request.
      unitOverrides: getUnitOverrides(),
    });
  } catch (error) {
    console.error('api/init failed', error);
    return jsonError(c, 500, toErrorMessage(error));
  }
});

// --- POST /api/run/start ---
// Marks the day's ranked run as begun. Logged-out players only practice.
api.post('/run/start', async (c) => {
  const { userId } = context;
  try {
    if (!userId) return c.json<StartRunResponse>({ type: 'runStart', isRanked: false });
    const body: unknown = await c.req.json().catch(() => null);
    const candidate = body && typeof body === 'object' && 'testVisit' in body ? body.testVisit : undefined;
    const testVisit = isShopVisitId(candidate) && await isCurrentUserAdmin() ? candidate : undefined;
    const day = getCurrentPostDailyKey();
    const [{ wins, xpStartWins, bonusXp, shopRings }, build] = await Promise.all([readPlayerProgress(userId), getBuild(userId)]);
    const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const requested = record.bringCards ?? (record.bringCard === undefined ? [] : [record.bringCard]);
    if (!isCarrySelection(requested)) return jsonError(c, 400, 'Invalid card selection');
    if (record.starter !== undefined && !isStarterName(record.starter)) return jsonError(c, 400, 'Invalid starter deck');
    const starter = isStarterName(record.starter) ? record.starter : build.selected;
    const deck = build.decks[starter] ?? starterDeck(starter);
    const profile: RunProfile = { id: randomUUID(), wins, xpStartWins, bonusXp, shopRings, cardRules: 1, progressionVersion: 2, conquestVersion: CONQUEST_VERSION, vigorVersion: 1 };
    const withItems = await bindRunItems(userId, day, profile, testVisit, requested, deck)
      ?? (testVisit && !requested.length ? await bindRunItems(userId, day, profile, undefined, requested, deck) : undefined);
    if (withItems) return c.json<StartRunResponse>({ type: 'runStart', isRanked: false, profile: withItems, build });
    if (requested.length) return jsonError(c, 400, 'One or more packed cards are unavailable or do not fit this deck. Pick again.');
    const isRanked = await beginRun(day, userId);
    await redis.set(redisKeys.runBaseline(userId, day, profile.id), JSON.stringify(profile));
    return c.json<StartRunResponse>({ type: 'runStart', isRanked, profile, build });
  } catch (error) {
    console.error('api/run/start failed', error);
    return jsonError(c, 500, toErrorMessage(error));
  }
});

async function verifyProgress(day: string, body: FinishRunRequest, userId: string | undefined) {
  if (!body.runId) return replayForScore(day, body.actions);
  if (!userId) return null;
  const baseline = await redis.get(redisKeys.runBaseline(userId, day, body.runId));
  if (baseline == null) return null;
  // One replay both verifies the run and finds what it unlocked.
  const saved: unknown = JSON.parse(baseline);
  const wins = typeof saved === 'number' ? saved :
    saved && typeof saved === 'object' && 'wins' in saved && typeof saved.wins === 'number' ? saved.wins : 0;
  const shopRings = saved && typeof saved === 'object' && 'shopRings' in saved ? shopRingIds(saved.shopRings) : [];
  const effect = saved && typeof saved === 'object' && 'pandoraEffect' in saved && isPandoraRunEffect(saved.pandoraEffect) ? saved.pandoraEffect : undefined;
  const testVisit = saved && typeof saved === 'object' && 'testVisit' in saved && isShopVisitId(saved.testVisit) ? saved.testVisit : undefined;
  const cardRules = saved && typeof saved === 'object' && 'cardRules' in saved && saved.cardRules === 1 ? 1 as const : undefined;
  const carried = saved && typeof saved === 'object' && 'carriedCards' in saved && isCarriedDeck(saved.carriedCards) ? saved.carriedCards : saved && typeof saved === 'object' && 'carriedCard' in saved && isCardId(saved.carriedCard) ? saved.carriedCard : undefined;
  const legacyProgression = !(saved && typeof saved === 'object' && 'progressionVersion' in saved && saved.progressionVersion === 2);
  const conquestVersion = saved && typeof saved === 'object' && 'conquestVersion' in saved && isConquestVersion(saved.conquestVersion) ? saved.conquestVersion : undefined;
  const xpStartWins = saved && typeof saved === 'object' && 'xpStartWins' in saved &&
    typeof saved.xpStartWins === 'number' && Number.isSafeInteger(saved.xpStartWins) && saved.xpStartWins >= 0 ? saved.xpStartWins : undefined;
  const legacyVigor = !(saved && typeof saved === 'object' && 'vigorVersion' in saved && saved.vigorVersion === 1);
  const bonusXp = saved && typeof saved === 'object' && 'bonusXp' in saved &&
    typeof saved.bonusXp === 'number' && Number.isSafeInteger(saved.bonusXp) && saved.bonusXp >= 0 ? saved.bonusXp : 0;
  const { state: run, unlocks } = replayForScoreAndUnlocks(day, body.actions, wins, shopRings, effect, cardRules, carried, legacyProgression, conquestVersion, xpStartWins, legacyVigor, bonusXp);
  if (run.phase.kind === 'fallen' && run.phase.battlefield && run.promisedToGreed) await bankHellCard(userId, body.runId, run.promisedToGreed, testVisit);
  if (effect === 'half-life' && run.goldVictories.length > 0) await creditPandoraBounty(userId, body.runId, testVisit);
  if (testVisit) return run;
  const runId = body.runId;
  await recordAppleFinds(userId, run.goldVictories.flatMap(victory => {
    const item = appleAtVictory(runId, victory.stop, victory.encounter, victory.battle);
    return item ? [{ id: runId + ':' + victory.stop + (victory.battle ? ':' + victory.battle : ''), item }] : [];
  }));
  await recordUnlocks(userId, unlocks);
  const awards = run.goldVictories.map(({ stop, encounter, battle, waves, pushes }, index) => ({
    member: runId + ':' + index, score: scoreForVictory(goldRewardFor(runId, stop, encounter, effect, battle, waves, pushes), waves)
  }));
  await recordVictories(userId, awards);
  return run;
}
api.post('/run/progress', async (c) => {
  const body: unknown = await c.req.json();
  if (!isFinishRunRequest(body) || !body.runId) return jsonError(c, 400, 'Invalid progress log');
  const run = await verifyProgress(getCurrentPostDailyKey(), body, context.userId);
  return run ? c.json({ saved: true }) : jsonError(c, 400, 'Unknown run');
});

// --- POST /api/run/finish ---
// Replays the action log with the shared engine, so the score on the board
// is the score the rules produce, not a number the client claims.
api.post('/run/finish', async (c) => {
  const { userId } = context;
  const body: unknown = await c.req.json();
  if (!isFinishRunRequest(body)) return jsonError(c, 400, 'Invalid run log');

  try {
    const dailyKey = getCurrentPostDailyKey();
    const finalState = await verifyProgress(dailyKey, body, userId);
    if (!finalState) return jsonError(c, 400, 'Unknown run');
    if (!isRunOver(finalState)) return jsonError(c, 400, 'Run is not over');

    const score = computeScore(finalState.stats);
    const username = await reddit.getCurrentUsername();
    if (!userId || !username) return jsonError(c, 401, 'Log in to save scores');
    if (body.runId && finalState.goldVictories.some(win => win.encounter === 'champion'))
      await recordShopBossClear(userId, body.runId);

    const isRanked = !finalState.pandoraEffect && !finalState.carriedCards?.length && await completeRun(dailyKey, userId);
    const [board, streak] = await Promise.all([
      isRanked
        ? recordRankedScore(dailyKey, username, score)
        : getBestScore(dailyKey, username).then((best) => ({
            bestScoreToday: best,
            rank: null,
          })),
      // Streaks count real days played, so they use today's key, not the post's.
      recordPlay(userId, getDailyKey()),
    ]);

    return c.json<FinishRunResponse>({
      type: 'runFinish',
      score,
      stats: finalState.stats,
      isRanked,
      bestScoreToday: board.bestScoreToday,
      rank: board.rank ?? (await getRank(dailyKey, username)),
      streak,
    });
  } catch (error) {
    console.error('api/run/finish failed', error);
    return jsonError(c, 500, toErrorMessage(error));
  }
});

// --- POST /api/admin/unit-stats ---
// Admin only: the server checks the viewer's username itself, so a
// non-admin calling this directly is refused.
api.post('/admin/unit-stats', async (c) => {
  if (!(await isCurrentUserAdmin())) return jsonError(c, 403, 'Admins only');
  const body: unknown = await c.req.json();
  if (!isSaveUnitStatsRequest(body)) return jsonError(c, 400, 'Invalid unit stats');
  try {
    const unitOverrides = await saveUnitOverride(body.heroId, body.override);
    return c.json<SaveUnitStatsResponse>({ type: 'unitStats', unitOverrides });
  } catch (error) {
    console.error('api/admin/unit-stats failed', error);
    return jsonError(c, 500, toErrorMessage(error));
  }
});

// --- GET /api/leaderboard ---
api.get('/leaderboard', async (c) => {
  try {
    const dailyKey = getCurrentPostDailyKey();
    const entries = await getTopScores(dailyKey);
    return c.json<LeaderboardResponse>({
      type: 'leaderboard',
      dailyKey,
      entries,
    });
  } catch (error) {
    console.error('api/leaderboard failed', error);
    return jsonError(c, 500, toErrorMessage(error));
  }
});
