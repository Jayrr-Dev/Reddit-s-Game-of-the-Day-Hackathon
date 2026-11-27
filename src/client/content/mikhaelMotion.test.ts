import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIKHAEL_SWORD_DURATION_MS, mikhaelCelAt, mikhaelSwordClip } from './mikhaelMotion.ts';
import type { HeroAction } from './heroLooks.ts';

const sword: HeroAction = { style: 'melee', swing: 'slash', isSignature: false, isTwoHanded: false };

void test('Mikhael selects the appropriate sword clip for each move', () => {
  assert.equal(mikhaelSwordClip(null), 'idle');
  assert.equal(mikhaelSwordClip({ ...sword, isCharging: true, isSignature: true }), 'rally');
  assert.equal(mikhaelSwordClip({ ...sword, isSignature: true }), 'thrust');
  assert.equal(mikhaelSwordClip({ ...sword, moveName: 'Divide the Earth' }), 'downward');
  assert.equal(mikhaelSwordClip({ ...sword, moveName: 'Sword of the Host', swing: 'upcut' }), 'upward');
  assert.equal(mikhaelSwordClip({ ...sword, moveName: 'Sword of the Host' }), 'backhand');
});

void test('Mikhael holds cels and reaches recovery at the faster duration', () => {
  assert.equal(MIKHAEL_SWORD_DURATION_MS, 1143);
  assert.equal(mikhaelCelAt(0), 0);
  assert.equal(mikhaelCelAt(200), 1);
  assert.equal(mikhaelCelAt(630), 5);
  assert.equal(mikhaelCelAt(MIKHAEL_SWORD_DURATION_MS), 11);
});


import { bossMoveCue } from './bossMoveCues.ts';
import { getHero } from '../../shared/game/heroes.ts';

void test('Mikhael uses Charge on the signature thrust, not its preparation', () => {
  const move = getHero('archangelMikhael').moves.find(m => m.isSignature);
  assert.ok(move);
  assert.equal(bossMoveCue('archangelMikhael', move.name, 'start')?.sound, 'charge');
  assert.equal(bossMoveCue('archangelMikhael', move.name, 'charge'), undefined);
});
