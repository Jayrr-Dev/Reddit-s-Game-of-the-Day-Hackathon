import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatOutcome, createHeroUnit, endTurn, plannedHeroMove, playCard, startCombat } from './combat.ts';
import { getHero } from './heroes.ts';
import { preferredRow } from './battlefield.ts';

void test('Mikhael opens with melee, moves to Midline at half HP, and never dies', () => {
  const start = startCombat({ hp: 333, maxHp: 333, deck: ['backhand'], heroIds: ['archangelMikhael'], might: 1, seed: 9 });
  const sword = { ...createHeroUnit('archangelMikhael', 1, 1), hp: 1001, row: 'front' as const, col: 1 };
  const prepared = { ...start, heroes: [sword], energy: 5, hand: ['backhand' as const] };
  const changed = playCard(prepared, 0, sword.uid);
  const spear = changed.heroes[0]!;
  assert.equal(spear.phase, 2);
  assert.equal(spear.uid, sword.uid);
  assert.equal(spear.maxHp, 2000);
  assert.equal(spear.hp, 1000);
  assert.equal(spear.row, 'back');
  assert.equal(preferredRow(spear), 'back');
  assert.equal(changed.fallen.length, 0);
  assert.equal(changed.slain, 0);
  assert.equal(combatOutcome(changed), 'ongoing');

  const spearAttack = plannedHeroMove(spear, [spear])!.move;
  assert.ok(spearAttack.effects.some(effect => effect.kind === 'attack' && effect.type === 'range' && effect.maxRange === 2));
  const retreat = { ...spear, row: 'horizon' as const };
  assert.ok(plannedHeroMove(retreat, [retreat])!.move.effects.every(effect => effect.kind !== 'attack'));
  const regrouped = endTurn({ ...changed, heroes: [retreat] });
  assert.equal(regrouped.heroes[0]?.row, 'back');

  const exhausted = { ...spear, row: 'front' as const, hp: 1 };
  const cleared = playCard({ ...changed, heroes: [exhausted], hand: ['backhand'], energy: 5 }, 0, spear.uid);
  assert.equal(combatOutcome(cleared), 'won');
  assert.equal(cleared.fallen.length, 0);
  assert.equal(cleared.slain, 0);
  assert.equal(getHero('archangelMikhael').survivesDefeat, true);
});
