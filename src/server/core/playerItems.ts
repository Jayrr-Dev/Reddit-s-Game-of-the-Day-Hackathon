// ===================================================================
// PLAYER ITEMS
// The server owns each player's item bag, so the client can never set
// its own counts; it can only ask to spend one item at a time.
// ===================================================================
import { shopStockKey } from '../../shared/game/carryCards';
import { randomUUID } from 'node:crypto';
import { redis } from '@devvit/web/server';
import { discardStack, isItemBag, itemQuantity, REALM_APPLE, SHOP_APPLE, spendItem, type ShopApple, startingBag, type ItemBag, type ItemId } from '../../shared/game/items';
import { redisKeys } from './redisKeys';

// --- READ ---
/** Loads a player's bag; a player with no saved bag gets the starting items. */
export async function getItems(userId: string): Promise<ItemBag> {
  const raw = await redis.get(redisKeys.playerItems(userId));
  const data: unknown = raw ? JSON.parse(raw) : null;
  return isItemBag(data) ? data : startingBag();
}

// --- TRASH ---
/** Keep generic item writes from overwriting concurrent Apple awards or gifts. */
async function mutateBag(userId: string, update: (bag: ItemBag) => ItemBag | null): Promise<ItemBag | null> {
  const key = redisKeys.playerItems(userId);
  for (let attempt = 0; attempt < 6; attempt++) {
    const tx = await redis.watch(key);
    let active = false;
    let complete = false;
    try {
      const next = update(await getItems(userId));
      if (!next) return null;
      await tx.multi(); active = true;
      await tx.set(key, JSON.stringify(next));
      const result = await tx.exec(); complete = true;
      if (result[0] === 'OK') return next;
    } finally {
      if (!complete) {
        if (active) await tx.discard().catch(() => {});
        else await tx.unwatch().catch(() => {});
      }
    }
  }
  throw new Error('Could not update your Inventory.');
}

/** Destroys every copy of one item. Admins included: trashing is always real. */
export async function discardPlayerItem(userId: string, id: ItemId): Promise<ItemBag> {
  return (await mutateBag(userId, bag => discardStack(bag, id)))!;
}

// --- SPEND ---
/**
 * Spends one item. Admins keep their item (they test freely), and a
 * player without the item gets null so the route can refuse.
 */
export async function spendPlayerItem(userId: string, id: ItemId, isAdmin: boolean) {
  if (isAdmin) return { items: await getItems(userId), spent: false };
  const next = await mutateBag(userId, bag => spendItem(bag, id));
  if (!next) return null;
  return { items: next, spent: true };
}

/** Credited by trusted combat replay, once per run stop. */
export async function recordAppleFinds(userId: string, drops: readonly { id: string; item: ShopApple }[]) {
  if (!drops.length) return;
  const bag = redisKeys.playerItems(userId);
  const ledger = redisKeys.appleFinds(userId);
  for (let attempt = 0; attempt < 6; attempt++) {
    const tx = await redis.watch(bag, ledger);
    let active = false;
    try {
      const existing = await Promise.all(drops.map(({ id }) => redis.zScore(ledger, id)));
      const missing = drops.filter((_, index) => existing[index] == null);
      if (!missing.length) return;
      const items = await getItems(userId);
      await tx.multi(); active = true;
      const next = { ...items };
      for (const { item } of missing) next[item] = itemQuantity(next, item) + 1;
      await tx.set(bag, JSON.stringify(next));
      await tx.zAdd(ledger, ...missing.map(({ id }) => ({ member: id, score: 0 })));
      const result = await tx.exec(); active = false;
      if (result[0] === 'OK') return;
    } finally {
      if (active) await tx.discard().catch(() => {});
      else await tx.unwatch().catch(() => {});
    }
  }
  throw new Error('Could not record the Apple drop.');
}

/** Consume the fruit and reroll the market together. */
export async function offerApple(userId: string, item: ShopApple = SHOP_APPLE): Promise<ItemBag | null> {
  const bag = redisKeys.playerItems(userId);
  const stock = redisKeys.shopBossClears(userId);
  const receipt = 'apple:' + randomUUID();
  for (let attempt = 0; attempt < 6; attempt++) {
    const premium = redisKeys.premiumShopRefresh(userId);
    const tx = await redis.watch(bag, stock, premium);
    let active = false;
    try {
      const [old, revision] = await Promise.all([getItems(userId), redis.zCard(stock)]);
      const items = spendItem(old, item);
      if (!items) return null;
      await tx.multi(); active = true;
      await tx.set(bag, JSON.stringify(items));
      await tx.zAdd(stock, { member: receipt, score: 0 });
      if (item === REALM_APPLE) await tx.set(premium, shopStockKey(new Date(), revision + 1));
      const result = await tx.exec(); active = false;
      if (result[0] === 'OK') return items;
    } finally {
      if (active) await tx.discard().catch(() => {});
      else await tx.unwatch().catch(() => {});
    }
  }
  throw new Error('Could not offer the Apple. Please try again.');
}
