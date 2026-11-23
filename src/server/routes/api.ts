// ===================================================================
// PUBLIC API ROUTES (/api/*)
// Called by the React client inside the post. Each handler validates
// input, delegates to core/ modules, and returns a typed response.
// ===================================================================

import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  InitResponse,
  LeaderboardResponse,
  SubmitScoreRequest,
  SubmitScoreResponse,
} from '../../shared/types/api';
import { getDailyKey } from '../../shared/utils/dailyKey';
import { getCurrentPostDailyKey } from '../core/dailyPost';
import {
  getBestScore,
  getRank,
  getTopScores,
  recordScore,
} from '../core/leaderboard';
import { getStreak, recordPlay } from '../core/streaks';
import { jsonError, toErrorMessage } from '../http/errors';

export const api = new Hono();

// --- HELPERS ---

/** True when the request body holds a finite, non-negative score. */
const isValidScoreRequest = (body: unknown): body is SubmitScoreRequest =>
  typeof body === 'object' &&
  body !== null &&
  'score' in body &&
  typeof body.score === 'number' &&
  Number.isFinite(body.score) &&
  body.score >= 0;

// --- GET /api/init ---
// Everything the game needs on first paint: day, player, best score, streak.
api.get('/init', async (c) => {
  const { postId, userId } = context;
  if (!postId) return jsonError(c, 400, 'postId is missing from context');

  try {
    const dailyKey = getCurrentPostDailyKey();
    const username = (await reddit.getCurrentUsername()) ?? null;
    const [bestScoreToday, streak] = await Promise.all([
      username ? getBestScore(dailyKey, username) : null,
      userId ? getStreak(userId, getDailyKey()) : { current: 0, best: 0 },
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId,
      dailyKey,
      username,
      bestScoreToday,
      streak,
    });
  } catch (error) {
    console.error('api/init failed', error);
    return jsonError(c, 500, toErrorMessage(error));
  }
});

// --- POST /api/score ---
// Saves a finished run. Logged-out players can play but cannot post scores.
api.post('/score', async (c) => {
  const { userId } = context;
  const body: unknown = await c.req.json();
  if (!isValidScoreRequest(body)) return jsonError(c, 400, 'Invalid score');

  try {
    const username = await reddit.getCurrentUsername();
    if (!userId || !username) return jsonError(c, 401, 'Log in to save scores');

    const dailyKey = getCurrentPostDailyKey();
    const bestScoreToday = await recordScore(dailyKey, username, body.score);
    // Streaks count real days played, so they use today's key, not the post's.
    const [rank, streak] = await Promise.all([
      getRank(dailyKey, username),
      recordPlay(userId, getDailyKey()),
    ]);

    return c.json<SubmitScoreResponse>({
      type: 'score',
      bestScoreToday,
      rank,
      streak,
    });
  } catch (error) {
    console.error('api/score failed', error);
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
