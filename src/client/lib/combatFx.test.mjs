import assert from 'node:assert/strict';
import { test } from 'node:test';
import { physicalImpactOf } from './combatFx.ts';

test('physical impacts distinguish sharp from blunt at contact', () => {
  assert.equal(physicalImpactOf({ source: 'melee', edge: 'sharp', amount: 10 }), 'weapon-impact');
  assert.equal(physicalImpactOf({ source: 'melee', edge: 'blunt', amount: 10 }), 'ground-slam');
});

void test('misses, blocks, ranged marks, magic and affliction ticks do not spawn melee impacts', () => {
  assert.equal(physicalImpactOf({ source: 'melee', edge: 'blunt', amount: 0 }), null);
  assert.equal(physicalImpactOf({ source: 'melee', tick: 'burn', amount: 4 }), null);
  assert.equal(physicalImpactOf({ source: 'range', amount: 10 }), null);
  assert.equal(physicalImpactOf({ source: 'magic', amount: 10 }), null);
  assert.equal(physicalImpactOf({ source: 'curse', amount: 10 }), null);
});
