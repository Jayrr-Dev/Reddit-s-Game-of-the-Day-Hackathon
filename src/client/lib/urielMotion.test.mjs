import { test } from 'node:test';
import assert from 'node:assert/strict';
import { URIEL_ATLAS, urielPlayback, urielPoseOf } from './urielMotion.ts';

void test('Uriel idles, slashes diagonally, charges overhead and releases overhead', () => {
  assert.equal(urielPoseOf(null), 'hover');
  assert.equal(urielPoseOf({style:'support', isSignature:false}), 'hover');
  assert.equal(urielPoseOf({style:'magic', isSignature:false}), 'diagonal');
  assert.equal(urielPoseOf({style:'support', isSignature:true}), 'raise');
  assert.equal(urielPoseOf({style:'magic', isSignature:true}), 'overhead');
});

void test('Uriel playback uses held transforms without touching viewBox', () => {
  const hover = urielPlayback('hover');
  const diagonal = urielPlayback('diagonal');
  assert.equal(hover.loop, true);
  assert.equal(hover.frames.length, 25);
  assert.equal(urielPlayback('raise').frames.length, 13);
  const {columns, rows} = URIEL_ATLAS;
  assert.equal(columns * rows, 72);
  const last = urielPlayback('overhead').frames.at(-1);
  assert.equal(last?.transform, 'translate3d(-87.5%, -88.88888888888889%, 0)');
  assert.equal(diagonal.loop, false);
  assert.equal(diagonal.duration, 560);
  assert.equal(diagonal.frames.length, 19);
  assert.deepEqual(diagonal.frames[0], {
    offset: 0, easing: 'steps(1, end)', transform: 'translate3d(0%, -33.333333333333336%, 0)',
  });
  assert.equal(diagonal.frames.at(-1)?.transform, diagonal.frames.at(-2)?.transform);
  assert.equal(diagonal.frames.at(-1)?.offset, 1);
});
