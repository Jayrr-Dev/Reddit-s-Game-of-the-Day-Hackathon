import test from 'node:test';
import assert from 'node:assert/strict';
import { availableCarryCards, changeAlbum, grantAdminAlbumCards, isCarryCardId, isCarrySelection, isTestCarryCardId, seededAdminCarryCards, shopStockKey } from './carryCards.ts';
import { appleAtVictory } from './gold.ts';
import { PANDORA_DUPLICATE_GOLD } from './pandora.ts';
import { replayForScoreAndUnlocks } from './replayForScore.ts';
import { restoreLoggedRun, saveLoggedRun } from './runSave.ts';
import { starterDeck } from './starters.ts';
import { getCard, type CardId } from './cards.ts';
import { startCombat } from './combat.ts';
import { createRun, runReducer, greedCanTake, type RunState } from './run.ts';
import { routeOptions } from './kingdom.ts';
import { rollOffers } from './rewards.ts';
import { openedShopBoxes, quoteShopPurchase, recoverCardFromHell, readShopWallet, shopGoldBalance, shopOffers, selectCarryCards } from './ringShop.ts';

const day = '2026-11-27';
const firstId = 'b4879658-3fed-485f-8039-600f1045a9f8';
const nextId = '4c9d180d-5955-4c68-bcd2-92995619e472';

test('one obsolete Album receipt cannot block the profile or change the saved balance', () => {
  const shopId = 'shop:' + day;
  const bad = { id: shopId, cardId: 'retiredCardExample', source: 'shop' };
  const wallet = readShopWallet(JSON.stringify({ items: {}, boxes: {}, carry: {
    [shopId]: bad, 'grant:ruin': { id: 'grant:ruin', cardId: 'ruin', source: 'grant', discarded: false },
  } }));
  assert.deepEqual(selectCarryCards(wallet, ['grant:ruin']), ['ruin']);
  assert.equal(selectCarryCards(wallet, [shopId]), undefined);
  assert.equal(shopGoldBalance(200, wallet), 115);
  const updated = { ...wallet, carry: changeAlbum(wallet.carry!, { type: 'trash', id: 'grant:ruin' }) };
  assert.deepEqual(readShopWallet(JSON.stringify(updated)).unreadCarry, { [shopId]: bad });
  assert.equal(shopGoldBalance(200, readShopWallet(JSON.stringify(updated))), 115);
});

test('Album keeps a fifth card selectable and tombstones trash without refunding it', () => {
  const extra = 'shop:' + day;
  const initial = { ...readShopWallet(), carry: { ...seededAdminCarryCards(), [extra]: { id: extra, cardId: 'wardingBolt', source: 'shop' } } } as const;
  assert.deepEqual(selectCarryCards(initial, [extra]), ['wardingBolt']);
  assert.equal(selectCarryCards(initial, [...Object.keys(initial.carry)]), undefined, 'only four may be packed at once');
  const swapped = changeAlbum(initial.carry, { type: 'swap', id: extra, with: 'test:1' });
  assert.ok(swapped);
  assert.deepEqual(selectCarryCards({ ...initial, carry: swapped }, [extra]), ['wardingBolt']);
  const discarded = changeAlbum(swapped, { type: 'trash', id: extra });
  assert.ok(discarded);
  const reloaded = readShopWallet(JSON.stringify({ ...initial, carry: discarded }));
  assert.equal(availableCarryCards(reloaded.carry).length, 4);
  assert.equal(selectCarryCards(reloaded, [extra]), undefined);
  assert.equal(shopGoldBalance(200, reloaded), shopGoldBalance(200, initial));
  assert.equal(changeAlbum(reloaded.carry!, { type: 'trash', id: extra }), undefined);
});

test('admin samples and visit cards become normal reusable Album receipts without a charge', () => {
  const legacyId = 'test-pandora:' + day + ':mystery-box-5';
  const visit = { ...seededAdminCarryCards(), [legacyId]: { id: legacyId, cardId: 'mourningCurse', source: 'test' } } as const;
  const carry = grantAdminAlbumCards({}, visit);
  const wallet = readShopWallet(JSON.stringify({ ...readShopWallet(), carry }));
  assert.deepEqual(availableCarryCards(wallet.carry).map(card => card.cardId), ['keenEdge', 'emberRune', 'wardingBolt', 'ruin', 'mourningCurse']);
  assert.equal(shopGoldBalance(200, wallet), 200);
  assert.deepEqual(selectCarryCards(wallet, ['grant:keenEdge', 'grant:ruin']), ['keenEdge', 'ruin']);
  assert.deepEqual(selectCarryCards(wallet, ['grant:mourningCurse']), ['mourningCurse']);
  assert.equal(selectCarryCards(wallet, ['test:0']), undefined);
  const swapped = changeAlbum(carry, { type: 'swap', id: 'grant:mourningCurse', with: 'grant:ruin' });
  assert.ok(swapped);
  assert.deepEqual(selectCarryCards({ ...wallet, carry: swapped }, ['grant:mourningCurse']), ['mourningCurse']);
  const trashed = changeAlbum(swapped, { type: 'trash', id: 'grant:keenEdge' });
  assert.ok(trashed);
  assert.equal(grantAdminAlbumCards(trashed, visit), trashed);
  assert.ok(!availableCarryCards(trashed).some(card => card.cardId === 'keenEdge'));
});

test('import preserves already owned receipts and skips cards trashed in the visit', () => {
  const id = 'shop:' + day;
  const owned = { [id]: { id, cardId: 'keenEdge', source: 'shop' } } as const;
  const visit = changeAlbum(seededAdminCarryCards(), { type: 'trash', id: 'test:1' });
  assert.ok(visit);
  const next = grantAdminAlbumCards(owned, visit);
  assert.deepEqual(availableCarryCards(next).map(card => card.id), [id, 'grant:wardingBolt', 'grant:ruin']);
  assert.equal(grantAdminAlbumCards(next), next);
});

test('Artifacts appear in the run that receives them and never carry into the next', () => {
  const started = createRun(day);
  const action = { type: 'chooseStop', option: 0, hellArtifact: 'ember-heart' } as const;
  const awarded = runReducer(started, action);
  assert.deepEqual(awarded.artifacts, ['ember-heart']);
  assert.equal(awarded.maxHp, started.maxHp + 10);
  assert.deepEqual(replayForScoreAndUnlocks(day, [action]).state.artifacts, awarded.artifacts);
  assert.equal(createRun(day, undefined, 1).artifacts, undefined);
});

test('an Imbue destroys its own copy and the exact target keeps its gift in the next battle', () => {
  const deck: CardId[] = ['keenEdge', 'arcaneBolt', 'arcaneBolt'];
  const base = createRun(day, undefined, 0, 0, [], undefined, 1);
  const plain = startCombat({ hp: 66, maxHp: 66, deck, heroIds: ['squire'], seed: 23, might: 1, copyImbues: {} });
  const targetCopy = 2;
  const combat = { ...plain, heroes: plain.heroes.map(hero => ({ ...hero, hp: 1 })) };
  const initial: RunState = { ...base, deck, phase: { kind: 'combat', combat, stop: { kind: 'horde', heroIds: ['squire'] } } };
  const targetUid = combat.heroes[0]!.uid;
  const first = runReducer(initial, { type: 'playCard', handIndex: combat.hand.indexOf('keenEdge'), targetUid: -1, imbueIndex: combat.copies!.hand.indexOf(targetCopy) });
  assert.equal(first.phase.kind, 'combat');
  if (first.phase.kind !== 'combat') return;
  assert.deepEqual(first.phase.combat.copies?.destroyed, [0]);
  assert.equal(first.phase.combat.copies?.gifts[1], undefined);
  assert.equal(first.phase.combat.copies?.gifts[2]?.length, 1);
  const won = runReducer(first, { type: 'playCard', handIndex: first.phase.combat.copies!.hand.indexOf(targetCopy), targetUid });
  assert.equal(won.phase.kind, 'reward');
  assert.deepEqual(won.deck, ['arcaneBolt', 'arcaneBolt']);
  assert.equal(won.deckImbues?.[0], undefined);
  assert.equal(won.deckImbues?.[1]?.length, 1);
  const second = runReducer(runReducer(won, { type: 'pickCard', offerIndex: null }), {type:'chooseStop',option:0});
  if (second.phase.kind !== 'combat') throw new Error('Expected second battle');
  assert.equal(second.phase.combat.handImbues[second.phase.combat.copies!.hand.indexOf(1)]?.length, 1);
  assert.equal(second.phase.combat.handImbues[second.phase.combat.copies!.hand.indexOf(0)]?.length, 0);
});

test('Greed takes the selected copy now, cannot take a brought card, and recovered cards are reusable', () => {
  const base = createRun(day, undefined, 0, 0, [], undefined, 1, 'arrowShot');
  const state = { ...base, deck: ['arcaneBolt', 'darkCloak', 'arrowShot'] as CardId[], phase: { kind: 'greed-bargain' } as const };
  assert.equal(greedCanTake(state, 2), false);
  const traded = runReducer(state, { type: 'greedChoice', cardIndex: 0 });
  assert.deepEqual(traded.deck, ['darkCloak', 'arrowShot']);
  assert.equal(traded.promisedToGreed, 'arcaneBolt');
  assert.equal(runReducer(state, { type: 'greedChoice', cardIndex: null }).deck.length, 3);
  const banked = recoverCardFromHell(readShopWallet(), firstId, traded.promisedToGreed!);
  if (!banked) throw new Error('Expected held card');
  assert.deepEqual(selectCarryCards(banked, ['hell:' + firstId]), ['arcaneBolt']);
  assert.deepEqual(selectCarryCards(banked, ['hell:' + firstId]), ['arcaneBolt']);
  assert.equal(recoverCardFromHell(banked, firstId, 'arcaneBolt'), undefined);
});

test('new markets reroll hourly and after a boss without admitting Imbues to regular drops', () => {
  const start = shopStockKey(new Date('2026-11-27T03:00:00Z'), 0);
  assert.equal(shopStockKey(new Date('2026-11-27T03:58:00Z'), 0), start);
  assert.notEqual(shopStockKey(new Date('2026-11-27T04:00:00Z'), 0), start);
  assert.notEqual(shopStockKey(new Date('2026-11-27T03:00:00Z'), 1), start);
  assert.ok(isCarryCardId('shop:' + start));
  const kinds = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const stock = shopStockKey(new Date('2026-11-27T03:00:00Z'), i);
    const offer = shopOffers(stock, true).find(item => item.slot === 'card');
    if (!offer || offer.slot !== 'card') continue;
    kinds.add(getCard(offer.cardId).type);
    const buy = quoteShopPurchase(200, readShopWallet(), offer, stock, 'entropy');
    if (buy.status !== 'buy') throw new Error('Expected shop card');
    const bought = readShopWallet(JSON.stringify(buy.next));
    assert.equal(shopGoldBalance(200, bought), 200 - offer.price);
    assert.deepEqual(openedShopBoxes(stock, bought), []);
    assert.equal(selectCarryCards(bought, ['shop:' + stock])?.[0], offer.cardId);
  }
  assert.ok(kinds.has('imbue') && kinds.size > 1);
  for (let seed = 1; seed < 200; seed++)
    for (const source of ['horde', 'elite', 'champion', 'altar'] as const)
      assert.ok(rollOffers(seed, source, [], undefined, [], [], undefined, true).every(id => getCard(id).type !== 'imbue'));
  assert.ok(Array.from({ length: 90 }, (_, stop) => routeOptions(day, stop + 3, true))
    .some(options => options.some(option => option.kind === 'greed-bargain')));
  assert.equal(routeOptions(day, 5, true)[0]?.kind, 'champion');
  assert.equal(appleAtVictory(firstId, 5, 'champion'), undefined);
  assert.ok(Array.from({ length: 100 }, (_, stop) => appleAtVictory(firstId, stop, 'horde')).some(Boolean));
});

test('all four bag cards are reusable and survive starter selection, save restore, and score replay', () => {
  const wallet = { ...readShopWallet(), carry: seededAdminCarryCards() };
  const ids = ['test:2', 'test:0', 'test:1', 'test:3'];
  assert.equal(isCarrySelection([...ids, ids[0]]), false);
  assert.equal(selectCarryCards(wallet, ['test:0', 'shop:2026-11-27']), undefined);
  assert.equal(wallet.carry['test:0']?.spent, undefined);
  const issued = selectCarryCards(wallet, ids);
  assert.ok(issued);
  assert.deepEqual(selectCarryCards(wallet, ids), issued);
  assert.ok(ids.every(id => !wallet.carry[id]?.spent));
  const oldCard = { ...wallet.carry['test:0']!, spent: nextId };
  const restored = readShopWallet(JSON.stringify({ ...wallet, carry: { 'test:0': oldCard } }));
  assert.deepEqual(selectCarryCards(restored, ['test:0']), [oldCard.cardId]);
  assert.deepEqual(availableCarryCards(restored.carry), [{ id: oldCard.id, source: oldCard.source, cardId: oldCard.cardId }]);
  const starter = starterDeck('Mage');
  const action = { type: 'starterDeck', name: 'Mage', cards: starter } as const;
  const base = createRun(day, undefined, 0, 0, [], undefined, 1, issued);
  const run = runReducer(base, action);
  assert.deepEqual(run.deck, [...starter, ...issued]);
  assert.deepEqual(replayForScoreAndUnlocks(day, [action], 0, [], undefined, 1, issued).state.deck, run.deck);
  let snapshot: string | null = null;
  const storage = { length: 0, key: () => null, getItem: () => snapshot, setItem: (_key: string, value: string) => { snapshot = value; } };
  const blank = restoreLoggedRun(day);
  saveLoggedRun({ ...blank, run, actions: [action], profile: { id: firstId, wins: 0, cardRules: 1, carriedCards: issued } }, storage);
  assert.deepEqual(restoreLoggedRun(day, storage).run.deck, run.deck);
});

test('a duplicate Pandora jewelry roll pays its rarity in Gold without adding another copy', () => {
  const stock = shopStockKey(new Date('2026-11-27T03:00:00Z'), 0);
  const box = shopOffers(stock, true).find(offer => offer.slot === 'box');
  assert.ok(box);
  const seen = new Set();
  for (let i = 0; i < 1500 && seen.size < 6; i++) {
    const make = readShopWallet();
    const draw = quoteShopPurchase(1000, make, box, stock, String(i));
    if (draw.status !== 'buy' || !('reward' in draw) || draw.reward.kind !== 'jewelry') continue;
    const { rarity, slot } = draw.reward;
    const wallet = { ...make, items: draw.next.items };
    const duplicate = quoteShopPurchase(1000, wallet, box, stock, String(i));
    if (duplicate.status !== 'buy' || !('reward' in duplicate)) throw new Error('Missing duplicate payout');
    const amt = PANDORA_DUPLICATE_GOLD[rarity];
    assert.deepEqual(duplicate.reward, { kind: 'gold', change: amt, duplicateRarity: rarity });
    assert.deepEqual(duplicate.next.items, wallet.items);
    const restored = readShopWallet(JSON.stringify(duplicate.next));
    assert.equal(shopGoldBalance(1000, restored), shopGoldBalance(1000, wallet) - box.price + amt);
    assert.equal(quoteShopPurchase(1000, restored, box, stock, 'retry').status, 'owned');
    seen.add(rarity);
    if (slot === 'amulet') seen.add('amulet');
  }
  assert.deepEqual(seen, new Set([...Object.keys(PANDORA_DUPLICATE_GOLD), 'amulet']));
});

test('Realm Apple stock guarantees a unique Legendary even during admin visits', () => {
  for (let revision = 0; revision < 600; revision++) {
    const key = shopStockKey(new Date('2026-11-27T03:00:00Z'), revision) + 'p';
    for (const admin of [false, true]) {
      const offers = shopOffers(key, admin);
      assert.equal(offers.length, 5);
      assert.equal(offers[3]?.slot, 'ring');
      assert.equal(offers[3]?.rarity, 'Legendary');
      assert.equal(new Set(offers.map(offer => offer.id)).size, 5);
      if (admin) assert.equal(offers[4]?.slot, 'box');
    }
  }
});

test('an admin shop purchase stays in the same test wallet and can be brought into a run', () => {
  const stock = '2026-11-27T12.0';
  const offer = shopOffers(stock, true).find(row => row.slot === 'card');
  assert.ok(offer && offer.slot === 'card');
  const original = quoteShopPurchase(1000, readShopWallet(), offer, stock, '', true);
  assert.equal(original.status, 'buy');
  if (original.status !== 'buy') return;
  const id = 'test-shop:' + stock;
  assert.equal(isTestCarryCardId(id), true);
  assert.equal(isCarrySelection([id]), true);
  const reloaded = readShopWallet(JSON.stringify(original.next), true);
  assert.equal(availableCarryCards(reloaded.carry).find(card => card.id === id)?.cardId, offer.cardId);
  assert.equal(shopGoldBalance(1000, reloaded), 1000 - offer.price);
  assert.deepEqual(selectCarryCards(reloaded, [id]), [offer.cardId]);
  assert.equal(quoteShopPurchase(1000, reloaded, offer, stock, '', true).status, 'owned');
  const legacy = quoteShopPurchase(1000, readShopWallet(), offer, stock, '', false);
  if (legacy.status !== 'buy') throw new Error('Expected legacy receipt');
  assert.ok(readShopWallet(JSON.stringify(legacy.next)).carry?.['shop:' + stock]);
  assert.equal(readShopWallet(JSON.stringify(legacy.next), true).carry?.[id]?.cardId, offer.cardId);
});
