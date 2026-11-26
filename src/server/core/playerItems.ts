// ===================================================================
// PLAYER ITEMS
// The server owns each player's item bag, so the client can never set
// its own counts; it can only ask to spend one item at a time.
// ===================================================================
import { redis } from '@devvit/web/server';
import { isItemBag, spendItem, startingBag, type ItemBag, type ItemId } from '../../shared/game/items';
import { redisKeys } from './redisKeys';

// --- READ ---
/** Loads a player's bag; a player with no saved bag gets the starting items. */
export async function getItems(userId: string): Promise<ItemBag> {
  const raw = await redis.get(redisKeys.playerItems(userId));
  const data: unknown = raw ? JSON.parse(raw) : null;
  return isItemBag(data) ? data : startingBag();
}

// --- SPEND ---
/**
 * Spends one item. Admins keep their item (they test freely), and a
 * player without the item gets null so the route can refuse.
 */
export async function spendPlayerItem(userId: string, id: ItemId, isAdmin: boolean) {
  const items = await getItems(userId);
  if (isAdmin) return { items, spent: false };
  const next = spendItem(items, id);
  if (!next) return null;
  await redis.set(redisKeys.playerItems(userId), JSON.stringify(next));
  return { items: next, spent: true };
}
