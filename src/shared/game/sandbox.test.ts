// ===================================================================
// SANDBOX TESTS
// Target dummies: hordes always fit, energy refills, and clearing the
// field brings a fresh horde with new uids.
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPull, canPush, fallBack, rowsOf, sizeOf } from './battlefield.ts';
import {
  SANDBOX_SCENARIOS,
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
  rowsOf(unit).flatMap((row) =>
    Array.from({ length: sizeOf(unit) }, (_, i) => `${row}:${unit.col + i}`)
  );

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

// --- BOSSES ---
void test('the Holy Dragon fills all six slots on its own', () => {
  const { heroes } = createSandboxWith(5, ['holyDragon']);
  const [dragon] = heroes;
  assert.ok(dragon);
  assert.equal(dragon.row, 'front');
  assert.deepEqual(cellsOf(dragon).sort(), [
    'back:0',
    'back:1',
    'back:2',
    'front:0',
    'front:1',
    'front:2',
  ]);
});

void test('a boss is never pulled, pushed or moved by Back Step', () => {
  const { heroes } = createSandboxWith(5, ['holyDragon']);
  const [dragon] = heroes;
  assert.ok(dragon);
  assert.equal(canPull(heroes, dragon), false);
  assert.equal(canPush(heroes, dragon), false);
  assert.equal(fallBack(heroes)[0]?.row, 'front');
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
    const cells = heroes.flatMap(cellsOf);
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
