// ===================================================================
// STREAKS (PERSISTENCE)
// Loads and saves a player's streak record in a Redis hash. The rules
// for how a streak changes live in shared/utils/streak.ts; this file only
// moves data in and out of Redis.
// ===================================================================

import { redis } from '@devvit/web/server';
import type { StreakSummary } from '../../shared/types/api';
import {
  EMPTY_STREAK,
  advanceStreak,
  visibleStreak,
  type StreakRecord,
} from '../../shared/utils/streak';
import { isDailyKey } from '../../shared/utils/dailyKey';
import { redisKeys } from './redisKeys';

// --- HELPERS ---

/** Parses a Redis hash into a StreakRecord, treating bad data as empty. */
const parseStreakRecord = (hash: Record<string, string>): StreakRecord => {
  const current = Number(hash['current'] ?? 0);
  const best = Number(hash['best'] ?? 0);
  const lastPlayedKey = hash['lastPlayedKey'];

  if (!Number.isFinite(current) || !Number.isFinite(best)) return EMPTY_STREAK;
  return {
    current,
    best,
    lastPlayedKey: isDailyKey(lastPlayedKey) ? lastPlayedKey : null,
  };
};

/** Loads a player's stored streak record. */
const loadStreakRecord = async (userId: string): Promise<StreakRecord> =>
  parseStreakRecord(await redis.hGetAll(redisKeys.playerStreak(userId)));

// --- PUBLIC API ---

/** Returns the streak the player should see today, without changing it. */
export const getStreak = async (
  userId: string,
  todayKey: string
): Promise<StreakSummary> =>
  visibleStreak(await loadStreakRecord(userId), todayKey);

/** Marks the player as having played today and returns the updated streak. */
export const recordPlay = async (
  userId: string,
  todayKey: string
): Promise<StreakSummary> => {
  const next = advanceStreak(await loadStreakRecord(userId), todayKey);

  await redis.hSet(redisKeys.playerStreak(userId), {
    current: String(next.current),
    best: String(next.best),
    lastPlayedKey: next.lastPlayedKey ?? '',
  });
  return visibleStreak(next, todayKey);
};
