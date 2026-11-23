// ===================================================================
// BATTLEFIELD TESTS
// Rows, sizes, melee vs Reach, pulls, pushes and stepping forward.
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPull, legalTargets, sizeOf, targetRuleOf } from './battlefield.ts';
import { ALL_CARD_IDS, getCard, type CardId } from './cards.ts';
import { canPlayCard, playCard, startCombat } from './combat.ts';
import type { HeroId } from './heroes.ts';
import { ELITE_IDS, GRUNT_IDS } from './heroes.ts';
import type { CombatState, HeroUnit } from './types.ts';

// --- FIXTURES ---
/** A fight against `heroIds` with a big hand of the given cards. */
const fight = (heroIds: HeroId[], hand: CardId[]): CombatState => ({
  ...startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['darkCloak'],
    heroIds,
    might: 1,
    seed: 3,
  }),
  hand,
  energy: 9,
});

/** Finds a hero on the field by catalog id. */
const unitOf = (state: CombatState, heroId: HeroId): HeroUnit => {
  const unit = state.heroes.find((hero) => hero.heroId === heroId);
  if (!unit) throw new Error(`${heroId} is not on the field`);
  return unit;
};

// --- FORMATION ---
void test('fighters take the front row and support heroes the back', () => {
  const state = fight(['bard', 'squire', 'archer'], []);
  assert.equal(unitOf(state, 'squire').row, 'front');
  assert.equal(unitOf(state, 'squire').col, 1);
  assert.equal(unitOf(state, 'bard').row, 'back');
  assert.equal(unitOf(state, 'archer').row, 'back');
});

void test('a champion fills the whole front row', () => {
  const state = fight(['valen'], []);
  assert.deepEqual(
    { row: unitOf(state, 'valen').row, col: unitOf(state, 'valen').col },
    { row: 'front', col: 0 }
  );
});

void test('an all-back horde steps forward so it can be fought', () => {
  const state = fight(['archer', 'priest'], []);
  assert.ok(state.heroes.every((unit) => unit.row === 'front'));
});

void test('every horde the kingdom can roll fits on the field', () => {
  const pairs = GRUNT_IDS.flatMap((a) => GRUNT_IDS.map((b) => [a, b]));
  const hordes = [
    ...pairs.flatMap(([a, b]) =>
      GRUNT_IDS.map((c) => [a, b, c].filter((id) => id !== undefined))
    ),
    ...ELITE_IDS.flatMap((elite) => GRUNT_IDS.map((g) => [g, elite])),
  ];
  for (const horde of hordes) {
    const { heroes } = fight(horde, []);
    const cells = heroes.flatMap((unit) =>
      Array.from(
        { length: sizeOf(unit) },
        (_, i) => `${unit.row}${unit.col + i}`
      )
    );
    assert.equal(
      new Set(cells).size,
      cells.length,
      `overlap in ${horde.join()}`
    );
    assert.ok(cells.every((cell) => Number(cell.slice(-1)) < 3));
  }
});

// --- TARGETING ---
void test('melee cards only reach the front row', () => {
  const state = fight(['squire', 'priest'], ['backhand']);
  const legal = legalTargets(state.heroes, targetRuleOf('backhand'));
  assert.deepEqual(
    legal.map((unit) => unit.heroId),
    ['squire']
  );
});

void test('Reach and curses can hit the back row', () => {
  const state = fight(['squire', 'priest'], ['spiteBolt']);
  const priest = unitOf(state, 'priest');
  const after = playCard(state, 0, priest.uid);
  assert.equal(unitOf(after, 'priest').hp, priest.hp - 6);
  assert.equal(targetRuleOf('whisperHex'), 'any');
});

void test('a card type decides its reach: only Melee and Buff stay short', () => {
  for (const cardId of ALL_CARD_IDS) {
    const { type, reach } = getCard(cardId);
    const isShort = type === 'melee' || type === 'buff';
    assert.equal(reach, !isShort, `${cardId} (${type})`);
  }
  assert.equal(targetRuleOf('cruelSlash'), 'front');
  assert.equal(targetRuleOf('mourningCurse'), 'any');
});

void test('a melee play aimed at the back row lands on the front instead', () => {
  const state = fight(['squire', 'priest'], ['backhand']);
  const after = playCard(state, 0, unitOf(state, 'priest').uid);
  assert.equal(unitOf(after, 'priest').hp, unitOf(state, 'priest').hp);
  assert.equal(unitOf(after, 'squire').hp, unitOf(state, 'squire').hp - 6);
});

void test('melee area attacks sweep the front row only', () => {
  const state = fight(['squire', 'priest'], ['cleave']);
  const after = playCard(state, 0, 0);
  assert.equal(unitOf(after, 'priest').hp, unitOf(state, 'priest').hp);
  assert.ok(unitOf(after, 'squire').hp < unitOf(state, 'squire').hp);
});

// --- PULL AND PUSH ---
void test('a pull drags an unblocked back-row hero forward', () => {
  const state = fight(['squire', 'archer'], ['chainsOfGrief']);
  const archer = unitOf(state, 'archer');
  assert.ok(canPull(state.heroes, archer));
  const after = playCard(state, 0, archer.uid);
  assert.equal(unitOf(after, 'archer').row, 'front');
  assert.equal(unitOf(after, 'archer').hp, archer.hp - 5);
});

void test('a hero standing in front blocks the pull', () => {
  // The squire takes the middle column; put the priest right behind it.
  const base = fight(['squire', 'priest'], ['chainsOfGrief']);
  const squire = unitOf(base, 'squire');
  const state: CombatState = {
    ...base,
    heroes: base.heroes.map((unit) =>
      unit.heroId === 'priest' ? { ...unit, col: squire.col } : unit
    ),
  };
  assert.equal(canPull(state.heroes, unitOf(state, 'priest')), false);
  assert.equal(canPlayCard(state, 0), false);
});

void test('a push sends a front-row hero back and the field re-forms', () => {
  const state = fight(['squire', 'rogue'], ['hurlAside']);
  const rogue = unitOf(state, 'rogue');
  const after = playCard(state, 0, rogue.uid);
  assert.equal(unitOf(after, 'rogue').row, 'back');
  assert.equal(unitOf(after, 'squire').row, 'front');
});

void test('when the front row falls, the back row steps forward', () => {
  const state = fight(['squire', 'priest'], ['undyingHatred']);
  const after = playCard(state, 0, unitOf(state, 'squire').uid);
  assert.equal(after.heroes.length, 1);
  assert.equal(unitOf(after, 'priest').row, 'front');
});
