// ===================================================================
// LEADERBOARD
// Daily leaderboard stored as a Redis sorted set (member = username,
// score = best score that day). Sorted sets keep ranking on the Redis
// side, so reading the top N is one call regardless of player count.
// ===================================================================

import { redis } from '@devvit/web/server';
import {
  DAILY_DATA_TTL_DAYS,
  LEADERBOARD_SIZE,
} from '../../shared/constants/game';
import type { LeaderboardEntry } from '../../shared/types/api';
import { redisKeys } from './redisKeys';

// --- CONSTANTS ---
const SECONDS_PER_DAY = 24 * 60 * 60;

// --- FUNCTIONS ---

/** Returns the player's best score for the day, or null if they haven't played. */
export const getBestScore = async (
  dailyKey: string,
  username: string
): Promise<number | null> => {
  const score = await redis.zScore(
    redisKeys.dailyLeaderboard(dailyKey),
    username
  );
  return score ?? null;
};

/**
 * Records a score and keeps only the player's best for the day.
 * Returns the best score after the update.
 */
export const recordScore = async (
  dailyKey: string,
  username: string,
  score: number
): Promise<number> => {
  const key = redisKeys.dailyLeaderboard(dailyKey);
  const previousBest = await getBestScore(dailyKey, username);
  const isNewBest = previousBest === null || score > previousBest;

  if (isNewBest) {
    await redis.zAdd(key, { member: username, score });
    await redis.expire(key, DAILY_DATA_TTL_DAYS * SECONDS_PER_DAY);
  }
  return isNewBest ? score : previousBest;
};

/** Returns the player's 1-based rank for the day (highest score = 1), or null. */
export const getRank = async (
  dailyKey: string,
  username: string
): Promise<number | null> => {
  const key = redisKeys.dailyLeaderboard(dailyKey);
  const [ascendingRank, total] = await Promise.all([
    redis.zRank(key, username),
    redis.zCard(key),
  ]);
  // zRank counts from the lowest score; flip it so the top score is rank 1.
  return ascendingRank === undefined ? null : total - ascendingRank;
};

/** Returns the top entries for the day, highest score first. */
export const getTopScores = async (
  dailyKey: string
): Promise<LeaderboardEntry[]> => {
  const rows = await redis.zRange(
    redisKeys.dailyLeaderboard(dailyKey),
    0,
    LEADERBOARD_SIZE - 1,
    { by: 'rank', reverse: true }
  );
  return rows.map((row, index) => ({
    rank: index + 1,
    username: row.member,
    score: row.score,
  }));
};
