// ===================================================================
// THREE-ROW FIELD TESTS
// The Front line, the Backline and the Horizon: moving between rows,
// Charge and Back Step, Piercing down a column, Out of Range misses
// (both ways), Longrange, and the cap on cells heroes may fill.
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceHeroes,
  canPull,
  canPush,
  freeHeroCells,
  heroesPiercedPast,
  pullHero,
  pushHero,
  summonSeats,
} from './battlefield.ts';
import { type CardId } from './cards.ts';
import { endTurn, endTurnSteps, playCard, startCombat } from './combat.ts';
import { FEATURES } from './features.ts';
import { canImbueOnto } from './imbue.ts';
import type { HeroId } from './heroes.ts';
import { move } from './movement.ts';
import { MAX_HERO_CELLS, OUT_OF_RANGE_HIT_CHANCE } from './rules.ts';
import type { CombatState, HeroRow, HeroUnit } from './types.ts';

// This file plays the three-row field (off by default, see features.ts).
FEATURES.threeRowField = true;

// --- FIXTURES ---
/** Where to stand one hero: its catalog id, row and column. */
type Spot = [HeroId, HeroRow, number];

/**
 * A fight with heroes standing exactly at `spots` (uids in spot order),
 * the given hand, plenty of energy, and the rng seeded with `seed`.
 */
const fightAt = (spots: Spot[], hand: CardId[] = [], seed = 3): CombatState => {
  const fresh = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['darkCloak'],
    heroIds: spots.map(([heroId]) => heroId),
    might: 1,
    seed,
  });
  return {
    ...fresh,
    heroes: fresh.heroes.map((unit, index) => {
      const [, row, col] = spots[index] ?? ['squire', 'front', 0];
      // uid = spot index, so tests can name heroes by their spot.
      return { ...unit, uid: index, row, col };
    }),
    nextUid: spots.length,
    hand,
    energy: 20,
  };
};

/** The hero with this uid (it must be on the field). */
const unitAt = (state: CombatState, uid: number): HeroUnit => {
  const unit = state.heroes.find((hero) => hero.uid === uid);
  if (!unit) throw new Error(`uid ${uid} is not on the field`);
  return unit;
};

/** "row:col" for each hero, in uid order. */
const placesOf = (heroes: readonly HeroUnit[]): string[] =>
  [...heroes]
    .sort((a, b) => a.uid - b.uid)
    .map((unit) => `${unit.row}:${unit.col}`);

// --- FORMATION AND ADVANCING ---
void test('a horde marches in a row behind home, then heads home', () => {
  const fresh = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['darkCloak'],
    heroIds: ['squire', 'priest'],
    might: 1,
    seed: 1,
  });
  assert.deepEqual(
    fresh.heroes.map((unit) => unit.row),
    ['back', 'horizon']
  );
  const after = endTurn(fresh);
  assert.deepEqual(
    after.heroes.map((unit) => unit.row),
    ['front', 'back']
  );
});

void test('heroes step one row toward home per turn, never past it', () => {
  const heroes = fightAt([
    ['squire', 'horizon', 0],
    ['priest', 'horizon', 2],
    ['archer', 'front', 1],
  ]).heroes;
  // The Squire comes in one row (not two); the Priest reaches the
  // Backline; the Archer, already nearer than home, stays put.
  assert.deepEqual(placesOf(advanceHeroes(heroes)), [
    'back:0',
    'back:2',
    'front:1',
  ]);
});

// --- PULL AND PUSH (ONE ROW AT A TIME) ---
void test('Force Pull and Force Push move a hero exactly one row', () => {
  const heroes = fightAt([
    ['squire', 'front', 1],
    ['priest', 'horizon', 1],
  ]).heroes;
  const [squire, priest] = heroes;
  assert.ok(squire && priest);
  assert.equal(
    unitAt({ heroes: pullHero(heroes, priest.uid) } as CombatState, priest.uid)
      .row,
    'back'
  );
  assert.equal(
    unitAt({ heroes: pushHero(heroes, squire.uid) } as CombatState, squire.uid)
      .row,
    'back'
  );
  assert.equal(canPull(heroes, squire), false, 'nothing nearer than front');
  assert.equal(canPush(heroes, priest), false, 'nothing past the Horizon');
});

// --- CHARGE AND BACK STEP ---
void test('Charge closes up to two rows, until someone is in front', () => {
  const farOff = move(
    fightAt([
      ['squire', 'horizon', 0],
      ['priest', 'horizon', 2],
    ]),
    'charge'
  );
  assert.deepEqual(placesOf(farOff.heroes), ['front:0', 'front:2']);
  const split = move(
    fightAt([
      ['squire', 'back', 0],
      ['priest', 'horizon', 2],
    ]),
    'charge'
  );
  assert.deepEqual(placesOf(split.heroes), ['front:0', 'back:2']);
  assert.equal(split.player.statuses.momentum, 1);
});

void test('Back Step always falls back exactly one row', () => {
  const after = move(
    fightAt([
      ['squire', 'front', 0],
      ['shieldmaiden', 'front', 2],
    ]),
    'backStep'
  );
  assert.deepEqual(placesOf(after.heroes), ['back:0', 'back:2']);
});

// --- PIERCING ---
void test('Piercing runs down the whole column, every row', () => {
  const state = fightAt(
    [
      ['squire', 'front', 0],
      ['priest', 'back', 0],
      ['bard', 'horizon', 0],
      ['rogue', 'back', 2],
    ],
    ['impale']
  );
  const [squire, priest, bard] = state.heroes;
  assert.ok(squire && priest && bard);
  assert.deepEqual(
    heroesPiercedPast(state.heroes, priest).map((unit) => unit.heroId),
    ['squire', 'bard']
  );
  // Impale is Melee: Out of Range never applies, so all three are hit.
  const after = playCard(state, 0, squire.uid);
  for (const unit of [squire, priest, bard])
    assert.ok(unitAt(after, unit.uid).hp < unit.hp, unit.heroId);
  assert.equal(unitAt(after, 3).hp, unitAt(state, 3).hp, 'other column');
});

// --- OUT OF RANGE ---
/** Plays `cardId` at a Priest on the Horizon, once per seed. */
const shotsIntoHorizon = (cardId: CardId, seeds: number) =>
  Array.from({ length: seeds }, (_, index) => {
    const state = fightAt([['priest', 'horizon', 1]], [cardId], index + 1);
    const priest = unitAt(state, 0);
    const after = playCard(state, 0, priest.uid);
    // A big enough shot slays the Priest outright: that landed too.
    const hit = after.heroes.find((unit) => unit.uid === priest.uid);
    return {
      landed: hit === undefined || hit.hp < priest.hp,
      missed: (hit?.missedShots ?? 0) > 0,
    };
  });

void test('Range and Magic shots into the Horizon land about half the time', () => {
  for (const cardId of ['spiteBolt', 'hexfire'] as CardId[]) {
    const shots = shotsIntoHorizon(cardId, 200);
    const landed = shots.filter((shot) => shot.landed).length / shots.length;
    assert.ok(
      Math.abs(landed - OUT_OF_RANGE_HIT_CHANCE) < 0.12,
      `${cardId}: ${landed}`
    );
    // Every shot either lands or counts as a miss, never both.
    assert.ok(shots.every((shot) => shot.landed !== shot.missed));
  }
});

void test('the same shot into the Backline always lands', () => {
  const state = fightAt([['priest', 'back', 1]], ['spiteBolt']);
  const after = playCard(state, 0, 0);
  assert.ok(unitAt(after, 0).hp < unitAt(state, 0).hp);
});

void test('a miss is seeded: the same fight misses the same way', () => {
  assert.deepEqual(
    shotsIntoHorizon('spiteBolt', 20),
    shotsIntoHorizon('spiteBolt', 20)
  );
});

void test('Longrange cards never miss into the Horizon', () => {
  const shots = shotsIntoHorizon('soulLance', 40);
  assert.ok(shots.every((shot) => shot.landed));
});

void test('an Eagle Eye imbue gives a shot Longrange', () => {
  const shots = Array.from({ length: 40 }, (_, index) => {
    const state = fightAt(
      [['priest', 'horizon', 1]],
      ['eagleEye', 'spiteBolt'],
      index + 1
    );
    const imbued = playCard(state, 0, -1, undefined, 1);
    const after = playCard(imbued, 0, 0);
    return unitAt(after, 0).hp < unitAt(state, 0).hp;
  });
  assert.ok(shots.every(Boolean));
});

void test('an imbue only lands with a shot that lands', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const state = fightAt(
      [['priest', 'horizon', 1]],
      ['venomCoat', 'spiteBolt'],
      seed
    );
    const after = playCard(playCard(state, 0, -1, undefined, 1), 0, 0);
    const priest = after.heroes.find((unit) => unit.uid === 0);
    if (!priest) continue;
    const isHit = priest.hp < unitAt(state, 0).hp;
    assert.equal((priest.statuses.poison ?? 0) > 0, isHit, `seed ${seed}`);
  }
});

void test('Longrange goes on Range and Magic damage cards only', () => {
  const gift = { kind: 'keyword', keyword: 'longRange' } as const;
  assert.equal(canImbueOnto(gift, 'spiteBolt', []), true);
  assert.equal(canImbueOnto(gift, 'hexfire', []), true);
  assert.equal(canImbueOnto(gift, 'backhand', []), false);
  assert.equal(canImbueOnto(gift, 'boneWard', []), false);
});

/** How a Priest's Smite (Magic) from `row` lands on the villain, per seed. */
const smitesFrom = (heroId: HeroId, row: HeroRow, seeds: number) =>
  Array.from({ length: seeds }, (_, index) => {
    const state = fightAt([[heroId, row, 1]], [], index + 1);
    const steps = endTurnSteps(state);
    const acted = steps[1]?.state ?? state;
    return {
      landed: acted.player.hp < state.player.hp,
      missed: (acted.player.missedShots ?? 0) > 0,
    };
  });

void test('heroes shooting from the Horizon land about half the time', () => {
  const shots = smitesFrom('priest', 'horizon', 200);
  const landed = shots.filter((shot) => shot.landed).length / shots.length;
  assert.ok(Math.abs(landed - OUT_OF_RANGE_HIT_CHANCE) < 0.12, `${landed}`);
  assert.ok(smitesFrom('priest', 'back', 30).every((shot) => shot.landed));
});

void test('a Longrange hero (the Archer) never misses from the Horizon', () => {
  const shots = smitesFrom('archer', 'horizon', 40);
  assert.ok(shots.every((shot) => shot.landed && !shot.missed));
});

// --- CELL CAP ---
void test('heroes never fill more than the cell cap: summons fizzle', () => {
  const state = fightAt([
    ['paladin', 'front', 0],
    ['archmage', 'back', 0],
    ['priest', 'horizon', 0],
  ]);
  // 2 + 2 + 1 = 5 cells filled: room for one more grunt, not two.
  assert.equal(freeHeroCells(state.heroes), MAX_HERO_CELLS - 5);
  const priest = unitAt(state, 2);
  assert.equal(summonSeats(state.heroes, priest, 1, 2).length, 1);
});
