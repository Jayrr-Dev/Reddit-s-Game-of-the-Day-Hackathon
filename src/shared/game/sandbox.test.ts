// ===================================================================
// SANDBOX TESTS
// Target dummies: hordes always fit, energy refills, and clearing the
// field brings a fresh horde with new uids.
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPush, cellsOf, fallBack, sizeOf } from './battlefield.ts';
import {
  SANDBOX_SCENARIOS,
  createSandbox,
  createSandboxWith,
  rollDummies,
  sandboxReducer,
} from './sandbox.ts';
import { ENERGY_PER_TURN } from './rules.ts';
import { movementFailsOn } from './combat.ts';
import { canMove, movementBlockReason, offeredMovement } from './movement.ts';
import type { HeroUnit } from './types.ts';

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
void test('the Holy Dragon holds a T: the front row and the back centre', () => {
  const { heroes } = createSandboxWith(5, ['holyDragon']);
  const [dragon] = heroes;
  assert.ok(dragon);
  assert.deepEqual(cellNamesOf(dragon), [
    'front:0',
    'front:1',
    'front:2',
    'back:1',
  ]);
});

void test('others fill the back flanks around a boss', () => {
  const { heroes } = createSandboxWith(5, ['holyDragon', 'squire', 'archer']);
  const others = heroes
    .filter((unit) => unit.heroId !== 'holyDragon')
    .flatMap(cellNamesOf)
    .sort();
  assert.deepEqual(others, ['back:0', 'back:2']);
});

void test('a boss is never pulled, pushed or moved by Back Step', () => {
  const { heroes } = createSandboxWith(5, ['holyDragon']);
  const [dragon] = heroes;
  assert.ok(dragon);
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
  assert.ok(hit.hp + hit.shroud < dragon.hp + dragon.shroud);
});

void test('Back Step is offered but locked while a boss reaches back', () => {
  const state = createSandboxWith(5, ['holyDragon']);
  assert.equal(offeredMovement(state), 'backStep');
  assert.ok(movementBlockReason(state, 'backStep'));
  assert.equal(canMove(state, 'backStep'), false);
});

void test('Grand Griffon Rio holds the centre column, front and back', () => {
  const { heroes } = createSandboxWith(5, ['grandGriffon', 'squire']);
  const griffon = heroes.find((unit) => unit.heroId === 'grandGriffon');
  assert.ok(griffon);
  assert.deepEqual(cellNamesOf(griffon), ['front:1', 'back:1']);
  assert.equal(canPush(heroes, griffon), false);
});
