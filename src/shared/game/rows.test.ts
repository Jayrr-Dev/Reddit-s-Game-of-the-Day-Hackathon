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
  cellsOf,
  freeHeroCells,
  heroesPiercedPast,
  pullHero,
  pushHero,
  summonSeats,
} from './battlefield.ts';
import { type CardId } from './cards.ts';
import {
  endTurn,
  endTurnSteps,
  hasLongRangePassive,
  playCard,
  startCombat,
} from './combat.ts';
import { FEATURES } from './features.ts';
import { canImbueOnto } from './imbue.ts';
import { getHero, type HeroId } from './heroes.ts';
import { canMove, move, movementBlockReason } from './movement.ts';
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

void test('Back Step works with heroes behind Line 1, when there is room', () => {
  const state = fightAt([
    ['lysa', 'front', 0],
    ['squire', 'horizon', 1],
  ]);
  assert.ok(canMove(state, 'backStep'));
  // Lysa falls back to Line 2; the Squire is already on the last line.
  assert.deepEqual(placesOf(move(state, 'backStep').heroes), [
    'back:0',
    'horizon:1',
  ]);
});

void test('Back Step moves everyone back a line where there is room', () => {
  const after = move(
    fightAt([
      ['squire', 'front', 0],
      ['priest', 'back', 2],
    ]),
    'backStep'
  );
  assert.deepEqual(placesOf(after.heroes), ['back:0', 'horizon:2']);
});

void test('with nobody on Line 1 there is no Back Step (Charge instead)', () => {
  const state = fightAt([['squire', 'back', 0]]);
  assert.equal(canMove(state, 'backStep'), false);
  assert.ok(canMove(state, 'charge'));
});

void test('a deep boss Back Steps as a whole, then walks back in', () => {
  const state = fightAt([['grandGriffon', 'front', 1]]);
  assert.ok(canMove(state, 'backStep'));
  assert.equal(movementBlockReason(state, 'backStep'), null);
  const after = move(state, 'backStep');
  const griffon = unitAt(after, 0);
  assert.deepEqual(
    cellsOf(griffon).map((cell) => `${cell.row}:${cell.col}`),
    ['back:1', 'horizon:1']
  );
  // Still immovable by Force Pull / Push.
  assert.equal(canPull(after.heroes, griffon), false);
  assert.equal(
    unitAt({ heroes: advanceHeroes(after.heroes) } as CombatState, 0).row,
    'front'
  );
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

void test('the Archer has no Longrange: it misses from the Horizon too', () => {
  // Its Volley fires 3 arrows, so count the turns where one missed.
  const shots = smitesFrom('archer', 'horizon', 40);
  assert.ok(shots.some((shot) => shot.missed));
});

void test('the Ballista fills 2 cells side by side and has Longrange', () => {
  const state = fightAt([['ballista', 'back', 0]]);
  const ballista = unitAt(state, 0);
  assert.equal(getHero('ballista').size, 2);
  assert.equal(freeHeroCells(state.heroes), MAX_HERO_CELLS - 2);
  assert.ok(hasLongRangePassive(ballista));
  // Its bolts land from Line 3, where other shooters miss.
  const shots = Array.from({ length: 30 }, (_, index) => {
    const far = fightAt([['ballista', 'horizon', 0]], [], index + 1);
    const steps = endTurnSteps(far);
    return steps.some((step) => step.state.player.hp < far.player.hp);
  });
  assert.ok(shots.every(Boolean));
});

void test('the Ballista is Anchored: nothing pushes it, but you can close in', () => {
  const state = fightAt([
    ['squire', 'front', 0],
    ['ballista', 'back', 1],
  ]);
  const ballista = unitAt(state, 1);
  assert.equal(canPull(state.heroes, ballista), false);
  assert.equal(canPush(state.heroes, ballista), false);
  // You step back: it ends up a line farther, like everyone.
  assert.deepEqual(placesOf(move(state, 'backStep').heroes), [
    'back:0',
    'horizon:1',
  ]);
  // Alone, you can Charge up to it and hit it in Melee.
  const lone = fightAt([['ballista', 'back', 1]]);
  assert.ok(canMove(lone, 'charge'));
  assert.equal(unitAt(move(lone, 'charge'), 0).row, 'front');
  // It starts on the farthest line and never walks on its own.
  const fresh = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['darkCloak'],
    heroIds: ['ballista'],
    might: 1,
    seed: 1,
  });
  assert.equal(fresh.heroes[0]?.row, 'horizon', 'starts farthest back');
  const far = fightAt([['ballista', 'horizon', 1]]);
  assert.equal(advanceHeroes(far.heroes)[0]?.row, 'horizon');
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
