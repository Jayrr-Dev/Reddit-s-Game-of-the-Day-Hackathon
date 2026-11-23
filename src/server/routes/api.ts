// ===================================================================
// PUBLIC API ROUTES (/api/*)
// Called by the React client inside the post. Each handler validates
// input, delegates to core/ modules, and returns a typed response.
// ===================================================================

import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import { MAX_RUN_ACTIONS } from '../../shared/game/rules';
import {
  computeScore,
  isRunAction,
  isRunOver,
  replayRun,
  type RunAction,
} from '../../shared/game/run';
import type {
  FinishRunRequest,
  FinishRunResponse,
  InitResponse,
  LeaderboardResponse,
  StartRunResponse,
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

export const api = new Hono();

// --- HELPERS ---

/** True when the body holds a bounded list of well-formed run actions. */
const isFinishRunRequest = (body: unknown): body is FinishRunRequest =>
  typeof body === 'object' &&
  body !== null &&
  'actions' in body &&
  Array.isArray(body.actions) &&
  body.actions.length <= MAX_RUN_ACTIONS &&
  body.actions.every((action: unknown) => isRunAction(action));

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
      bestScoreToday,
      streak,
      hasStartedRankedRun: startedRanked,
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
    return c.json<StartRunResponse>({ type: 'runStart', isRanked });
  } catch (error) {
    console.error('api/run/start failed', error);
    return jsonError(c, 500, toErrorMessage(error));
  }
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
    const actions: RunAction[] = body.actions;
    const finalState = replayRun(dailyKey, actions);
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
