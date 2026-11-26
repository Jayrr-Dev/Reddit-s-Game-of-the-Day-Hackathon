// ===================================================================
// PUBLIC API ROUTES (/api/*)
// Called by the React client inside the post. Each handler validates
// input, delegates to core/ modules, and returns a typed response.
// ===================================================================

import { defaultBuild, isPlayerBuild } from '../../shared/game/playerBuild';
import { randomUUID } from 'node:crypto';
import { redisKeys } from '../core/redisKeys';
import { discardPlayerItem, getItems, spendPlayerItem } from '../core/playerItems';
import { isItemId } from '../../shared/game/items';
import { Hono } from 'hono';
import { context, reddit, redis } from '@devvit/web/server';
import { replayForScore } from '../../shared/game/replayForScore';
import { MAX_RUN_ACTIONS } from '../../shared/game/rules';
import {
  computeScore,
  isRunAction,
  isRunOver,
} from '../../shared/game/run';
import type {
  FinishRunRequest,
  FinishRunResponse,
  InitResponse,
  LeaderboardResponse,
  ProfileResponse,
  SaveUnitStatsRequest,
  SaveUnitStatsResponse,
  StartRunResponse,
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
  const [build,wins,items]=await Promise.all([getBuild(id),redis.zCard(redisKeys.victories(id)),getItems(id)]);
  return c.json<ProfileResponse>({build,wins,items});
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
// --- GET /api/init ---
// Everything the game needs on first paint: day, player, best score, streak.
api.get('/init', async (c) => {
  const { postId, userId } = context;
  if (!postId) return jsonError(c, 400, 'postId is missing from context');

  try {
    const dailyKey = getCurrentPostDailyKey();
    const username = (await reddit.getCurrentUsername()) ?? null;
    const [bestScoreToday, streak, startedRanked] = await Promise.all([
      username ? getBestScore(dailyKey, username) : null,
      userId ? getStreak(userId, getDailyKey()) : { current: 0, best: 0 },
      userId ? hasStartedRankedRun(dailyKey, userId) : false,
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId,
      dailyKey,
      username,
      ...(userId && { accountId: userId, lifetimeWins: await redis.zCard(redisKeys.victories(userId)) }),
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
    const isRanked = userId
      ? await beginRun(getCurrentPostDailyKey(), userId)
      : false;
    if (!userId) return c.json<StartRunResponse>({ type: 'runStart', isRanked });
    const profile = { id: randomUUID(), wins: await redis.zCard(redisKeys.victories(userId)) };
    await redis.set(redisKeys.runBaseline(userId, getCurrentPostDailyKey(), profile.id), String(profile.wins));
    return c.json<StartRunResponse>({ type: 'runStart', isRanked, profile, build: await getBuild(userId) });
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
  const run = replayForScore(day, body.actions, Number(baseline));
  const awards = Array.from({ length: run.stats.wavesCleared }, (_, index) => ({
    member: body.runId + ':' + index, score: index
  }));
  if (awards.length) await redis.zAdd(redisKeys.victories(userId), ...awards);
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

    const isRanked = await completeRun(dailyKey, userId);
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
