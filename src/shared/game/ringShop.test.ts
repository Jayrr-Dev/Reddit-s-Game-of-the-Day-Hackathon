import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_SHOP_GOLD, MYSTERY_BOX_PRICE, assignPandoraEffect, claimPandoraBounty, openedShopBoxes, shopGoldBalance, TEMP_RING_IDS, goldAfterPurchases, quotePurchase, quoteShopPurchase, readPurchases, readShopWallet, shopOffers, shopRingIds } from './ringShop.ts';
import { createRun, replayRun, runReducer } from './run.ts';
import { characterBonuses, trainingRingProgress } from './character.ts';
import { inventoryStacks } from './inventory.ts';

const day = '2026-11-27';
const [cinder, tideglass] = shopOffers(day);
if (!cinder || cinder.slot !== 'ring' || !tideglass || tideglass.slot !== 'ring') throw new Error('Expected regular rings');

test('the shop always stocks five unique pieces; premium stock only appears in the final two spots', () => {
  let amulets = 0;
  let publicBoxes = 0;
  const stocks = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const date = new Date(Date.UTC(2026, 10, 27 + i)).toISOString().slice(0, 10);
    const offers = shopOffers(date);
    assert.equal(offers.length, 5);
    assert.equal(new Set(offers.map(offer => offer.id)).size, 5);
    assert.ok(offers.slice(0, 3).every(offer => offer.slot === 'ring' && ['Common', 'Uncommon'].includes(offer.rarity)));
    assert.ok(offers.slice(0, 4).every(offer => offer.slot !== 'amulet'));
    assert.deepEqual(offers, shopOffers(date));
    assert.deepEqual(shopOffers(date, true).slice(0, 4), offers.slice(0, 4));
    assert.equal(shopOffers(date, true)[4]?.id, 'mystery-box-5');
    stocks.add(offers.map(({ id }) => id).join(','));
    if (offers[4]?.slot === 'amulet') {
      assert.ok(offers[4].effect);
      amulets++;
    }
    publicBoxes += offers.filter(offer => offer.slot === 'box').length;
  }
  assert.ok(stocks.size > 50);
  assert.ok(amulets > 20 && amulets < 90, String(amulets));
  assert.ok(publicBoxes > 50 && publicBoxes < 150, String(publicBoxes));
});

test('an owned ring is charged once, and another purchase can leave the wallet short', () => {
  const earned = cinder.price;
  assert.equal(quotePurchase(earned - 1, {}, cinder).status, 'short');
  const purchase = quotePurchase(earned, {}, cinder);
  assert.equal(purchase.status, 'buy');
  if (purchase.status !== 'buy') throw new Error('Expected purchase');
  const afterRefresh = readPurchases(JSON.stringify(purchase.next));
  assert.equal(goldAfterPurchases(earned, afterRefresh), 0);
  assert.equal(quotePurchase(earned, afterRefresh, cinder).status, 'owned');
  assert.equal(quotePurchase(earned, afterRefresh, tideglass).status, 'short');
  assert.deepEqual(shopRingIds(['not-a-ring', cinder.id, cinder.id]), [cinder.id]);
  assert.throws(() => readPurchases('{"cinder-band":-5}'));
});

test('a purchased ring appears in inventory and can be equipped; unowned rings never equip', () => {
  const action = { type: 'equipItem', slot: 'ring', itemId: cinder.id, ringIndex: 1 } as const;
  const unowned = createRun(day, trainingRingProgress());
  assert.equal(runReducer(unowned, action), unowned);
  const owned = createRun(day, trainingRingProgress(), 0, 0, [cinder.id]);
  assert.ok(inventoryStacks({ character: owned.character, bag: {} }).some(item => item.id === cinder.id));
  const equipped = replayRun(day, [action], trainingRingProgress(), 0, 0, [cinder.id]);
  assert.equal(equipped.character.equipment.rings[1], cinder.id);
});

test('a shop amulet is restored to its neck slot and changes combat draws', () => {
  const action = { type: 'equipItem', slot: 'amulet', itemId: 'vesper-locket' } as const;
  const locked = createRun(day);
  assert.equal(runReducer(locked, action), locked);
  const equipped = replayRun(day, [action], undefined, 0, 0, ['vesper-locket']);
  assert.equal(equipped.character.equipment.amulet, 'vesper-locket');
  assert.ok(equipped.character.inventory.some(item => item.id === 'vesper-locket' && item.slot === 'amulet'));
  assert.equal(characterBonuses({}, equipped.character.equipment).cardsPerTurn, characterBonuses().cardsPerTurn + 2);
});

test('a mystery box costs exactly 100 Gold, awards an unowned item and only opens once', () => {
  const box = shopOffers(day, true)[4];
  if (!box || box.slot !== 'box') throw new Error('Expected admin box');
  assert.equal(box.price, MYSTERY_BOX_PRICE);
  const old = readShopWallet('{"cinder-band":30}');
  assert.equal(quoteShopPurchase(129, old, box, day, 'roll').status, 'short');
  const purchase = Array.from({ length: 35 }, (_, index) => quoteShopPurchase(130, old, box, day, String(index)))
    .find(result => result.status === 'buy' && 'reward' in result && result.reward?.kind === 'jewelry');
  if (!purchase || purchase.status !== 'buy' || !('reward' in purchase) || purchase.reward?.kind !== 'jewelry') throw new Error('Expected reward');
  assert.notEqual(purchase.reward.id, 'cinder-band');
  const saved = readShopWallet(JSON.stringify(purchase.next));
  assert.equal(goldAfterPurchases(130, saved.items), 0);
  assert.equal(saved.boxes[day + ':' + box.id], purchase.reward.id);
  assert.equal(quoteShopPurchase(1000, saved, box, day, 'different-roll').status, 'owned');
  assert.throws(() => readShopWallet('{"items":{},"boxes":{"2026-11-27:mystery-box-5":"cinder-band"}}'));
});

test('mystery rewards can be ordinary rings, Legendary rings or amulets', () => {
  const box = shopOffers(day, true)[4];
  if (!box || box.slot !== 'box') throw new Error('Expected admin box');
  const found = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const purchase = quoteShopPurchase(100, { items: {}, boxes: {} }, box, day, String(i));
    if (purchase.status === 'buy' && 'reward' in purchase && purchase.reward?.kind === 'jewelry') {
      found.add(purchase.reward.slot + ':' + purchase.reward.rarity);
    }
  }
  assert.ok(found.has('ring:Common') && found.has('ring:Legendary'));
  assert.ok([...found].some(key => key.startsWith('amulet:')));
  const items = Object.fromEntries([...TEMP_RING_IDS, 'ferryman-token', 'vesper-locket', 'last-lantern'].map(id => [id, 1]));
  const result = quoteShopPurchase(1000, { items, boxes: {} }, box, day, 'roll');
  assert.equal(result.status, 'buy');
  if (result.status === 'buy' && 'reward' in result) assert.notEqual(result.reward?.kind, 'jewelry');
});

test('Pandora Gold changes include the price and clamp a loss to what is left', () => {
  const receipt = day + ':mystery-box-5';
  const wallet = readShopWallet(JSON.stringify({ items: {}, boxes: {}, events: { [receipt]: { kind: 'gold', change: 180 } } }));
  assert.equal(shopGoldBalance(100, wallet), 180);
  assert.deepEqual(openedShopBoxes(day, wallet), ['mystery-box-5']);
  const box = shopOffers(day, true)[4]!;
  assert.equal(quoteShopPurchase(ADMIN_SHOP_GOLD, wallet, box, day, 'new visit').status, 'owned');
  const open = quoteShopPurchase(ADMIN_SHOP_GOLD, readShopWallet(), box, day, 'new visit');
  assert.equal(open.status, 'buy');
  for (let i = 0; i < 100; i++) {
    const buy = quoteShopPurchase(106, readShopWallet(), box, day, String(i));
    if (buy.status === 'buy' && 'reward' in buy && buy.reward?.kind === 'gold' && buy.reward.change <= 0)
      assert.equal(buy.reward.change, -6);
  }
});

test('Pandora effects apply to one issued run and bounty survives replay without paying twice', () => {
  const receipt = day + ':mystery-box-5';
  const id = 'd45964e8-4729-4f63-ad79-e2286afa4f30';
  const wallet = readShopWallet(JSON.stringify({items:{},boxes:{},events:{[receipt]:{kind:'run',effect:'half-life'}}}));
  const bound = assignPandoraEffect(wallet, id);
  if (!bound) throw new Error('Expected queued effect');
  assert.equal(assignPandoraEffect(bound.wallet, id), undefined);
  assert.equal(claimPandoraBounty(bound.wallet, 'another run'), undefined);
  const curseRun = replayRun(day, [], undefined, 0, 0, [], bound.effect);
  const ordinary = createRun(day);
  assert.equal(curseRun.hp, Math.ceil(ordinary.hp / 2));
  assert.equal(curseRun.maxHp, ordinary.maxHp);
  assert.deepEqual(curseRun.phase, ordinary.phase);
  assert.equal(createRun(day, undefined, 0, 0, [], 'lasting-vigor').maxHp, ordinary.maxHp + 12);
  assert.equal(createRun(day, undefined, 0, 0, [], 'brittle-blood').maxHp, ordinary.maxHp - 10);
  const earned = claimPandoraBounty(bound.wallet, id);
  if (!earned) throw new Error('Expected bounty');
  const restored = readShopWallet(JSON.stringify(earned));
  assert.equal(shopGoldBalance(100, restored), 160);
  assert.equal(claimPandoraBounty(restored, id), undefined);
});
