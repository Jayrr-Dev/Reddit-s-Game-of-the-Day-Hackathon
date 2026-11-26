// ===================================================================
// SANDBOX TESTS
// Target dummies: hordes always fit, energy refills, and clearing the
// field brings a fresh horde with new uids.
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES } from './features.ts';
import { characterBonuses, createCharacter } from './character.ts';
import { canPush, cellsOf, fallBack, sizeOf } from './battlefield.ts';
import {
  SANDBOX_SCENARIOS,
  createSandbox,
  createSandboxWith,
  rollDummies,
  sandboxReducer,
  SANDBOX_HP,
  stepSandbox, retryTrainingFight,
  groupScenariosByUnitType,
} from './sandbox.ts';
import { CARDS_PER_TURN, ENERGY_PER_TURN } from './rules.ts';
import { getCard, isCardInPlay, type CardId } from './cards.ts';
import { SANDBOX_DECKS, sandboxDeckCards, activeTrainingCards, restoreTrainingDecks, saveTrainingDeck } from './sandboxDecks.ts';
import { movementFailsOn } from './combat.ts';
import { canMove, movementBlockReason, offeredMovement } from './movement.ts';
import type { HeroUnit } from './types.ts';

// This file checks the two-row field (rows.test.ts covers three rows).
FEATURES.threeRowField = false;

// --- HELPERS ---
/** Every (row, column) cell a hero stands in, as "row:col". */
const cellNamesOf = (unit: HeroUnit): string[] =>
  cellsOf(unit).map(({ row, col }) => `${row}:${col}`);

// --- TESTS ---
void test('every rolled horde fits the field without overlap', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const { heroes } = createSandbox(seed);
    const [heroIds] = rollDummies(seed);
    assert.ok(heroIds.length >= 2, `seed ${seed} rolled too few`);
    const cells = heroes.flatMap(cellNamesOf);
    assert.equal(new Set(cells).size, cells.length, `seed ${seed} overlaps`);
    assert.ok(heroes.every((unit) => unit.col + sizeOf(unit) <= 3));
  }
});

void test('training spends energy, blocks unaffordable cards, and refills on a new turn', () => {
  const start = { ...createSandbox(7), energy: 1, hand: ['ironHide', 'ironHide'] as CardId[] };
  const play = { type: 'playCard', handIndex: 0, targetUid: start.heroes[0]!.uid } as const;
  const spent = sandboxReducer(start, play);
  assert.equal(spent.energy, 0);
  assert.equal(spent.hand.length, 1);
  assert.equal(sandboxReducer(spent, play), spent);
  assert.equal(sandboxReducer(spent, { type: 'endTurn' }).energy, characterBonuses(createCharacter().traits).startingEnergy);
});

void test('practice starts every selected deck or scenario with its saved traits and bonus health', () => {
  const { traits } = createCharacter();
  const trained = { ...traits, vigor: 3, endurance: 32 };
  const expectedHp = characterBonuses(trained).maxHp;
  assert.equal(createSandbox(7).player.hp, SANDBOX_HP);
  for (const fight of [createSandbox(7, 'all', trained), createSandboxWith(7, ['archer'], true, 'fire', trained)]) {
    assert.deepEqual(fight.player.traits, trained);
    assert.equal(fight.player.maxHp, expectedHp);
    assert.equal(fight.player.hp, expectedHp);
    assert.equal(fight.energy, characterBonuses(trained).startingEnergy);
  }
});

void test('clearing the field brings a new horde with higher uids', () => {
  const start = createSandbox(11);
  const oneLeft = {
    ...start,
    hand: ['cataclysm' as const],
    heroes: start.heroes
      .slice(0, 1)
      .map((unit) => ({ ...unit, hp: 1, guard: 0 })),
  };
  const { combat: next, victory } = stepSandbox(oneLeft, {
    type: 'playCard',
    handIndex: 0,
    targetUid: oneLeft.heroes[0]!.uid,
  });
  assert.equal(victory, true);
  assert.equal(stepSandbox(next, { type: 'playCard', handIndex: -1, targetUid: next.heroes[0]!.uid }).victory, false);
  assert.ok(next.heroes.length >= 2);
  assert.equal(next.turn, start.turn + 1);
  assert.equal(next.hand.length, CARDS_PER_TURN);
  assert.equal(next.player.hp, start.player.hp);
  assert.ok(next.heroes.every((unit) => unit.moveIndex === 0));
  const oldUid = oneLeft.heroes[0]!.uid;
  assert.ok(next.heroes.every((unit) => unit.uid > oldUid));
  const arrived = sandboxReducer(next, { type: 'endTurn' });
  assert.equal(arrived.waveArrival, false);
  assert.equal(arrived.turn, next.turn + 1);
  assert.equal(arrived.player.hp, next.player.hp);
  assert.ok(arrived.heroes.every(unit => unit.moveIndex === 0));
});

void test('a poison clear during the enemy turn deals a fresh hand before the new wave acts', () => {
  const start = createSandboxWith(7, ['archer']);
  const combat = {
    ...start,
    hand: [], // Isolate the fresh draw from cards kept by Hold.
    heroes: start.heroes.map((hero) => ({
      ...hero, hp: 1, statuses: { ...hero.statuses, poison: 2 },
    })),
  };
  const { combat: next, victory } = stepSandbox(combat, { type: 'endTurn' });
  assert.equal(victory, true);
  assert.equal(next.turn, start.turn + 1);
  assert.equal(next.hand.length, CARDS_PER_TURN);
  assert.equal(next.player.hp, start.player.hp);
  assert.ok(next.heroes.every((unit) => unit.uid >= start.nextUid && unit.moveIndex === 0));
  assert.ok(next.energy > ENERGY_PER_TURN, 'unspent energy was reserved once');
});

// --- BOSSES ---
void test('the Holy Dragon holds a T: the front row and the back centre', () => {
  const { heroes } = createSandboxWith(5, ['holyDragon']);
  const [dragon] = heroes;
  assert.ok(dragon);
  assert.deepEqual(cellNamesOf(dragon), [
    'front:0', 'front:0.5', 'front:1', 'front:1.5', 'front:2', 'front:2.5',
    'back:1', 'back:1.5',
  ]);
});

void test('others fill the back flanks around a boss', () => {
  const { heroes } = createSandboxWith(5, ['holyDragon', 'squire', 'archer']);
  const others = heroes
    .filter((unit) => unit.heroId !== 'holyDragon')
    .flatMap(cellNamesOf)
    .sort();
  assert.deepEqual(others, ['back:0', 'back:0.5', 'back:2', 'back:2.5']);
});

void test('a boss is never pulled, pushed or moved by Back Step', () => {
  const { heroes } = createSandboxWith(5, ['holyDragon']);
  const [dragon] = heroes;
  assert.ok(dragon);
  assert.equal(canPush(heroes, dragon), false);
  assert.equal(fallBack(heroes, 1)[0]?.row, 'front');
});

void test('random dummies never roll a boss', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    assert.ok(!rollDummies(seed)[0].includes('holyDragon'));
  }
});

// --- SCENARIOS ---
void test('every scenario places all its heroes without overlap', () => {
  for (const scenario of SANDBOX_SCENARIOS) {
    const { heroes } = createSandboxWith(9, scenario.heroIds);
    assert.equal(heroes.length, scenario.heroIds.length, scenario.name);
    const cells = heroes.flatMap(cellNamesOf);
    assert.equal(
      new Set(cells).size,
      cells.length,
      `${scenario.name} overlaps`
    );
    assert.ok(heroes.every((unit) => unit.col + sizeOf(unit) <= 3));
  }
});

void test('scenario ids are unique and the Holy Dragon has one', () => {
  const ids = SANDBOX_SCENARIOS.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(
    SANDBOX_SCENARIOS.some((scenario) =>
      scenario.heroIds.includes('holyDragon')
    )
  );
});

void test('a push on a boss fails but the card still lands', () => {
  const start = createSandboxWith(5, ['holyDragon']);
  const dragon = start.heroes[0]!;
  const state = { ...start, hand: ['hurlAside' as const], energy: 3 };
  assert.ok(movementFailsOn(state, 'hurlAside', dragon.uid));
  const after = sandboxReducer(state, {
    type: 'playCard',
    handIndex: 0,
    targetUid: dragon.uid,
  });
  const hit = after.heroes[0]!;
  assert.equal(hit.row, 'front');
  assert.ok(hit.hp + hit.guard < dragon.hp + dragon.guard);
});

void test('Back Step is offered but locked while a boss reaches back', () => {
  const state = createSandboxWith(5, ['holyDragon']);
  assert.equal(offeredMovement(state), 'backStep');
  assert.ok(movementBlockReason(state, 'backStep'));
  assert.equal(canMove(state, 'backStep'), false);
});

void test('Grand Griffon Rio is the only unit in his training scenario', () => {
  const scenario = SANDBOX_SCENARIOS.find(({ id }) => id === 'grandGriffon')!;
  const { heroes } = createSandboxWith(5, scenario.heroIds, scenario.startsInPlace);
  assert.deepEqual(heroes.map(({ heroId }) => heroId), ['grandGriffon']);
  assert.deepEqual(cellNamesOf(heroes[0]!), ['front:1', 'front:1.5', 'back:1', 'back:1.5']);
});

void test('Grand Griffon Rio holds the centre column, front and back', () => {
  const { heroes } = createSandboxWith(5, ['grandGriffon', 'squire']);
  const griffon = heroes.find((unit) => unit.heroId === 'grandGriffon');
  assert.ok(griffon);
  assert.deepEqual(cellNamesOf(griffon), ['front:1', 'front:1.5', 'back:1', 'back:1.5']);
  assert.equal(canPush(heroes, griffon), false);
});

// --- TEST DECKS ---
void test('every test deck holds at least 4 cards, all in play', () => {
  for (const deck of SANDBOX_DECKS) {
    const cards = sandboxDeckCards(deck.id);
    assert.ok(new Set(cards).size >= 4, deck.id);
    assert.ok(cards.every(isCardInPlay), deck.id);
  }
});

void test('Stacked Buffs training deck has four copies of each family card', () => {
  const cards = sandboxDeckCards('stackedBuffs');
  assert.equal(cards.length, 16);
  for (const card of ['bulwark', 'instinct', 'sapStrength', 'sap'] as const) {
    assert.equal(cards.filter(id => id === card).length, 4);
  }
  const restored = restoreTrainingDecks({ deckId: 'stackedBuffs' });
  assert.deepEqual(activeTrainingCards(restored), cards);
  const fight = createSandbox(7, 'stackedBuffs');
  assert.equal(fight.hand.length + fight.drawPile.length, 16);
  assert.ok([...fight.hand, ...fight.drawPile].every(id => cards.includes(id)));
});

void test('a test deck leans on its theme: Lightning has Serrated Slash', () => {
  assert.ok(sandboxDeckCards('lightning').includes('serratedSlash'));
  for (const id of ['staticCharge', 'stormFront', 'overcharge'] as const)
    assert.ok(sandboxDeckCards('lightning').includes(id), id);
  assert.ok(!sandboxDeckCards('lightning').includes('darkCloak'));
  const fight = createSandbox(7, 'lightning');
  const all = [...fight.hand, ...fight.drawPile];
  assert.ok(all.every((id) => sandboxDeckCards('lightning').includes(id)));
});

void test('Fire, Poison and Bleed decks: every attack lays its status', () => {
  const themes = [
    ['fire', ['burn']],
    ['poison', ['poison']],
    ['bleed', ['bleed']],
  ] as const;
  for (const [deckId, status] of themes) {
    const cards = [...new Set(sandboxDeckCards(deckId))].map(getCard);
    assert.ok(cards.length >= 5, `${deckId} has ${cards.length}`);
    const attacks = cards.filter((card) =>
      card.effects.some((effect) => effect.kind === 'damage')
    );
    for (const card of attacks)
      assert.ok(
        card.effects.some((effect) =>
          (status as readonly string[]).includes(effect.kind)
        ),
        `${card.name} lays ${status}`
      );
  }
  assert.ok(!sandboxDeckCards('afflictions').includes('venomDart'));
});
void test('custom deck saves preserve distinct IDs and exact copy counts through editing and restoration', () => {
  const initial = restoreTrainingDecks(null);
  const hundred = Array<CardId>(100).fill('backhand');
  const first = saveTrainingDeck(initial, 'a', '  Hundred  ', hundred, false);
  assert.equal(first.customDecks[0]?.name, 'Hundred');
  assert.deepEqual(activeTrainingCards(first), hundred);
  assert.deepEqual(restoreTrainingDecks(JSON.parse(JSON.stringify(first))), first);
  assert.equal(saveTrainingDeck(first, 'a', 'bad', [...hundred, 'backhand'], true), first);
  assert.equal(saveTrainingDeck(first, 'a', 'bad', [], true), first);
  assert.equal(saveTrainingDeck(first, 'missing', 'bad', hundred, true), first);
  const invalid = restoreTrainingDecks({ customDecks: [{ id: 'broken', name: 'bad', cards: ['unknown'] }], activeCustomId: 'broken' });
  assert.equal(invalid.activeCustomId, null);
  const second = saveTrainingDeck(first, 'b', 'Second', ['frostBolt'], false);
  const edited = saveTrainingDeck(second, 'a', 'Pair', ['backhand', 'backhand'], true);
  assert.equal(edited.customDecks.length, 2);
  assert.equal(edited.activeCustomId, 'a');
  assert.deepEqual(edited.customDecks[1], second.customDecks[1]);
  assert.deepEqual(activeTrainingCards(edited), ['backhand', 'backhand']);
});

void test('custom deck hand, draw pile, scenarios, and subsequent hordes use the saved copies', () => {
  const deck = Array<CardId>(100).fill('backhand');
  const cardsOf = (combat: ReturnType<typeof createSandbox>) =>
    [...combat.hand, ...combat.drawPile, ...combat.discardPile].sort();
  assert.deepEqual(cardsOf(createSandbox(15, deck)), deck);
  assert.throws(() => createSandbox(15, [...deck, 'backhand']), RangeError);
  const scenario = createSandboxWith(25, ['squire'], true, deck);
  assert.deepEqual(cardsOf(scenario), deck);
  const enemy = { ...scenario.heroes[0]!, hp: 1 };
  const next = stepSandbox({ ...scenario, heroes: [enemy] }, { type: 'playCard', handIndex: 0, targetUid: enemy.uid });
  assert.equal(next.victory, true);
  assert.deepEqual(cardsOf(next.combat), deck);
  assert.deepEqual(cardsOf(createSandbox(7, ['frostBolt'])), ['frostBolt']);
});

void test('training defeat can retry the same encounter with its deck, restored HP, and current character', () => {
  const character = createCharacter();
  const deck: CardId[] = ['backhand', 'backhand', 'backhand'];
  const opening = createSandboxWith(11, ['squire'], true, deck, character.traits);
  const weak = { ...opening, player: { ...opening.player, hp: 1 } };
  const lost = stepSandbox(weak, { type: 'endTurn' });
  assert.equal(lost.victory, false);
  assert.equal(lost.combat.player.hp, 0);
  const trained = { ...character, traits: { ...character.traits, vigor: 64 } };
  const retry = retryTrainingFight(opening, trained);
  assert.deepEqual(retry.heroes, opening.heroes);
  assert.deepEqual(retry.hand, opening.hand);
  assert.equal(retry.player.hp, characterBonuses(trained.traits).maxHp);
  assert.equal(retry.player.traits?.vigor, 64);
  assert.equal(retry.turn, opening.turn);
});

void test('scenarios are grouped by unit type: Angels, Dragons, Beasts, Humans, Demi-humans', () => {
  const groups = groupScenariosByUnitType();
  assert.deepEqual(groups.map((group) => group.label), ['Angels', 'Dragons', 'Beasts', 'Humans', 'Demi-humans']);
  // Every scenario lands in exactly one section.
  const grouped = groups.flatMap((group) => group.scenarios.map((scenario) => scenario.id));
  assert.deepEqual([...grouped].sort(), SANDBOX_SCENARIOS.map((scenario) => scenario.id).sort());
  const idsOf = (label: string) => groups.find((group) => group.label === label)?.scenarios.map((scenario) => scenario.id);
  assert.deepEqual(idsOf('Dragons'), ['fulgurDragonknight', 'holyDragon', 'tempestWyrm']);
  assert.deepEqual(idsOf('Beasts'), ['wolfPack', 'grandGriffon']);
  // The Mage Borne bosses are Demi-humans, not Humans.
  assert.deepEqual(idsOf('Demi-humans'), ['mageBorneAstra', 'mageBorneAzula']);
  // Angel Mage is filed by its lead, not the sentinel standing in front.
  assert.ok(idsOf('Angels')?.includes('angelMage'));
});
