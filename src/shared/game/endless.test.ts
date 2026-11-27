import test from 'node:test';
import assert from 'node:assert/strict';
import { createEndless, reduceEndless } from './endless.ts';
import { createRun, type RunState } from './run.ts';

test('Endless starts at a seeded fight without changing Conquest', () => {
  const day = '2026-11-27';
  const first = createEndless(day);
  assert.equal(first.phase.kind, 'combat');
  assert.equal(first.stop, 1);
  assert.deepEqual(createEndless(day), first);
  const tomorrow = createEndless('2026-11-28');
  assert.equal(tomorrow.phase.kind, 'combat');
  assert.notDeepEqual(tomorrow.phase.combat, first.phase.combat);
  assert.equal(createRun(day).phase.kind, 'route');
});

test('Endless advances directly to seeded fights well past the campaign finale', () => {
  const start = createEndless('2026-11-27');
  const reward: RunState = { ...start, stop: 45, phase: { kind: 'reward', source: 'champion', offers: [] } };
  const next = reduceEndless(reward, { type: 'pickCard', offerIndex: null });
  assert.equal(next.stop, 46);
  assert.equal(next.phase.kind, 'combat');
  assert.equal(reduceEndless(next, { type: 'chooseStop', option: 1 }), next);
  const fallen = reduceEndless(next, { type: 'abandon' });
  assert.equal(fallen.phase.kind, 'fallen');
  assert.equal(reduceEndless(fallen, { type: 'endTurn' }), fallen);
});
