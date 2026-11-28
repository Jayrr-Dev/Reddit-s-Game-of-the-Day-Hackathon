import { getRequestListener } from '@hono/node-server';
import { Hono } from 'hono';
import type { Plugin } from 'vite';
import { defaultBuild, isPlayerBuild } from '../src/shared/game/playerBuild';
import { CONQUEST_VERSION } from '../src/shared/game/conquestAreas';
import { trainingRingProgress } from '../src/shared/game/character';
import { isCardId } from '../src/shared/game/cards';
import { shopOffers } from '../src/shared/game/ringShop';
import { computeScore, isRunAction, replayRun } from '../src/shared/game/run';
import { EMPTY_UNLOCKS } from '../src/shared/game/unlocks';
import type { FinishRunResponse, InitResponse, LeaderboardResponse, ProfileResponse, RingShopResponse, StartRunResponse } from '../src/shared/types/api';
import { getDailyKey } from '../src/shared/utils/dailyKey';

// --- LOCAL FIXTURES ---

const ACCOUNT = 'local-preview';
const STREAK = { current: 0, best: 0 };

/** Serve an isolated test profile while keeping production Devvit routes out of the preview. */
export function localPreview(): Plugin {
  const api = new Hono().basePath('/api');
  const day = getDailyKey();
  let profile: ProfileResponse = {
    build: defaultBuild(),
    wins: 0,
    gold: 1000,
    shopRings: [],
    carryCards: [],
    items: {},
    unlocks: EMPTY_UNLOCKS,
  };
  api.get('/init', c => c.json<InitResponse>({
    type: 'init',
    accountId: ACCOUNT,
    localPreview: true,
    postId: ACCOUNT,
    dailyKey: day,
    username: 'Local Preview',
    bestScoreToday: null,
    streak: STREAK,
    hasStartedRankedRun: false,
    isAdmin: true,
    unitOverrides: {},
    gold: profile.gold,
  }));
  api.get('/leaderboard', c => c.json<LeaderboardResponse>({ type: 'leaderboard', dailyKey: day, entries: [] }));
  api.get('/profile', c => c.json(profile));
  api.post('/profile', async c => {
    const build: unknown = await c.req.json();
    if (!isPlayerBuild(build)) return c.json({ status: 'error', message: 'Invalid character build.' }, 400);
    profile = { ...profile, build };
    return c.json({ saved: true });
  });
  api.get('/shop/rings', c => c.json<RingShopResponse>({
    offerDay: day,
    gold: profile.gold,
    offers: shopOffers(day, true),
    opened: [],
    collectedAll: false,
    carryCards: profile.carryCards,
    imbueBought: false,
    owned: profile.shopRings,
  }));
  api.post('/run/start', async c => {
    const data: unknown = await c.req.json();
    const carriedCards = data && typeof data === 'object' && 'bringCards' in data && Array.isArray(data.bringCards)
      ? data.bringCards.filter(isCardId) : [];
    return c.json<StartRunResponse>({
      type: 'runStart',
      isRanked: false,
      build: profile.build,
      profile: {
        id: crypto.randomUUID(),
        wins: profile.wins,
        cardRules: 1,
        progressionVersion: 2,
        conquestVersion: CONQUEST_VERSION,
        vigorVersion: 1,
        carriedCards,
      },
    });
  });
  api.post('/run/progress', c => c.json({ saved: true }));
  api.post('/run/finish', async c => {
    const data: unknown = await c.req.json();
    const actions = data && typeof data === 'object' && 'actions' in data && Array.isArray(data.actions)
      ? data.actions.filter(isRunAction) : [];
    const { stats } = replayRun(day, actions, trainingRingProgress(), 0, profile.wins, [], undefined, 1, undefined, false, CONQUEST_VERSION, 0);
    return c.json<FinishRunResponse>({
      type: 'runFinish',
      score: computeScore(stats),
      stats,
      isRanked: false,
      bestScoreToday: null,
      rank: null,
      streak: STREAK,
    });
  });
  api.post('/telemetry/*', c => c.json({}));
  api.all('*', c => c.json({ status: 'error', message: 'This action needs the Reddit playtest.' }, 501));

  const handle = getRequestListener(api.fetch, { overrideGlobalObjects: false });
  return {
    name: 'villain-run-local-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/') {
          res.writeHead(302, { Location: '/game.html' });
          return res.end();
        }
        if (req.url?.startsWith('/api/')) return void handle(req, res);
        next();
      });
    },
  };
}
