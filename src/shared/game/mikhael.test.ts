import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatOutcome, createHeroUnit, endTurn, endTurnSteps, plannedHeroMove, playCard, startCombat } from './combat.ts';
import { getHero, MIKHAEL_CHARGE_NAME } from './heroes.ts';
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

void test('Heavenbreaker Charge closes from Horizon before hitting and respects a pin', () => {
  const start = startCombat({ hp: 333, maxHp: 333, deck: ['backhand'], heroIds: ['archangelMikhael'], might: 1, seed: 9 });
  const unit = { ...start.heroes[0]!, row: 'horizon' as const };
  assert.equal(plannedHeroMove(unit, [unit])?.move.name, MIKHAEL_CHARGE_NAME);
  const step = endTurnSteps({ ...start, heroes: [unit] }).find(beat => beat.move?.name === MIKHAEL_CHARGE_NAME);
  assert.equal(step?.state.heroes[0]?.row, 'front');
  assert.equal(step?.state.player.hp, 267);
  const pinned = { ...unit, statuses: { ...unit.statuses, pin: 2 } };
  assert.notEqual(plannedHeroMove(pinned, [pinned])?.move.name, MIKHAEL_CHARGE_NAME);
  const blockers = [0, 1, 2].map(col => ({ ...createHeroUnit('squire', 30 + col, 1), row: 'front' as const, col }));
  assert.notEqual(plannedHeroMove(unit, [unit, ...blockers])?.move.name, MIKHAEL_CHARGE_NAME);
});

void test("Marshal's Ward protects Mikhael for three full player turns without counting the cast turn", () => {
  const start = startCombat({ hp: 333, maxHp: 333, deck: ['backhand'], heroIds: ['archangelMikhael'], might: 1, seed: 9 });
  const ward = endTurnSteps(start).find(beat => beat.move?.name.includes('Ward'));
  assert.equal(ward?.state.heroes[0]?.cardProtectionTurns, 3);
  const first = endTurn(start);
  assert.equal(first.heroes[0]?.cardProtectionTurns, 3);
  assert.equal(first.heroes[0]?.statuses.protection, 1);
  const second = endTurn(first);
  assert.equal(second.heroes[0]?.cardProtectionTurns, 2);
  assert.equal(second.heroes[0]?.statuses.protection, 1);
  const third = endTurn(second);
  assert.equal(third.heroes[0]?.cardProtectionTurns, 1);
  assert.equal(third.heroes[0]?.statuses.protection, 1);
  const expired = endTurnSteps(third)[0]?.state.heroes[0];
  assert.equal(expired?.cardProtectionTurns, 0);
  assert.equal(expired?.statuses.protection, 0);
});

void test('Neither Mikhael phase can summon Alpha or Omega', () => {
  const mikhael = getHero('archangelMikhael');
  assert.ok([...mikhael.moves, ...mikhael.secondPhase!.moves]
    .every(move => move.effects.every(effect => effect.kind !== 'summon')));
});
