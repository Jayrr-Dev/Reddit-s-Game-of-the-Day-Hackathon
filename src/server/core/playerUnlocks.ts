// ===================================================================
// PLAYER UNLOCKS
// The server owns each player's unlocks (see shared/game/unlocks.ts).
// They only grow, and only from run logs the server replayed itself.
// ===================================================================
import { redis } from '@devvit/web/server';
import { addsUnlocks, EMPTY_UNLOCKS, isUnlocks, mergeUnlocks, type Unlocks } from '../../shared/game/unlocks';
import { redisKeys } from './redisKeys';

// --- READ ---
/** Loads a player's unlocks; a new player has none. */
export async function getUnlocks(userId: string): Promise<Unlocks> {
  const raw = await redis.get(redisKeys.playerUnlocks(userId));
  const data: unknown = raw ? JSON.parse(raw) : null;
  return isUnlocks(data) ? data : EMPTY_UNLOCKS;
}

// --- RECORD ---
/** Adds a replayed run's unlocks to the player's record (writes only on change). */
export async function recordUnlocks(userId: string, earned: Unlocks): Promise<void> {
  const saved = await getUnlocks(userId);
  if (!addsUnlocks(saved, earned)) return;
  await redis.set(redisKeys.playerUnlocks(userId), JSON.stringify(mergeUnlocks(saved, earned)));
}
