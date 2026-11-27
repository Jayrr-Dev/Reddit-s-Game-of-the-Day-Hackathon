import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxWith, SANDBOX_SCENARIOS } from './sandbox.ts';

void test('Zeruel trains without Alpha and Omega', () => {
  const encounter = SANDBOX_SCENARIOS.find(({ id }) => id === 'archangelZeruel')!;
  const fight = createSandboxWith(19, encounter.heroIds, encounter.startsInPlace);
  assert.deepEqual(fight.heroes.map(({ heroId, row, col }) => [heroId, row, col]), [
    ['archangelZeruel', 'front', 1],
  ]);
});
