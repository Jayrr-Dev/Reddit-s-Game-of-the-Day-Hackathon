import { appendCarriedCards, availableCarryCards, changeAlbum, grantAdminAlbumCards, isTestCarryCardId, seededAdminCarryCards, shopCardReceipt, shopStockKey, type AlbumAction } from '../../shared/game/carryCards';
import type { ShopApple } from '../../shared/game/items';
import type { CardId } from '../../shared/game/cards';
import { randomUUID } from 'node:crypto';
import { redis } from '@devvit/web/server';
import { progressionFromWins } from '../../shared/game/character';
import { bonusXpFromVictoryScore, goldFromVictoryScore } from '../../shared/game/gold';
import { ADMIN_SHOP_GOLD, allShopJewelryOwned, assignPandoraEffect, claimPandoraBounty, openedShopBoxes, pendingPandoraEffect, shopGoldBalance, quoteShopPurchase, recoverCardFromHell, selectCarryCards, readShopWallet, shopOffers, shopRingIds, offerTestShopFruit, testShopFruit, testShopStockKey, type ShopWallet, type ShopOfferId } from '../../shared/game/ringShop';
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
  return { wins: rows.length, earned: rows.reduce((sum, { score }) => sum + goldFromVictoryScore(score), 0),
    bonusXp: rows.reduce((sum, { score }) => sum + bonusXpFromVictoryScore(score), 0) };
}

/** Fix the migration point at the first read, preserving the old level and XP bar. */
async function readLevelCurveStart(id: string, wins: number): Promise<number> {
  const key = redisKeys.levelCurveStartWins(id);
  let baseline = await redis.get(key);
  if (baseline == null) {
    await redis.set(key, String(wins), { nx: true });
    baseline = await redis.get(key);
  }
  return baseline == null ? wins : Number(baseline);
}

export async function readPlayerProgress(id: string, adminAlbum?: { visit?: string }) {
  const [{ wins, earned, bonusXp }, wallet] = await Promise.all([earnings(id), adminAlbum
    ? loadAdminAlbum(id, adminAlbum.visit)
    : redis.get(redisKeys.ringPurchases(id)).then(raw => readShopWallet(raw))]);
  const nextEffect = pendingPandoraEffect(wallet);
  const xpStartWins = await readLevelCurveStart(id, wins);
  return { ...(nextEffect && { nextEffect }), wins, xpStartWins, bonusXp, gold: shopGoldBalance(earned, wallet), shopRings: shopRingIds(Object.keys(wallet.items)), carryCards: availableCarryCards(wallet.carry) };
}

/** Copy the verified admin's visit cards to the normal Album, preserving purchase receipts and ordering. */
async function loadAdminAlbum(id: string, visit?: string): Promise<ShopWallet> {
  const key = redisKeys.ringPurchases(id);
  const visitRaw = visit ? await redis.get(redisKeys.adminShopVisit(id, visit)) : undefined;
  const visitCards = visitRaw ? readShopWallet(visitRaw, true).carry : undefined;
  for (let i = 0; i < 6; i++) {
    const transaction = await redis.watch(key);
    let inMulti = false;
    let completed = false;
    try {
      const wallet = readShopWallet(await redis.get(key));
      const owned = wallet.carry ?? {};
      const carry = grantAdminAlbumCards(owned, visitCards);
      if (carry === owned) return wallet;
      const next = { ...wallet, carry };
      await transaction.multi();
      inMulti = true;
      await transaction.set(key, JSON.stringify(next));
      const result = await transaction.exec();
      completed = true;
      if (result[0] === 'OK') return next;
    } finally {
      if (!completed) {
        if (inMulti) await transaction.discard().catch(() => {});
        else await transaction.unwatch().catch(() => {});
      }
    }
  }
  throw new Error('Could not load the Album. Try again.');
}

function response(offerDay: string, earned: number, wallet: ShopWallet, admin: boolean, testVisit?: string): RingShopResponse {
  if (testVisit) offerDay = testShopStockKey(offerDay, wallet);
  const nextEffect = pendingPandoraEffect(wallet);
  const offers = shopOffers(offerDay, admin);
  const opened = openedShopBoxes(offerDay, wallet).length
    ? offers.flatMap(offer => offer.slot === 'box' ? [offer.id] : [])
    : [];
  return {
    ...(nextEffect && { nextEffect }),
    offerDay, gold: shopGoldBalance(earned, wallet), owned: shopRingIds(Object.keys(wallet.items)),
    offers, opened,
    collectedAll: allShopJewelryOwned(wallet.items), ...(testVisit && { testVisit, testItems: testShopFruit(wallet) }),
    carryCards: availableCarryCards(wallet.carry), imbueBought: !!wallet.carry?.[shopCardReceipt(offerDay, !!testVisit)],
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
  const wallet: ShopWallet = { ...emptyWallet(), carry: seededAdminCarryCards() };
  await redis.set(redisKeys.adminShopVisit(id, visit), JSON.stringify(wallet), { expiration: testExpiry() });
  return response(day, ADMIN_SHOP_GOLD, wallet, true, visit);
}

/** Re-read the same test wallet after an interrupted checkout, without resetting it. */
export async function getAdminRingShop(userId: string, day: string, visit: string): Promise<RingShopResponse> {
  const raw = await redis.get(redisKeys.adminShopVisit(userId, visit));
  return raw ? response(day, ADMIN_SHOP_GOLD, readShopWallet(raw, true), true, visit) : response(day, 0, emptyWallet(), true);
}

/** The test reroll and fruit debit are one wallet write. Never touch the actual bag or stock cycle. */
export async function offerAdminShopFruit(id: string, visit: string, item: ShopApple): Promise<RingShopResponse | undefined> {
  const key = redisKeys.adminShopVisit(id, visit);
  for (let attempt = 0; attempt < 6; attempt++) {
    const transaction = await redis.watch(key);
    let inMulti = false;
    let completed = false;
    try {
      const raw = await redis.get(key);
      if (!raw) return undefined;
      const day = shopStockKey(new Date(), 0);
      const next = offerTestShopFruit(readShopWallet(raw, true), day, item);
      if (!next) return undefined;
      await transaction.multi();
      inMulti = true;
      await transaction.set(key, JSON.stringify(next), { expiration: testExpiry() });
      const result = await transaction.exec();
      completed = true;
      if (result[0] === 'OK') return response(day, ADMIN_SHOP_GOLD, next, true, visit);
    } finally {
      if (!completed) {
        if (inMulti) await transaction.discard().catch(() => {});
        else await transaction.unwatch().catch(() => {});
      }
    }
  }
  throw new Error('Could not reroll the test shop.');
}

export async function buyRing(id: string, day: string, offerDay: string, ringId: ShopOfferId, admin = false, testVisit?: string) {
  if (admin && !testVisit) return { status: 'stale', shop: response(day, 0, emptyWallet(), true) } as const;
  const practice = admin ? testVisit : undefined;
  const albumKey = redisKeys.ringPurchases(id);
  const key = practice ? redisKeys.adminShopVisit(id, practice) : albumKey;
  const funds = async () => {
    const totals = await earnings(id);
    return practice ? { ...totals, earned: ADMIN_SHOP_GOLD } : totals;
  };
  const readCheckout = async () => {
    const stock = await currentShopStock(id);
    return practice ? getAdminRingShop(id, stock, practice) : getRingShop(id, stock);
  };
  const offer = shopOffers(offerDay, admin).find(item => item.id === ringId);
  if (!offer) return { status: 'stale', shop: await readCheckout() } as const;
  const entropy = offer.slot === 'box' ? randomUUID() : '';
  for (let attempt = 0; attempt < 6; attempt++) {
    const transaction = await redis.watch(key, redisKeys.shopBossClears(id), redisKeys.premiumShopRefresh(id), ...(practice ? [albumKey] : [redisKeys.victories(id)]));
    let inMulti = false;
    let completed = false;
    try {
      const [{ earned, wins, bonusXp }, raw, currentStock] = await Promise.all([funds(), redis.get(key), practice ? Promise.resolve(shopStockKey(new Date(), 0)) : currentShopStock(id)]);
      if (practice && !raw) return { status: 'stale', shop: response(day, 0, emptyWallet(), true) } as const;
      const wallet = readShopWallet(raw, !!practice);
      const stock = practice ? testShopStockKey(currentStock, wallet) : currentStock;
      if (stock !== offerDay) return { status: 'stale', shop: await readCheckout() } as const;
      const xpStartWins = await readLevelCurveStart(id, wins);
      const decision = quoteShopPurchase(earned, wallet, offer, stock, entropy, !!practice, progressionFromWins(wins, false, xpStartWins, bonusXp).level);
      if (decision.status === 'owned') return { status: 'owned', shop: response(stock, earned, wallet, admin, practice) } as const;
      if (decision.status === 'short' || decision.status === 'full') return { status: decision.status, shop: response(stock, earned, wallet, admin, practice) } as const;
      // Test Gold remains isolated. Cards earned there become permanent Album copies.
      const album = practice && decision.next.carry !== wallet.carry
        ? readShopWallet(await redis.get(albumKey)) : undefined;
      const albumCarry = album ? grantAdminAlbumCards(album.carry ?? {}, decision.next.carry) : undefined;
      // The receipt doubles as ownership and debit. No partial outcome can exist.
      await transaction.multi();
      inMulti = true;
      const receipt = JSON.stringify(practice || decision.next.events || decision.next.carry || Object.keys(decision.next.boxes).length ? decision.next : decision.next.items);
      if (practice) await transaction.set(key, receipt, { expiration: testExpiry() });
      else await transaction.set(key, receipt);
      if (album && albumCarry && albumCarry !== album.carry)
        await transaction.set(albumKey, JSON.stringify({ ...album, carry: albumCarry }));
      const result = await transaction.exec();
      completed = true;
      if (result[0] === 'OK' && result.every(entry => entry === 'OK'))
        return { status: 'bought', shop: response(stock, earned, decision.next, admin, practice), ...('reward' in decision && { reward: decision.reward }) } as const;
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

/** Bind reusable cards and any queued effect to the server-owned replay baseline. */
export async function bindRunItems(id: string, day: string, profile: RunProfile, testVisit: string | undefined, receipts: readonly string[], starter: readonly CardId[]) {
  const testIds = receipts.filter(isTestCarryCardId);
  const realIds = receipts.filter(receipt => !isTestCarryCardId(receipt));
  if (testIds.length && !testVisit) return undefined;
  const testKey = testVisit && (testIds.length || !receipts.length) ? redisKeys.adminShopVisit(id, testVisit) : undefined;
  const realKey = redisKeys.ringPurchases(id);
  const keys = testKey ? realIds.length ? [testKey, realKey] : [testKey] : [realKey];
  for (let i = 0; i < 6; i++) {
    const transaction = await redis.watch(keys[0]!, ...keys.slice(1));
    let inMulti = false;
    let completed = false;
    try {
      const [testRaw, realRaw] = await Promise.all([
        testKey ? redis.get(testKey) : Promise.resolve(undefined),
        keys.includes(realKey) ? redis.get(realKey) : Promise.resolve(undefined),
      ]);
      if (testKey && !testRaw) return undefined;
      const testWallet = readShopWallet(testRaw ?? undefined, true);
      const realWallet = readShopWallet(realRaw ?? undefined);
      const test = selectCarryCards(testWallet, testIds, true);
      const real = selectCarryCards(realWallet, realIds);
      if (!test || !real) return undefined;
      const cardsByReceipt = new Map([...testIds.map((receipt, index) => [receipt, test[index]!] as const),
        ...realIds.map((receipt, index) => [receipt, real[index]!] as const)]);
      const carriedCards = receipts.map(receipt => cardsByReceipt.get(receipt)!);
      if (appendCarriedCards(starter, carriedCards).length !== starter.length + carriedCards.length) return undefined;
      const assigned = assignPandoraEffect(testKey ? testWallet : realWallet, profile.id);
      if (!assigned && !carriedCards.length) return undefined;
      const next: RunProfile = { ...profile, ...(assigned && { pandoraEffect: assigned.effect }), ...(carriedCards.length && { carriedCards }), ...(carriedCards.length === 1 && { carriedCard: carriedCards[0]! }) };
      await transaction.multi();
      inMulti = true;
      if (testKey) await transaction.set(testKey, JSON.stringify(assigned?.wallet ?? testWallet), { expiration: testExpiry() });
      if (!testKey && assigned) await transaction.set(realKey, JSON.stringify(assigned.wallet));
      await transaction.set(redisKeys.runBaseline(id, day, profile.id), JSON.stringify({ ...next, ...(testKey && { testVisit }) }));
      const result = await transaction.exec();
      completed = true;
      if (result.length === (testKey || assigned ? 2 : 1) && result.every(entry => entry === 'OK')) return next;
    } finally {
      if (!completed) {
        if (inMulti) await transaction.discard().catch(() => {});
        else await transaction.unwatch().catch(() => {});
      }
    }
  }
  throw new Error('Could not start the run with these items. Try again.');
}

/** Save an Album edit without refunding or removing its original purchase receipt. */
export async function updatePlayerAlbum(id: string, action: AlbumAction) {
  const key = redisKeys.ringPurchases(id);
  for (let i = 0; i < 6; i++) {
    const transaction = await redis.watch(key);
    let inMulti = false;
    let completed = false;
    try {
      const raw = await redis.get(key);
      const wallet = readShopWallet(raw);
      const carry = changeAlbum(wallet.carry ?? {}, action);
      if (!carry) return undefined;
      await transaction.multi();
      inMulti = true;
      await transaction.set(key, JSON.stringify({ ...wallet, carry }));
      const result = await transaction.exec();
      completed = true;
      if (result[0] === 'OK') return availableCarryCards(carry);
    } finally {
      if (!completed) {
        if (inMulti) await transaction.discard().catch(() => {});
        else await transaction.unwatch().catch(() => {});
      }
    }
  }
  throw new Error('Could not update the Album. Try again.');
}

/** A verified first battle credits the bound curse run, at most once. */
export async function creditPandoraBounty(id: string, runId: string, testVisit?: string) {
  const key = testVisit ? redisKeys.adminShopVisit(id, testVisit) : redisKeys.ringPurchases(id);
  for (let i = 0; i < 6; i++) {
    const transaction = await redis.watch(key);
    let inMulti = false;
    let completed = false;
    try {
      const wallet = claimPandoraBounty(readShopWallet(await redis.get(key), !!testVisit), runId);
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
      const next = recoverCardFromHell(readShopWallet(raw, !!testVisit), runId, card);
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
