// ===================================================================
// SEEDED RANDOMNESS TESTS
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed, nextFloat, pickDistinct, shuffle } from './rng.ts';

void test('the same seed always gives the same numbers', () => {
  const seed = hashSeed('2026-11-23');
  assert.deepEqual(nextFloat(seed), nextFloat(seed));
});

void test('different days hash to different seeds', () => {
  assert.notEqual(hashSeed('2026-11-23'), hashSeed('2026-11-24'));
});

void test('floats stay in [0, 1)', () => {
  let state = hashSeed('range');
  for (let index = 0; index < 1000; index += 1) {
    const [value, next] = nextFloat(state);
    assert.ok(value >= 0 && value < 1);
    state = next;
  }
});

void test('shuffle keeps every item and does not mutate the input', () => {
  const items = [1, 2, 3, 4, 5, 6];
  const [shuffled] = shuffle(hashSeed('shuffle'), items);
  assert.deepEqual([...shuffled].sort(), items);
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6]);
});

void test('pickDistinct never repeats an item', () => {
  const [picked] = pickDistinct(hashSeed('distinct'), ['a', 'b', 'c', 'd'], 3);
  assert.equal(new Set(picked).size, 3);
});
