import { randomUUID } from 'node:crypto';
import { redis } from '@devvit/web/server';
import { goldFromVictoryScore } from '../../shared/game/gold';
import { allShopJewelryOwned, goldAfterPurchases, MYSTERY_BOX_IDS, quoteShopPurchase, readShopWallet, shopOffers, shopRingIds, type ShopWallet, type ShopOfferId } from '../../shared/game/ringShop';
import type { RingShopResponse } from '../../shared/types/api';
import { redisKeys } from './redisKeys';

async function earnings(id: string) {
  const rows = await redis.zRange(redisKeys.victories(id), 0, -1, { by: 'rank' });
  return { wins: rows.length, earned: rows.reduce((sum, { score }) => sum + goldFromVictoryScore(score), 0) };
}

export async function readPlayerProgress(id: string) {
  const [{ wins, earned }, raw] = await Promise.all([earnings(id), redis.get(redisKeys.ringPurchases(id))]);
  const wallet = readShopWallet(raw);
  return { wins, gold: goldAfterPurchases(earned, wallet.items), shopRings: shopRingIds(Object.keys(wallet.items)) };
}

function response(offerDay: string, earned: number, wallet: ShopWallet, admin: boolean): RingShopResponse {
  return {
    offerDay, gold: goldAfterPurchases(earned, wallet.items), owned: shopRingIds(Object.keys(wallet.items)),
    offers: shopOffers(offerDay, admin), opened: MYSTERY_BOX_IDS.filter(box => wallet.boxes[offerDay + ':' + box]),
    collectedAll: allShopJewelryOwned(wallet.items),
  };
}

export async function getRingShop(id: string, day: string, admin = false): Promise<RingShopResponse> {
  const [{ earned }, raw] = await Promise.all([earnings(id), redis.get(redisKeys.ringPurchases(id))]);
  return response(day, earned, readShopWallet(raw), admin);
}

export async function buyRing(id: string, day: string, offerDay: string, ringId: ShopOfferId, admin = false) {
  const key = redisKeys.ringPurchases(id);
  const offer = shopOffers(day, admin).find(item => item.id === ringId);
  if (offerDay !== day || !offer) return { status: 'stale', shop: await getRingShop(id, day, admin) } as const;
  const entropy = offer.slot === 'box' ? randomUUID() : '';
  for (let attempt = 0; attempt < 6; attempt++) {
    const transaction = await redis.watch(key, redisKeys.victories(id));
    let inMulti = false;
    let completed = false;
    try {
      const [{ earned }, raw] = await Promise.all([earnings(id), redis.get(key)]);
      const wallet = readShopWallet(raw);
      const decision = quoteShopPurchase(earned, wallet, offer, day, entropy);
      if (decision.status === 'owned') return { status: 'owned', shop: response(day, earned, wallet, admin) } as const;
      if (decision.status === 'short') return { status: 'short', shop: response(day, earned, wallet, admin) } as const;
      // The receipt doubles as ownership and debit. No partial outcome can exist.
      await transaction.multi();
      inMulti = true;
      await transaction.set(key, JSON.stringify(Object.keys(decision.next.boxes).length ? decision.next : decision.next.items));
      const result = await transaction.exec();
      completed = true;
      if (result[0] === 'OK')
        return { status: 'bought', shop: response(day, earned, decision.next, admin), ...('reward' in decision && { reward: decision.reward }) } as const;
      // A concurrent wallet or victory update aborted the write. Re-quote both.
    } finally {
      if (!completed) {
        if (inMulti) await transaction.discard().catch(() => {});
        else await transaction.unwatch().catch(() => {});
      }
    }
  }
  return { status: 'retry', shop: await getRingShop(id, day, admin) } as const;
}

/** A run replay may submit the same wins again. The first awarded value is
 * permanent, including old flat-10 victory records. */
export async function recordVictories(id: string, awards: readonly { member: string; score: number }[]) {
  if (!awards.length) return;
  const key = redisKeys.victories(id);
  for (let attempt = 0; attempt < 6; attempt++) {
    const transaction = await redis.watch(key);
    let inMulti = false;
    let completed = false;
    try {
      const stored = await Promise.all(awards.map(({ member }) => redis.zScore(key, member)));
      const pending = awards.filter((_, index) => stored[index] == null);
      if (!pending.length) return;
      await transaction.multi();
      inMulti = true;
      await transaction.zAdd(key, ...pending);
      const result = await transaction.exec();
      completed = true;
      if (typeof result[0] === 'number') return;
    } finally {
      if (!completed) {
        if (inMulti) await transaction.discard().catch(() => {});
        else await transaction.unwatch().catch(() => {});
      }
    }
  }
  throw new Error('Could not save victories after concurrent updates');
}
