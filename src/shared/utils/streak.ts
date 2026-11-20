// ===================================================================
// STREAK RULES
// Pure functions that decide how a player's streak changes when they
// play. Kept free of Redis so the rules are unit-testable.
// ===================================================================

import type { StreakSummary } from '../types/api.ts';
import { shiftDailyKey } from './dailyKey.ts';

// --- TYPES ---
/** What we persist per player to compute streaks. */
export type StreakRecord = StreakSummary & {
  lastPlayedKey: string | null;
};

export const EMPTY_STREAK: StreakRecord = {
  current: 0,
  best: 0,
  lastPlayedKey: null,
};

// --- FUNCTIONS ---

/**
 * Returns the streak after the player plays on `todayKey`.
 * - Same day again: unchanged (replays don't inflate the streak).
 * - Played yesterday: streak continues (+1).
 * - Any gap: streak restarts at 1.
 */
export const advanceStreak = (
  previous: StreakRecord,
  todayKey: string
): StreakRecord => {
  if (previous.lastPlayedKey === todayKey) return previous;

  const playedYesterday =
    previous.lastPlayedKey === shiftDailyKey(todayKey, -1);
  const current = playedYesterday ? previous.current + 1 : 1;

  return {
    current,
    best: Math.max(previous.best, current),
    lastPlayedKey: todayKey,
  };
};

/**
 * Returns the streak as the player should see it on `todayKey`.
 * A streak whose last play is older than yesterday is already broken.
 */
export const visibleStreak = (
  record: StreakRecord,
  todayKey: string
): StreakSummary => {
  const isAlive =
    record.lastPlayedKey === todayKey ||
    record.lastPlayedKey === shiftDailyKey(todayKey, -1);

  return { current: isAlive ? record.current : 0, best: record.best };
};
