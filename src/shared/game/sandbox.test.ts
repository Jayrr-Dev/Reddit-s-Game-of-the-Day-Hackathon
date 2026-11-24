// ===================================================================
// SANDBOX TESTS
// Target dummies: hordes always fit, energy refills, and clearing the
// field brings a fresh horde with new uids.
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizeOf } from './battlefield.ts';
import {
  createSandbox,
  createSandboxWith,
  rollDummies,
  sandboxReducer,
} from './sandbox.ts';
import { ENERGY_PER_TURN } from './rules.ts';
import type { HeroUnit } from './types.ts';

// --- HELPERS ---
/** Every (row, column) cell a hero stands in, as "row:col". */
const cellsOf = (unit: HeroUnit): string[] =>
  Array.from({ length: sizeOf(unit) }, (_, i) => `${unit.row}:${unit.col + i}`);

// --- TESTS ---
void test('every rolled horde fits the field without overlap', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const { heroes } = createSandbox(seed);
    const [heroIds] = rollDummies(seed);
    assert.ok(heroIds.length >= 2, `seed ${seed} rolled too few`);
    const cells = heroes.flatMap(cellsOf);
    assert.equal(new Set(cells).size, cells.length, `seed ${seed} overlaps`);
    assert.ok(heroes.every((unit) => unit.col + sizeOf(unit) <= 3));
  }
});

void test('energy refills after every play', () => {
  const start = createSandbox(7);
  const after = sandboxReducer(start, { type: 'endTurn' });
  assert.ok(after.energy >= ENERGY_PER_TURN);
});

void test('clearing the field brings a new horde with higher uids', () => {
  const start = createSandbox(11);
  const oneLeft = {
    ...start,
    hand: ['cataclysm' as const],
    heroes: start.heroes
      .slice(0, 1)
      .map((unit) => ({ ...unit, hp: 1, shroud: 0 })),
  };
  const next = sandboxReducer(oneLeft, {
    type: 'playCard',
    handIndex: 0,
    targetUid: oneLeft.heroes[0]!.uid,
  });
  assert.ok(next.heroes.length >= 2);
  const oldUid = oneLeft.heroes[0]!.uid;
  assert.ok(next.heroes.every((unit) => unit.uid > oldUid));
});

// --- TEST CREATURES ---
void test('the Holy Dragon fills the whole front row on its own', () => {
  const { heroes } = createSandboxWith(5, ['holyDragon', 'archer', 'priest']);
  const dragon = heroes.find((unit) => unit.heroId === 'holyDragon');
  assert.ok(dragon);
  assert.equal(sizeOf(dragon), 3);
  assert.deepEqual(cellsOf(dragon), ['front:0', 'front:1', 'front:2']);
  const others = heroes.filter((unit) => unit !== dragon);
  assert.ok(others.every((unit) => unit.row === 'back'));
  const cells = heroes.flatMap(cellsOf);
  assert.equal(new Set(cells).size, cells.length);
});

void test('a 3-slot creature can turn up among the random dummies', () => {
  const seeds = Array.from({ length: 400 }, (_, i) => i + 1);
  const isRolled = seeds.some((seed) =>
    rollDummies(seed)[0].includes('holyDragon')
  );
  assert.ok(isRolled);
});
