import assert from 'node:assert/strict';
import test from 'node:test';
import { drawPandoraEvent, PANDORA_CURSE_POOL_CHANCE, PANDORA_BLESSING_POOL_CHANCE } from './pandora.ts';
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

test('new Pandora half-life rolls double every verified battle payout', () => {
  assert.deepEqual(drawPandoraEvent(99, 200), { kind: 'run', effect: 'half-life-double-gold' });
  for (const encounter of ['horde', 'elite', 'champion'] as const) {
    for (let stop = 1; stop <= 10; stop++) {
      const base = goldRewardFor('run', stop, encounter);
      assert.equal(goldRewardFor('run', stop, encounter, 'half-life-double-gold'), base * 2);
      assert.equal(goldRewardFor('run', stop, encounter, 'half-life'), base);
    }
  }
});

void test('Pandora keeps the 15% Curse and 10% Blessing pools equally weighted within each pool', () => {
  assert.equal(PANDORA_CURSE_POOL_CHANCE, 15);
  assert.equal(PANDORA_BLESSING_POOL_CHANCE, 10);
  const outcomes = new Map<string, number>();
  for (let roll = 0; roll < 100; roll++) {
    const event = drawPandoraEvent(roll, 200);
    const key = event.kind === 'gold' ? String(event.change) : event.kind === 'run' ? event.effect : 'card';
    outcomes.set(key, (outcomes.get(key) ?? 0) + 1);
  }
  assert.deepEqual([...outcomes], [['180', 20], ['-60', 20], ['brittle-blood', 20], ['lasting-vigor', 20], ['half-life-double-gold', 20]]);
});