import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urielClipTime, urielPoseOf } from './urielMotion.ts';

void test('Uriel idles, slashes diagonally, charges overhead and releases overhead', () => {
  assert.equal(urielPoseOf(null), 'hover');
  assert.equal(urielPoseOf({style:'support', isSignature:false}), 'hover');
  assert.equal(urielPoseOf({style:'magic', isSignature:false}), 'diagonal');
  assert.equal(urielPoseOf({style:'support', isSignature:true}), 'raise');
  assert.equal(urielPoseOf({style:'magic', isSignature:true}), 'overhead');
});

void test('Uriel clips run their choreography once and hold the last moment', () => {
  assert.equal(urielClipTime('diagonal', 0), 1.35);
  assert.equal(urielClipTime('diagonal', 280), 2.58);
  assert.equal(urielClipTime('diagonal', 420), 2.91);
  assert.equal(urielClipTime('diagonal', 560), 4.6);
  assert.equal(urielClipTime('diagonal', 9000), 4.6);
  assert.equal(urielClipTime('raise', 620), 2.88);
  assert.equal(urielClipTime('overhead', 0), 3.58);
  assert.equal(urielClipTime('overhead', 560), 5.2);
});

void test('Uriel clip time never runs backwards', () => {
  for (const pose of ['diagonal', 'raise', 'overhead']) {
    let previous = -Infinity;
    for (let ms = 0; ms <= 700; ms += 7) {
      const now = urielClipTime(pose, ms);
      assert.ok(now >= previous, `${pose} at ${ms} ms`);
      previous = now;
    }
  }
});
