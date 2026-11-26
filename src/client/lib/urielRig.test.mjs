import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMBIENT_PERIOD, URIEL_REST_ARM, blendUrielArms, urielArmAt, urielFrame } from './urielRig.ts';

void test('Uriel hover loop joins with no jump', () => {
  // The ambient clock wraps at AMBIENT_PERIOD; the frame there must be the first frame again.
  assert.deepEqual(urielFrame(AMBIENT_PERIOD, URIEL_REST_ARM), urielFrame(0, URIEL_REST_ARM));
});

void test('Uriel attacks start from and return to the resting guard', () => {
  const drawn = (pose, t) => urielFrame(0, urielArmAt(pose, t));
  const resting = urielFrame(0, URIEL_REST_ARM);
  assert.deepEqual(drawn('diagonal', 1.35), resting);
  assert.deepEqual(drawn('diagonal', 4.6), resting);
  assert.deepEqual(drawn('overhead', 5.2), resting);
  // The raise ends where the overhead release begins, sword fully up.
  assert.deepEqual(drawn('raise', 2.88), drawn('overhead', 3.58));
  assert.equal(urielArmAt('raise', 2.88).up, 1);
});

void test('Uriel pose changes ease from the arm as drawn', () => {
  const raised = urielArmAt('raise', 2.88);
  assert.deepEqual(blendUrielArms(raised, URIEL_REST_ARM, 0), raised);
  assert.equal(blendUrielArms(raised, URIEL_REST_ARM, 1), URIEL_REST_ARM);
  assert.equal(blendUrielArms(raised, URIEL_REST_ARM, 0.5).up, 0.5);
});

void test('Uriel swing effects only show during their swing', () => {
  const hover = urielFrame(1, URIEL_REST_ARM);
  assert.equal(hover.opacity.slashTrail, '0.000');
  assert.equal(hover.opacity['ghost-18'], '0.000');
  assert.ok(Number(urielFrame(1, urielArmAt('diagonal', 2.75), 'diagonal', 2.75).opacity['ghost-18']) > 0.1);
  assert.ok(Number(urielFrame(1, urielArmAt('overhead', 3.85), 'overhead', 3.85).opacity.slashTrail) > 0.3);
});
