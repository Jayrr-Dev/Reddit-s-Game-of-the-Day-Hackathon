import test from 'node:test';
import assert from 'node:assert/strict';
import { RING_RARITIES, goldAfterPurchases, quotePurchase, readPurchases, shopOffers, shopRingIds } from './ringShop.ts';
import { createRun, replayRun, runReducer } from './run.ts';
import { trainingRingProgress } from './character.ts';
import { inventoryStacks } from './inventory.ts';

const day = '2026-11-27';
const [cinder, tideglass] = shopOffers(day);

test('daily stock only sells temporary rings, with stable prices in five distinct tiers', () => {
  const offers = shopOffers(day);
  assert.equal(offers.length, 10);
  assert.equal(new Set(offers.map(offer => offer.id)).size, 10);
  assert.deepEqual(offers, shopOffers(day));
  assert.notDeepEqual(offers.map(offer => offer.price), shopOffers('2026-11-28').map(offer => offer.price));
  for (let i = 0; i < RING_RARITIES.length - 1; i++) {
    const current = offers.filter(offer => offer.rarity === RING_RARITIES[i]);
    const next = offers.filter(offer => offer.rarity === RING_RARITIES[i + 1]);
    assert.equal(current.length, 2);
    assert.ok(Math.max(...current.map(offer => offer.price)) < Math.min(...next.map(offer => offer.price)));
  }
});

test('an owned ring is charged once, and a stale checkout is short once another purchase spends its Gold', () => {
  const earned = cinder!.price;
  assert.equal(quotePurchase(earned - 1, {}, cinder!).status, 'short');
  const purchase = quotePurchase(earned, {}, cinder!);
  assert.equal(purchase.status, 'buy');
  if (purchase.status !== 'buy') throw new Error('Expected purchase');
  const afterRefresh = readPurchases(JSON.stringify(purchase.next));
  assert.equal(goldAfterPurchases(earned, afterRefresh), 0);
  assert.equal(quotePurchase(earned, afterRefresh, cinder!).status, 'owned');
  assert.equal(quotePurchase(earned, afterRefresh, tideglass!).status, 'short');
  assert.deepEqual(shopRingIds(['not-a-ring', cinder!.id, cinder!.id]), [cinder!.id]);
  assert.throws(() => readPurchases('{"cinder-band":-5}'));
});

test('a purchased ring appears in inventory and can be equipped; unowned rings never equip', () => {
  const action = { type: 'equipItem', slot: 'ring', itemId: cinder!.id, ringIndex: 1 } as const;
  const unowned = createRun(day, trainingRingProgress());
  assert.equal(runReducer(unowned, action), unowned);
  const owned = createRun(day, trainingRingProgress(), 0, 0, [cinder!.id]);
  assert.ok(inventoryStacks({ character: owned.character, bag: {} }).some(item => item.id === cinder!.id));
  const equipped = replayRun(day, [action], trainingRingProgress(), 0, 0, [cinder!.id]);
  assert.equal(equipped.character.equipment.rings[1], cinder!.id);
});
