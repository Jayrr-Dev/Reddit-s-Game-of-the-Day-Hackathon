import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLD_RANGES, goldFromVictoryScore, goldRewardFor } from './gold.ts';

test('Gold rolls vary by run and stay within the encounter tier', () => {
  for (const kind of ['horde', 'elite', 'champion'] as const) {
    const [min, max] = GOLD_RANGES[kind];
    const rewards = Array.from({ length: 128 }, (_, i) => goldRewardFor('run-' + i, 3, kind));
    assert.equal(Math.min(...rewards), min);
    assert.equal(Math.max(...rewards), max);
    assert.equal(goldRewardFor('same', 3, kind), goldRewardFor('same', 3, kind));
    assert.ok(new Set(Array.from({ length: 64 }, (_, i) => goldRewardFor('same', i, kind))).size > 1);
  }
});

test('Legacy wins retain their ten Gold and new records preserve their exact roll', () => {
  assert.equal([0, 2, 95, -10, -35, -105].map(goldFromVictoryScore).reduce((a, b) => a + b, 0), 180);
});
