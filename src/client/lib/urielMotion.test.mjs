import { test } from 'node:test';
import assert from 'node:assert/strict';
import { URIEL_ATLAS, urielFrameAt, urielFrameBox, urielPoseOf } from './urielMotion.ts';

void test('Uriel idles, slashes diagonally, charges overhead and releases overhead', () => {
  assert.equal(urielPoseOf(null), 'hover');
  assert.equal(urielPoseOf({style:'support', isSignature:false}), 'hover');
  assert.equal(urielPoseOf({style:'magic', isSignature:false}), 'diagonal');
  assert.equal(urielPoseOf({style:'support', isSignature:true}), 'raise');
  assert.equal(urielPoseOf({style:'magic', isSignature:true}), 'overhead');
});

void test('Uriel loops hover but plays each attack only once', () => {
  assert.equal(urielFrameAt('hover', 0), urielFrameAt('hover', 1800));
  assert.equal(urielFrameAt('diagonal', 0), 24);
  assert.equal(urielFrameAt('diagonal', 560), 41);
  assert.equal(urielFrameAt('diagonal', 1000), 41);
  assert.equal(urielFrameAt('raise', 900), 53);
  const last = urielFrameAt('overhead', 560);
  assert.equal(last, URIEL_ATLAS.columns * URIEL_ATLAS.rows - 1);
  assert.equal(urielFrameBox(last), '2912 2160 416 270');
});
