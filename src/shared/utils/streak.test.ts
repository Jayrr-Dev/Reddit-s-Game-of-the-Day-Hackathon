// ===================================================================
// STREAK RULE TESTS
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_STREAK, advanceStreak, visibleStreak } from './streak.ts';

void test('first play starts a streak of 1', () => {
  const next = advanceStreak(EMPTY_STREAK, '2026-11-20');
  assert.deepEqual(next, { current: 1, best: 1, lastPlayedKey: '2026-11-20' });
});

void test('playing on consecutive days extends the streak', () => {
  const day1 = advanceStreak(EMPTY_STREAK, '2026-11-20');
  const day2 = advanceStreak(day1, '2026-11-21');
  assert.equal(day2.current, 2);
  assert.equal(day2.best, 2);
});

void test('replaying the same day does not change the streak', () => {
  const day1 = advanceStreak(EMPTY_STREAK, '2026-11-20');
  assert.equal(advanceStreak(day1, '2026-11-20'), day1);
});

void test('a missed day resets the streak but keeps the best', () => {
  const day2 = advanceStreak(
    advanceStreak(EMPTY_STREAK, '2026-11-20'),
    '2026-11-21'
  );
  const afterGap = advanceStreak(day2, '2026-11-23');
  assert.deepEqual(afterGap, {
    current: 1,
    best: 2,
    lastPlayedKey: '2026-11-23',
  });
});

void test('visibleStreak shows 0 once the streak is broken', () => {
  const record = { current: 5, best: 5, lastPlayedKey: '2026-11-18' };
  assert.deepEqual(visibleStreak(record, '2026-11-20'), {
    current: 0,
    best: 5,
  });
  assert.deepEqual(visibleStreak(record, '2026-11-19'), {
    current: 5,
    best: 5,
  });
});
