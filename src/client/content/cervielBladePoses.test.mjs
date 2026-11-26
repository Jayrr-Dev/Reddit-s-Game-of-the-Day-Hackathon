import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARRIVAL_TIMES, introSwordPose, swordPose, TRANSFORMATION_MS } from './cervielBladePoses.ts';

void test('Phase II swords come from different edges, one at a time, and settle in formation', () => {
  const frame = { left: -103, right: 871, top: -40, bottom: 552 };
  const seed = 858993459;
  const starts = [];
  for (let i = 0; i < ARRIVAL_TIMES.length; i++) {
    const time = ARRIVAL_TIMES[i];
    assert.equal(introSwordPose(i, time - 1, seed, frame).alpha, 0);
    const spawn = introSwordPose(i, time, seed, frame);
    assert.ok(spawn.x < frame.left || spawn.y < frame.top || spawn.x > frame.right || spawn.y > frame.bottom);
    starts.push([spawn.x,spawn.y].join(','));
    assert.deepEqual(introSwordPose(i, TRANSFORMATION_MS, seed, frame), { ...swordPose(i,0), alpha: 1 });
  }
  assert.equal(new Set(starts).size, 6);
  assert.notDeepEqual(introSwordPose(0, ARRIVAL_TIMES[0], seed, frame), introSwordPose(0, ARRIVAL_TIMES[0], seed + 12345, frame));
});
