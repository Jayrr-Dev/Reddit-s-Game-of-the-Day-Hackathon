import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { healthImpacts } from './healthImpacts.ts';

test('player HP waits for projectile impact and does not move on a fully blocked hit', () => {
  const hp = { hp: 66, maxHp: 66 };
  assert.deepEqual(healthImpacts(hp, { ...hp, hp: 52 }, [{ delay: 350, damage: 14 }]),
    [{ delay: 350, hpChange: -14, maxChange: 0 }]);
  assert.deepEqual(healthImpacts(hp, hp, [{ delay: 350, damage: 0 }]), []);
});

test('staggered hits drain one per blow, limited to real HP even on overkill', () => {
  const before = { hp: 12, maxHp: 66 };
  const after = { hp: 0, maxHp: 66 };
  assert.deepEqual(healthImpacts(before, after, [{ delay: 0, damage: 0 }, { delay: 160, damage: 7 }, { delay: 320, damage: 30 }]),
    [{ delay: 160, hpChange: -7, maxChange: 0 }, { delay: 320, hpChange: -5, maxChange: 0 }]);
});

test('heals and max HP changes stay exact, even without a damage pop', () => {
  assert.deepEqual(healthImpacts({ hp: 15, maxHp: 66 }, { hp: 30, maxHp: 81 }, []),
    [{ delay: 0, hpChange: 15, maxChange: 15 }]);
});
