import test from 'node:test';
import { availableCarryCards, isTestCarryCardId, seededAdminCarryCards } from './carryCards.ts';
import { ALL_CARD_IDS, getCard, isCardInPlay } from './cards.ts';
import assert from 'node:assert/strict';
import { ADMIN_SHOP_GOLD, MYSTERY_BOX_PRICE, offerTestShopFruit, testShopFruit, testShopStockKey, assignPandoraEffect, claimPandoraBounty, openedShopBoxes, shopGoldBalance, TEMP_RING_IDS, goldAfterPurchases, quotePurchase, quoteShopPurchase, readPurchases, readShopWallet, shopCardRarity, shopOffers, shopRingIds, selectCarryCards } from './ringShop.ts';
import { createRun, replayRun, runReducer } from './run.ts';
import { characterBonuses, trainingRingProgress } from './character.ts';
import { drawPandoraEvent, pandoraGoldBreakdown, readPandoraEvent } from './pandora.ts';
import { inventoryStacks } from './inventory.ts';
import { drawPandoraCard, PANDORA_CARD_TIERS } from './ringShop.ts';
import { hashSeed } from './rng.ts';

const day = '2026-11-27';

test('Pandora card rarity is rolled first and each tier can award a playable card', () => {
  assert.deepEqual(PANDORA_CARD_TIERS.map(({ weight }) => weight), [30, 30, 28, 12]);
  const counts = new Map<string, number>();
  const samples = 4000;
  for (let i = 0; i < samples; i++) {
    const card = drawPandoraCard(hashSeed('rarity-test:' + i), hashSeed('card-test:' + i));
    assert.ok(isCardInPlay(card));
    const rarity = shopCardRarity(card);
    counts.set(rarity, (counts.get(rarity) ?? 0) + 1);
  }
  for (const { item, weight } of PANDORA_CARD_TIERS)
    assert.ok(Math.abs((counts.get(item) ?? 0) / samples * 100 - weight) < 4, item);
});
const [cinder, tideglass] = shopOffers(day);
if (!cinder || cinder.slot !== 'ring' || !tideglass || tideglass.slot !== 'ring') throw new Error('Expected regular rings');

test('the shop always stocks five unique pieces; premium stock only appears in the final two spots', () => {
  let amulets = 0;
  let publicBoxes = 0;
  const boxSlots = new Set<number>();
  const stocks = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const date = new Date(Date.UTC(2026, 10, 27 + i)).toISOString().slice(0, 10);
    const offers = shopOffers(date);
    assert.equal(offers.length, 5);
    assert.equal(new Set(offers.map(offer => offer.id)).size, 5);
    assert.ok(offers.slice(0, 3).every(offer => offer.slot === 'box' || (offer.slot === 'ring' && ['Common', 'Uncommon'].includes(offer.rarity))));
    assert.ok(offers.slice(0, 4).every(offer => offer.slot !== 'amulet'));
    assert.deepEqual(offers, shopOffers(date));
    assert.ok(offers.filter(offer => offer.slot === 'box').length <= 1);
    assert.equal(shopOffers(date, true).filter(offer => offer.slot === 'box').length, 1);
    assert.equal(shopOffers(date, true)[4]?.id, 'mystery-box-5');
    stocks.add(offers.map(({ id }) => id).join(','));
    if (offers[4]?.slot === 'amulet') {
      assert.ok(offers[4].effect);
      amulets++;
    }
    offers.forEach((offer, i) => { if (offer.slot === 'box') { publicBoxes++; boxSlots.add(i); } });
  }
  assert.ok(stocks.size > 50);
  assert.ok(amulets > 20 && amulets < 90, String(amulets));
  assert.equal(boxSlots.size, 5);
  assert.ok(publicBoxes > 150, String(publicBoxes));
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
  assert.equal(quoteShopPurchase(1000, saved, { ...box, id: 'mystery-box-1' }, day, 'different-slot').status, 'owned');
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
  assert.equal(bound.effect, 'half-life-double-gold');
  assert.equal(claimPandoraBounty(bound.wallet, id), undefined);
  const legacy = readShopWallet(JSON.stringify({ items: {}, boxes: {}, events: { [receipt]: { kind: 'run', effect: 'half-life', runId: id } } }));
  const earned = claimPandoraBounty(legacy, id);
  if (!earned) throw new Error('Expected bounty');
  const restored = readShopWallet(JSON.stringify(earned));
  assert.equal(shopGoldBalance(100, restored), 160);
  assert.equal(claimPandoraBounty(restored, id), undefined);
});

test('admin test apples start at 3 and 2, expire with the visit, and never affect real stock', () => {
  const now = '2026-11-27T03.50p';
  const wallet = readShopWallet(undefined);
  const stockBefore = testShopStockKey(now, wallet);
  assert.equal(stockBefore, '2026-11-27T03.0');
  assert.deepEqual(testShopFruit(wallet), { 'metatrons-apple': 3, 'realm-apple': 2 });
  const realm = offerTestShopFruit(wallet, now, 'realm-apple')!;
  const restored = readShopWallet(JSON.stringify(realm));
  const premiumStock = testShopStockKey(now, restored);
  assert.notEqual(premiumStock, stockBefore);
  assert.equal(shopOffers(premiumStock, true)[3]?.rarity, 'Legendary');
  assert.equal(shopOffers(premiumStock, true).filter(o => o.slot === 'box').length, 1);
  assert.deepEqual(testShopFruit(restored), { 'metatrons-apple': 3, 'realm-apple': 1 });
  assert.equal(shopGoldBalance(ADMIN_SHOP_GOLD, restored), ADMIN_SHOP_GOLD);
  assert.equal(testShopStockKey('2026-11-27T04.9', restored), '2026-11-27T04.0');
  const noRealm = offerTestShopFruit(restored, now, 'realm-apple')!;
  assert.equal(offerTestShopFruit(noRealm, now, 'realm-apple'), undefined);
  const ordinary = offerTestShopFruit(noRealm, now, 'metatrons-apple')!;
  assert.ok(!testShopStockKey(now, ordinary).endsWith('p'));
  assert.deepEqual(testShopFruit(ordinary), { 'metatrons-apple': 2, 'realm-apple': 0 });
  assert.deepEqual(testShopFruit(wallet), { 'metatrons-apple': 3, 'realm-apple': 2 });
});

test('a fresh admin shop visit carries two Imbues and two regular cards without taking any test Gold', () => {
  const wallet = readShopWallet(JSON.stringify({ items: {}, boxes: {}, carry: seededAdminCarryCards() }));
  const cards = availableCarryCards(wallet.carry);
  assert.equal(cards.length, 4);
  assert.equal(cards.filter(card => getCard(card.cardId).type === 'imbue').length, 2);
  assert.ok(cards.every(card => card.source === 'test' && isCardInPlay(card.cardId)));
  assert.equal(shopGoldBalance(ADMIN_SHOP_GOLD, wallet), ADMIN_SHOP_GOLD);
});


void test('Metatron can offer every playable card and Imbues make up most card offers', () => {
  const seen = new Set<string>();
  let count = 0, imbues = 0;
  for (let i = 0; i < 12000; i++) {
    const stock = new Date(Date.UTC(2026, 10, 27, i)).toISOString().slice(0, 13) + '.0';
    const offer = shopOffers(stock).find(candidate => candidate.slot === 'card');
    if (!offer) continue;
    count++;
    seen.add(offer.cardId);
    if (getCard(offer.cardId).type === 'imbue') imbues++;
    assert.equal(offer.rarity, shopCardRarity(offer.cardId));
  }
  assert.deepEqual(seen, new Set(ALL_CARD_IDS.filter(isCardInPlay)));
  assert.ok(imbues / count > .60 && imbues / count < .70, String(imbues / count));
});

void test('Pandora rolls cards about 20% of the time and stores them as reusable inventory', () => {
  const box = shopOffers(day, true)[4]!;
  let cardRolls = 0;
  for (let i = 0; i < 2000; i++) {
    const purchase = quoteShopPurchase(200, readShopWallet(), box, day, String(i));
    if (purchase.status !== 'buy' || !('reward' in purchase) || purchase.reward?.kind !== 'card') continue;
    cardRolls++;
    const wallet = readShopWallet(JSON.stringify(purchase.next));
    const [receipt] = availableCarryCards(wallet.carry);
    assert.ok(receipt);
    assert.equal(receipt.cardId, purchase.reward.cardId);
    assert.ok(isCardInPlay(receipt.cardId));
    assert.equal(receipt.source, 'pandora');
    assert.equal(shopGoldBalance(200, wallet), 100);
    assert.equal(quoteShopPurchase(200, wallet, box, day, 'retry').status, 'owned');
    assert.deepEqual(selectCarryCards(wallet, [receipt.id]), [receipt.cardId]);
    assert.deepEqual(availableCarryCards(wallet.carry), [receipt]);
    if (cardRolls !== 1) continue;
    const alreadyOwn = { ...readShopWallet(), carry: { ['shop:' + day]: {
      id: 'shop:' + day, source: 'shop' as const, cardId: receipt.cardId,
    } } };
    const dupe = quoteShopPurchase(1000, alreadyOwn, box, day, String(i));
    assert.ok(dupe.status === 'buy' && 'reward' in dupe && dupe.reward?.kind === 'gold');
    assert.equal(dupe.reward.duplicateRarity, shopCardRarity(receipt.cardId));
    assert.equal(availableCarryCards(dupe.next.carry).length, 1);
    const practice = quoteShopPurchase(200, readShopWallet(), box, day, String(i), true);
    assert.ok(practice.status === 'buy');
    const [testCard] = availableCarryCards(readShopWallet(JSON.stringify(practice.next)).carry);
    assert.ok(testCard && isTestCarryCardId(testCard.id));
    assert.equal(testCard.source, 'test');
  }
  assert.ok(cardRolls >= 345 && cardRolls <= 455, String(cardRolls));
});


void test('Pandora Gold keeps its base and adds a level percentage without changing old receipts', () => {
  assert.deepEqual(drawPandoraEvent(0, 100, 1), { kind: 'gold', change: 180 });
  assert.deepEqual(pandoraGoldBreakdown(10), { base: 180, percent: 18, bonus: 32, total: 212 });
  assert.deepEqual(pandoraGoldBreakdown(20, 'Rare'), { base: 110, percent: 38, bonus: 41, total: 151 });
  assert.deepEqual(drawPandoraEvent(10, 100, 70), { kind: 'gold', change: -60 });
  const reward = drawPandoraEvent(0, 100, 10);
  assert.deepEqual(readPandoraEvent(reward), { kind: 'gold', change: 212, rewardLevel: 10 });
  assert.throws(() => readPandoraEvent({ kind: 'gold', change: 999, rewardLevel: 10 }));
  const box = shopOffers(day, true)[4]!;
  const receipt = day + ':' + box.id;
  const old = readShopWallet(JSON.stringify({ items: {}, boxes: {}, events: { [receipt]: { kind: 'gold', change: 180 } } }));
  assert.equal(shopGoldBalance(200, old), 280);
  const purchase = Array.from({ length: 160 }, (_, i) =>
    quoteShopPurchase(200, readShopWallet(), box, day, String(i), false, 10)
  ).find(result => result.status === 'buy' && 'reward' in result &&
    result.reward?.kind === 'gold' && result.reward.change === 212);
  assert.ok(purchase?.status === 'buy');
  assert.equal(shopGoldBalance(200, readShopWallet(JSON.stringify(purchase.next))), 312);
});
