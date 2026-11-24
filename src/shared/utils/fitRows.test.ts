import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitCountOf } from './fitRows.ts';

// Chips 10 px wide, 2 px gaps: 3 fit a 34 px row (10+2+10+2+10).
const chips = (count: number): number[] =>
  Array.from({ length: count }, () => 10);

void test('everything that fits one row shows', () => {
  assert.equal(fitCountOf(34, chips(3), 10, 2, 1), 3);
});

void test('one row folds the rest beside an overflow chip', () => {
  assert.equal(fitCountOf(34, chips(5), 10, 2, 1), 2);
});

void test('two rows wrap before folding', () => {
  assert.equal(fitCountOf(34, chips(5), 10, 2, 2), 5, 'all fit in two rows');
  assert.equal(fitCountOf(34, chips(6), 10, 2, 2), 6);
  // Seven: the first row holds 3, the last row 2 plus the overflow chip.
  assert.equal(fitCountOf(34, chips(7), 10, 2, 2), 5);
});
