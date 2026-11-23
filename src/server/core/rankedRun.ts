// ===================================================================
// RANKED RUN
// Each player gets one ranked run per day: the first run they start.
// The run is marked "started" when it begins, so quitting a bad run and
// restarting cannot fish for a better seed, and "finished" once its
// score is on the board. Later runs are practice.
// ===================================================================

import { redis } from '@devvit/web/server';
import { DAILY_DATA_TTL_DAYS } from '../../shared/constants/game';
import { redisKeys } from './redisKeys';

// --- TYPES ---
type RankedRunStatus = 'none' | 'started' | 'finished';

// --- CONSTANTS ---
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// --- HELPERS ---

/** When a ranked-run marker should expire, so Redis stays bounded. */
const markerExpiry = (): Date =>
  new Date(Date.now() + DAILY_DATA_TTL_DAYS * MS_PER_DAY);

/** Reads where the player's ranked run for the day stands. */
const getStatus = async (
  dailyKey: string,
  userId: string
): Promise<RankedRunStatus> => {
  const stored = await redis.get(redisKeys.rankedRun(dailyKey, userId));
  return stored === 'started' || stored === 'finished' ? stored : 'none';
};

/** Writes the player's ranked-run status. */
const setStatus = async (
  dailyKey: string,
  userId: string,
  status: Exclude<RankedRunStatus, 'none'>
): Promise<void> => {
  await redis.set(redisKeys.rankedRun(dailyKey, userId), status, {
    expiration: markerExpiry(),
  });
};

// --- PUBLIC API ---

/** True once the player has begun today's ranked run. */
export const hasStartedRankedRun = async (dailyKey: string, userId: string) =>
  (await getStatus(dailyKey, userId)) !== 'none';

/** Starts a run. Returns true when this is the day's ranked run. */
export const beginRun = async (
  dailyKey: string,
  userId: string
): Promise<boolean> => {
  if (await hasStartedRankedRun(dailyKey, userId)) return false;
  await setStatus(dailyKey, userId, 'started');
  return true;
};

/**
 * Finishes a run. Returns true when it was the ranked run (and closes it),
 * so its score belongs on the leaderboard.
 */
export const completeRun = async (
  dailyKey: string,
  userId: string
): Promise<boolean> => {
  if ((await getStatus(dailyKey, userId)) !== 'started') return false;
  await setStatus(dailyKey, userId, 'finished');
  return true;
};
