import test from 'node:test';
import assert from 'node:assert/strict';
import { isCarryCardId, shopStockKey } from './carryCards.ts';
import { appleAtVictory } from './gold.ts';
import { getCard, type CardId } from './cards.ts';
import { startCombat } from './combat.ts';
import { createRun, runReducer, greedCanTake, type RunState } from './run.ts';
import { routeOptions } from './kingdom.ts';
import { rollOffers } from './rewards.ts';
import { openedShopBoxes, quoteShopPurchase, recoverCardFromHell, readShopWallet, shopGoldBalance, shopOffers, takeCarryCard } from './ringShop.ts';

const day = '2026-11-27';
const firstId = 'b4879658-3fed-485f-8039-600f1045a9f8';
const nextId = '4c9d180d-5955-4c68-bcd2-92995619e472';

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

test('Greed takes the selected copy now, cannot take a brought card, and recovered cards are single-use', () => {
  const base = createRun(day, undefined, 0, 0, [], undefined, 1, 'arrowShot');
  const state = { ...base, deck: ['arcaneBolt', 'darkCloak', 'arrowShot'] as CardId[], phase: { kind: 'greed-bargain' } as const };
  assert.equal(greedCanTake(state, 2), false);
  const traded = runReducer(state, { type: 'greedChoice', cardIndex: 0 });
  assert.deepEqual(traded.deck, ['darkCloak', 'arrowShot']);
  assert.equal(traded.promisedToGreed, 'arcaneBolt');
  assert.equal(runReducer(state, { type: 'greedChoice', cardIndex: null }).deck.length, 3);
  const banked = recoverCardFromHell(readShopWallet(), firstId, traded.promisedToGreed!);
  if (!banked) throw new Error('Expected held card');
  const paid = takeCarryCard(banked, 'hell:' + firstId, nextId);
  assert.equal(paid?.card.cardId, 'arcaneBolt');
  assert.equal(takeCarryCard(paid!.wallet, paid!.card.id, firstId), undefined);
  assert.equal(recoverCardFromHell(paid!.wallet, firstId, 'arcaneBolt'), undefined);
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
    assert.equal(takeCarryCard(bought, 'shop:' + stock, firstId)?.card.cardId, offer.cardId);
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
