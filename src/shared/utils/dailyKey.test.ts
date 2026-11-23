// ===================================================================
// DAILY KEY TESTS
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDailyKey,
  getDailyKey,
  isDailyKey,
  shiftDailyKey,
} from './dailyKey.ts';

void test('getDailyKey uses the UTC date', () => {
  assert.equal(getDailyKey(new Date('2026-12-08T23:59:59Z')), '2026-12-08');
  assert.equal(getDailyKey(new Date('2026-12-09T00:00:00Z')), '2026-12-09');
});

void test('shiftDailyKey crosses month and year boundaries', () => {
  assert.equal(shiftDailyKey('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDailyKey('2026-03-01', -1), '2026-02-28');
});

void test('isDailyKey rejects malformed values', () => {
  assert.equal(isDailyKey('2026-11-20'), true);
  assert.equal(isDailyKey('2026-13-40'), false);
  assert.equal(isDailyKey('20261120'), false);
  assert.equal(isDailyKey(42), false);
});

void test('formatDailyKey reads like a calendar day', () => {
  assert.equal(formatDailyKey('2026-11-23'), 'Mon, Nov 23');
  assert.equal(formatDailyKey('2027-01-01'), 'Fri, Jan 1');
  assert.equal(formatDailyKey('nonsense'), 'nonsense');
});
