// ===================================================================
// BATTLEFIELD TESTS
// Rows, sizes, melee vs Reach, pulls, pushes and stepping forward.
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES } from './features.ts';
import {
  advanceHeroes,
  canPull,
  legalTargets,
  sizeOf,
  targetRuleOf,
} from './battlefield.ts';
import {
  ALL_CARD_IDS,
  cardsOfRarity,
  getCard,
  hasKeyword,
  isCardInPlay,
  type CardId,
} from './cards.ts';
import {
  canPlayCard,
  endTurn,
  passivesOf,
  playCard,
  startCombat,
} from './combat.ts';
import { canMove, move } from './movement.ts';
import { CHARGE_COST } from './rules.ts';
import type { HeroId } from './heroes.ts';
import { ELITE_IDS, GRUNT_IDS } from './heroes.ts';
import type { CombatState, HeroUnit } from './types.ts';

// This file checks the two-row field (rows.test.ts covers three rows).
FEATURES.threeRowField = false;

// --- FIXTURES ---
/** A fresh fight against `heroIds`, as it forms up (in the back row). */
const freshFight = (heroIds: HeroId[]): CombatState =>
  startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['darkCloak'],
    heroIds,
    might: 1,
    seed: 3,
  });

/**
 * A fight against `heroIds` once the lines have settled (melee heroes
 * stepped up), with a big hand of the given cards.
 */
const fight = (heroIds: HeroId[], hand: CardId[]): CombatState => {
  const fresh = freshFight(heroIds);
  return { ...fresh, heroes: advanceHeroes(fresh.heroes), hand, energy: 9 };
};

/** Finds a hero on the field by catalog id. */
const unitOf = (state: CombatState, heroId: HeroId): HeroUnit => {
  const unit = state.heroes.find((hero) => hero.heroId === heroId);
  if (!unit) throw new Error(`${heroId} is not on the field`);
  return unit;
};

// --- FORMATION ---
void test('a new horde forms up in the back row, overflow in front', () => {
  const fresh = freshFight(['bard', 'squire', 'archer']);
  assert.ok(fresh.heroes.every((unit) => unit.row === 'back'));
  const crowded = freshFight(['paladin', 'shieldmaiden', 'archer', 'rogue']);
  // The back row has one seat left after the ranged heroes: the
  // Shieldmaiden drops back into it; the Paladin (size 2) stays in front.
  assert.equal(unitOf(crowded, 'archer').row, 'back');
  assert.equal(unitOf(crowded, 'rogue').row, 'back');
  assert.equal(unitOf(crowded, 'shieldmaiden').row, 'back');
  assert.equal(unitOf(crowded, 'paladin').row, 'front');
});

void test('melee heroes step up at the end of the heroes turn; ranged hold', () => {
  const after = endTurn(freshFight(['bard', 'squire', 'archer']));
  assert.equal(unitOf(after, 'squire').row, 'front');
  assert.equal(unitOf(after, 'bard').row, 'back');
  assert.equal(unitOf(after, 'archer').row, 'back');
});

void test('a champion forms up in the back row and then fills the front', () => {
  const fresh = freshFight(['valen']);
  assert.equal(unitOf(fresh, 'valen').row, 'back');
  const after = endTurn(fresh);
  assert.deepEqual(
    { row: unitOf(after, 'valen').row, col: unitOf(after, 'valen').col },
    { row: 'front', col: 0 }
  );
});

void test('an all-ranged horde holds the back row until a Charge', () => {
  const state = endTurn(fight(['archer', 'priest'], []));
  assert.ok(state.heroes.every((unit) => unit.row === 'back'));
  assert.ok(canMove(state, 'charge'));
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
  const legal = legalTargets(state.heroes, targetRuleOf('backhand'), 'melee');
  assert.deepEqual(
    legal.map((unit) => unit.heroId),
    ['squire']
  );
});

void test('Reach and curses can hit the back row', () => {
  const state = fight(['squire', 'priest'], ['spiteBolt']);
  const priest = unitOf(state, 'priest');
  const after = playCard(state, 0, priest.uid);
  // 6, +30% for a Range card at its proper range (the back row).
  assert.equal(unitOf(after, 'priest').hp, priest.hp - 8);
  assert.equal(targetRuleOf('whisperHex'), 'any');
});

void test('a card type decides its reach: only Range, Magic and Curse reach', () => {
  for (const cardId of ALL_CARD_IDS) {
    const { type, reach } = getCard(cardId);
    const isShort = !['range', 'magic', 'curse'].includes(type);
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
  assert.equal(unitOf(after, 'archer').statuses.hex, 2);
});

void test('a pull slides the front row over to make room', () => {
  // Squire front-left, Rogue front-middle, Archer back-left (behind the
  // Squire), front-right empty: the Archer takes the left, the Squire
  // slides to the middle and the Rogue to the right.
  const base = fight(['squire', 'rogue', 'archer'], ['chainsOfGrief']);
  const state: CombatState = {
    ...base,
    heroes: base.heroes.map((unit) => {
      if (unit.heroId === 'squire') return { ...unit, row: 'front', col: 0 };
      if (unit.heroId === 'rogue') return { ...unit, row: 'front', col: 1 };
      return { ...unit, row: 'back', col: 0 };
    }),
  };
  const archer = unitOf(state, 'archer');
  assert.ok(canPull(state.heroes, archer));
  const after = playCard(state, 0, archer.uid);
  assert.deepEqual(
    ['archer', 'squire', 'rogue'].map((id) => {
      const unit = unitOf(after, id as HeroId);
      return `${unit.row}:${unit.col}`;
    }),
    ['front:0', 'front:1', 'front:2']
  );
});

void test('a full front row blocks the pull', () => {
  const base = fight(
    ['squire', 'rogue', 'shieldmaiden', 'priest'],
    ['chainsOfGrief']
  );
  const state: CombatState = {
    ...base,
    heroes: base.heroes.map((unit, index) =>
      unit.heroId === 'priest'
        ? { ...unit, row: 'back', col: 1 }
        : { ...unit, row: 'front', col: index }
    ),
  };
  assert.equal(canPull(state.heroes, unitOf(state, 'priest')), false);
  assert.equal(canPlayCard(state, 0), false);
});

void test('a push sends a front-row hero back and the field re-forms', () => {
  const state = fight(['squire', 'shieldmaiden'], ['hurlAside']);
  const maiden = unitOf(state, 'shieldmaiden');
  const after = playCard(state, 0, maiden.uid);
  assert.equal(unitOf(after, 'shieldmaiden').row, 'back');
  assert.equal(unitOf(after, 'squire').row, 'front');
});

void test('when the front row falls, the back row holds until a Charge', () => {
  const state = fight(['squire', 'priest'], ['ruin']);
  const after = playCard(state, 0, unitOf(state, 'squire').uid);
  assert.equal(after.heroes.length, 1);
  assert.equal(unitOf(after, 'priest').row, 'back');
  assert.equal(canMove(after, 'charge'), true);
  const charged = move(after, 'charge');
  assert.equal(unitOf(charged, 'priest').row, 'front');
  assert.equal(charged.energy, after.energy - CHARGE_COST);
  assert.equal(canMove(charged, 'charge'), false);
});

void test('Charge is refused while anyone holds the front or energy is short', () => {
  const state = fight(['squire', 'priest'], []);
  assert.equal(canMove(state, 'charge'), false);
  assert.equal(move(state, 'charge'), state);
  const felled = playCard(
    fight(['squire', 'priest'], ['ruin']),
    0,
    unitOf(state, 'squire').uid
  );
  const broke = { ...felled, energy: 0 };
  assert.equal(canMove(broke, 'charge'), false);
  assert.equal(move(broke, 'charge'), broke);
});

void test('charging gives Momentum: the next Melee card hits 50% harder, once', () => {
  const felled = playCard(
    fight(['squire', 'priest'], ['ruin', 'twinDaggers', 'backhand']),
    0,
    unitOf(fight(['squire', 'priest'], []), 'squire').uid
  );
  const charged = move({ ...felled, energy: 3 }, 'charge');
  assert.equal(charged.player.statuses.momentum, 1);
  const priest = unitOf(charged, 'priest');
  // Backhand: 6 x 1.5 = 9, and Momentum is spent.
  const struck = playCard(charged, 1, priest.uid);
  assert.equal(priest.hp - unitOf(struck, 'priest').hp, 9);
  assert.equal(struck.player.statuses.momentum, 0);
});

void test('a front-row sweep cannot be played while the front row is empty', () => {
  const felled = playCard(
    fight(['squire', 'priest'], ['ruin', 'cleave', 'plague', 'drain']),
    0,
    unitOf(fight(['squire', 'priest'], []), 'squire').uid
  );
  // Hand is now Cleave, Plague, Drain; only the Priest (back row) is left.
  assert.equal(canPlayCard(felled, 0), false);
  assert.equal(canPlayCard(felled, 1), true);
  assert.equal(canPlayCard(felled, 2), false);
  assert.equal(playCard(felled, 0, -1), felled);
});

void test('Momentum unused by the end of the turn is lost', () => {
  const felled = playCard(
    fight(['squire', 'priest'], ['ruin', 'darkCloak']),
    0,
    unitOf(fight(['squire', 'priest'], []), 'squire').uid
  );
  const charged = move({ ...felled, energy: 3 }, 'charge');
  assert.equal(charged.player.statuses.momentum, 1);
  assert.equal(endTurn(charged).player.statuses.momentum, 0);
});

void test('Guard cards are Defend; Buff keeps the true buffs', () => {
  for (const cardId of ALL_CARD_IDS) {
    const { type, effects } = getCard(cardId);
    const isMainlyGuard = effects[0]?.kind === 'guard';
    if (type === 'defend' || type === 'buff')
      assert.equal(type === 'defend', isMainlyGuard, cardId);
  }
});

// --- THREE-ROW FLAG OFF (see rows.test.ts for it on) ---
void test('with the three-row flag off, Longrange is neither printed nor offered', () => {
  assert.equal(hasKeyword('soulLance', 'longRange'), false);
  assert.equal(hasKeyword('soulLance', 'hold'), true);
  assert.equal(isCardInPlay('eagleEye'), false);
  assert.ok(!cardsOfRarity('uncommon').includes('eagleEye'));
  assert.deepEqual(passivesOf({ heroId: 'archer' }), []);
});
