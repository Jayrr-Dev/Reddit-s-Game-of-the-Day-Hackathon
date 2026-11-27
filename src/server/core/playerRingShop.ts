import { availableCarryCards, shopStockKey } from '../../shared/game/carryCards';
import type { CardId } from '../../shared/game/cards';
import { randomUUID } from 'node:crypto';
import { redis } from '@devvit/web/server';
import { goldFromVictoryScore } from '../../shared/game/gold';
import { ADMIN_SHOP_GOLD, allShopJewelryOwned, assignPandoraEffect, claimPandoraBounty, openedShopBoxes, pendingPandoraEffect, shopGoldBalance, quoteShopPurchase, recoverCardFromHell, takeCarryCard, readShopWallet, shopOffers, shopRingIds, type ShopWallet, type ShopOfferId } from '../../shared/game/ringShop';
import type { RingShopResponse, RunProfile } from '../../shared/types/api';
import { redisKeys } from './redisKeys';

/** A player's shop changes every UTC hour or on each distinct qualifying run. */
export async function currentShopStock(id: string): Promise<string> {
  const [count, premium] = await Promise.all([redis.zCard(redisKeys.shopBossClears(id)), redis.get(redisKeys.premiumShopRefresh(id))]);
  const normal = shopStockKey(new Date(), count);
  return premium === normal ? normal + 'p' : normal;
}

export async function recordShopBossClear(id: string, runId: string) {
  await redis.zAdd(redisKeys.shopBossClears(id), { member: runId, score: 0 });
}

async function earnings(id: string) {
  const rows = await redis.zRange(redisKeys.victories(id), 0, -1, { by: 'rank' });
  return { wins: rows.length, earned: rows.reduce((sum, { score }) => sum + goldFromVictoryScore(score), 0) };
}

export async function readPlayerProgress(id: string) {
  const [{ wins, earned }, raw] = await Promise.all([earnings(id), redis.get(redisKeys.ringPurchases(id))]);
  const wallet = readShopWallet(raw);
  const nextEffect = pendingPandoraEffect(wallet);
  return { ...(nextEffect && { nextEffect }), wins, gold: shopGoldBalance(earned, wallet), shopRings: shopRingIds(Object.keys(wallet.items)), carryCards: availableCarryCards(wallet.carry) };
}

function response(offerDay: string, earned: number, wallet: ShopWallet, admin: boolean, testVisit?: string): RingShopResponse {
  const nextEffect = pendingPandoraEffect(wallet);
  const offers = shopOffers(offerDay, admin);
  const opened = openedShopBoxes(offerDay, wallet).length
    ? offers.flatMap(offer => offer.slot === 'box' ? [offer.id] : [])
    : [];
  return {
    ...(nextEffect && { nextEffect }),
    offerDay, gold: shopGoldBalance(earned, wallet), owned: shopRingIds(Object.keys(wallet.items)),
    offers, opened,
    collectedAll: allShopJewelryOwned(wallet.items), ...(testVisit && { testVisit }),
    carryCards: availableCarryCards(wallet.carry), imbueBought: !!wallet.carry?.['shop:' + offerDay],
  };
}

export async function getRingShop(id: string, day: string): Promise<RingShopResponse> {
  const [{ earned }, raw] = await Promise.all([earnings(id), redis.get(redisKeys.ringPurchases(id))]);
  return response(day, earned, readShopWallet(raw), false);
}

const testExpiry = () => new Date(Date.now() + 60 * 60 * 1000);
const emptyWallet = (): ShopWallet => ({ items: {}, boxes: {} });

/** Give each admin shop visit an isolated, expiring wallet. */
export async function openAdminRingShop(id: string, day: string): Promise<RingShopResponse> {
  const visit = randomUUID();
  const wallet = emptyWallet();
  await redis.set(redisKeys.adminShopVisit(id, visit), JSON.stringify(wallet), { expiration: testExpiry() });
  return response(day, ADMIN_SHOP_GOLD, wallet, true, visit);
}

/** Re-read the same test wallet after an interrupted checkout, without resetting it. */
export async function getAdminRingShop(userId: string, day: string, visit: string): Promise<RingShopResponse> {
  const raw = await redis.get(redisKeys.adminShopVisit(userId, visit));
  return raw ? response(day, ADMIN_SHOP_GOLD, readShopWallet(raw), true, visit) : response(day, 0, emptyWallet(), true);
}

export async function buyRing(id: string, day: string, offerDay: string, ringId: ShopOfferId, admin = false, testVisit?: string) {
  if (admin && !testVisit) return { status: 'stale', shop: response(day, 0, emptyWallet(), true) } as const;
  const practice = admin ? testVisit : undefined;
  const key = practice ? redisKeys.adminShopVisit(id, practice) : redisKeys.ringPurchases(id);
  const funds = () => practice ? Promise.resolve({ earned: ADMIN_SHOP_GOLD }) : earnings(id);
  const readCheckout = async () => {
    const stock = await currentShopStock(id);
    return practice ? getAdminRingShop(id, stock, practice) : getRingShop(id, stock);
  };
  const offer = shopOffers(day, admin).find(item => item.id === ringId);
  if (offerDay !== day || !offer) return { status: 'stale', shop: await readCheckout() } as const;
  const entropy = offer.slot === 'box' ? randomUUID() : '';
  for (let attempt = 0; attempt < 6; attempt++) {
    const transaction = await redis.watch(key, redisKeys.shopBossClears(id), redisKeys.premiumShopRefresh(id), ...(practice ? [] : [redisKeys.victories(id)]));
    let inMulti = false;
    let completed = false;
    try {
      const [{ earned }, raw, currentStock] = await Promise.all([funds(), redis.get(key), currentShopStock(id)]);
      if (currentStock !== day) return { status: 'stale', shop: await readCheckout() } as const;
      if (practice && !raw) return { status: 'stale', shop: response(day, 0, emptyWallet(), true) } as const;
      const wallet = readShopWallet(raw);
      const decision = quoteShopPurchase(earned, wallet, offer, day, entropy);
      if (decision.status === 'owned') return { status: 'owned', shop: response(day, earned, wallet, admin, practice) } as const;
      if (decision.status === 'short') return { status: 'short', shop: response(day, earned, wallet, admin, practice) } as const;
      // The receipt doubles as ownership and debit. No partial outcome can exist.
      await transaction.multi();
      inMulti = true;
      const receipt = JSON.stringify(practice || decision.next.events || decision.next.carry || Object.keys(decision.next.boxes).length ? decision.next : decision.next.items);
      if (practice) await transaction.set(key, receipt, { expiration: testExpiry() });
      else await transaction.set(key, receipt);
      const result = await transaction.exec();
      completed = true;
      if (result[0] === 'OK')
        return { status: 'bought', shop: response(day, earned, decision.next, admin, practice), ...('reward' in decision && { reward: decision.reward }) } as const;
      // A concurrent wallet or victory update aborted the write. Re-quote both.
    } finally {
      if (!completed) {
        if (inMulti) await transaction.discard().catch(() => {});
        else await transaction.unwatch().catch(() => {});
      }
    }
  }
  return { status: 'retry', shop: await readCheckout() } as const;
}

/** Bind a queued effect and selected carry card to the run and its replay baseline in one transaction. */
export async function bindRunItems(id: string, day: string, profile: RunProfile, testVisit?: string, bringCard?: string) {
  const key = testVisit ? redisKeys.adminShopVisit(id, testVisit) : redisKeys.ringPurchases(id);
  for (let i = 0; i < 6; i++) {
    const transaction = await redis.watch(key);
    let inMulti = false;
    let completed = false;
    try {
      const previous = readShopWallet(await redis.get(key));
      const carried = takeCarryCard(previous, bringCard, profile.id);
      if (bringCard && !carried) return undefined;
      const assigned = assignPandoraEffect(carried?.wallet ?? previous, profile.id);
      if (!assigned && !carried) return undefined;
      const next: RunProfile = { ...profile, ...(assigned && { pandoraEffect: assigned.effect }), ...(carried && { carriedCard: carried.card.cardId }) };
      await transaction.multi();
      inMulti = true;
      const wallet = JSON.stringify(assigned?.wallet ?? carried?.wallet);
      if (testVisit) await transaction.set(key, wallet, { expiration: testExpiry() });
      else await transaction.set(key, wallet);
      await transaction.set(redisKeys.runBaseline(id, day, profile.id), JSON.stringify({ ...next, ...(testVisit && { testVisit }) }));
      const result = await transaction.exec();
      completed = true;
      if (result[0] === 'OK' && result[1] === 'OK') return next;
    } finally {
      if (!completed) {
        if (inMulti) await transaction.discard().catch(() => {});
        else await transaction.unwatch().catch(() => {});
      }
    }
  }
  throw new Error('Could not attach the Pandora effect. Try starting again.');
}

/** A verified first battle credits the bound curse run, at most once. */
export async function creditPandoraBounty(id: string, runId: string, testVisit?: string) {
  const key = testVisit ? redisKeys.adminShopVisit(id, testVisit) : redisKeys.ringPurchases(id);
  for (let i = 0; i < 6; i++) {
    const transaction = await redis.watch(key);
    let inMulti = false;
    let completed = false;
    try {
      const wallet = claimPandoraBounty(readShopWallet(await redis.get(key)), runId);
      if (!wallet) return;
      await transaction.multi();
      inMulti = true;
      if (testVisit) await transaction.set(key, JSON.stringify(wallet), { expiration: testExpiry() });
      else await transaction.set(key, JSON.stringify(wallet));
      const result = await transaction.exec();
      completed = true;
      if (result[0] === 'OK') return;
    } finally {
      if (!completed) {
        if (inMulti) await transaction.discard().catch(() => {});
        else await transaction.unwatch().catch(() => {});
      }
    }
  }
  throw new Error('Could not credit the Pandora bounty. Try saving again.');
}

/** Deposit a card once, and only after the trusted replay verified Greed's bargain and death. */
export async function bankHellCard(id: string, runId: string, card: CardId, testVisit?: string) {
  const key = testVisit ? redisKeys.adminShopVisit(id, testVisit) : redisKeys.ringPurchases(id);
  for (let i = 0; i < 6; i++) {
    const transaction = await redis.watch(key);
    let inMulti = false;
    let completed = false;
    try {
      const raw = await redis.get(key);
      if (testVisit && !raw) return;
      const next = recoverCardFromHell(readShopWallet(raw), runId, card);
      if (!next) return;
      await transaction.multi();
      inMulti = true;
      if (testVisit) await transaction.set(key, JSON.stringify(next), { expiration: testExpiry() });
      else await transaction.set(key, JSON.stringify(next));
      const result = await transaction.exec();
      completed = true;
      if (result[0] === 'OK') return;
    } finally {
      if (!completed) {
        if (inMulti) await transaction.discard().catch(() => {});
        else await transaction.unwatch().catch(() => {});
      }
    }
  }
  throw new Error('Could not deposit the card from Hell.');
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
