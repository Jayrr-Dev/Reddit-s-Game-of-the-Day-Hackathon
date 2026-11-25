// --- SKILL PROGRESSION ---
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, restoreCharacter } from './character.ts';
import { playCard, startCombat } from './combat.ts';
import { attackDamage, createCombatant, takeHit } from './combatant.ts';
import { move, movementCost } from './movement.ts';
import {
  planSkillPath,
  buySkill,
  skillPointsLeft,
  movementDiscountOf,
  reflexDodgeOf,
  skillEffectOf,
} from './skills.ts';

test('a path entry circle costs 3 skill points', () => {
  const entry = { branch: 4, tier: 0, slot: 0 };
  const low = createCharacter();
  assert.equal(buySkill(low, entry), low, 'level 1 cannot afford it');
  const c = buySkill({ ...low, level: 3 }, entry);
  assert.equal(skillPointsLeft(c), 0);
  assert.equal(buySkill(c, { branch: 1, tier: 0, slot: 0 }), c);
  assert.equal(skillPointsLeft({ ...c, level: 4 }), 1);
});

test('Endurance (Movement entry) takes 1 energy off Charge and Back Step', () => {
  assert.equal(movementDiscountOf([]), 0);
  assert.equal(movementDiscountOf([{ branch: 0, tier: 0, slot: 0 }]), 1);
  assert.equal(
    skillEffectOf({ branch: 0, tier: 0, slot: 0 })?.name,
    'Endurance'
  );
});

test('one click buys the missing route or refunds its dependants atomically', () => {
  const c = { ...createCharacter(), level: 20 };
  const left = { branch: 1, tier: 2, slot: 0 };
  assert.equal(
    planSkillPath({ ...c, level: 1 }, left).character.skillPicks,
    undefined
  );
  const first = planSkillPath(c, left).character;
  assert.equal(first.skillPicks?.length, 3);
  const both = planSkillPath(first, { ...left, slot: 1 }).character;
  assert.equal(both.skillPicks?.length, 5);
  const refunded = planSkillPath(both, { ...left, tier: 1 }).character;
  assert.deepEqual(
    refunded.skillPicks,
    both.skillPicks?.filter((p) => p.tier === 0 || p.slot === 1)
  );
  assert.deepEqual(restoreCharacter(refunded).skillPicks, refunded.skillPicks);
  assert.equal(
    planSkillPath(refunded, { ...left, tier: 3 }).character.skillPicks?.length,
    11
  );
});

test('each path ends at either of two gated endpoints and restores only surviving circles', () => {
  for (const slot of [0, 1]) {
    const start = { ...createCharacter(), level: 70 };
    const target = { branch: 2, tier: 3, slot };
    assert.equal(buySkill(start, target), start);
    const end = planSkillPath(start, target).character;
    assert.equal(skillPointsLeft(end), 57);
    assert.equal(
      planSkillPath(end, { ...target, slot: 1 - slot }).character,
      end
    );
    const legacy = {
      ...end,
      skillPicks: [
        ...end.skillPicks!,
        { branch: 2, tier: 4, slot: 1 },
        { branch: 2, tier: 6, slot, option: 1 },
      ],
    };
    assert.deepEqual(restoreCharacter(legacy).skillPicks, end.skillPicks);
  }
});

test('in combat, Endurance makes Charge and Back Step start at 0 energy', () => {
  const setup = {
    hp: 50,
    maxHp: 50,
    deck: ['backhand' as const],
    heroIds: ['squire' as const],
    might: 1,
    seed: 3,
  };
  const plain = startCombat(setup);
  const enduring = startCombat({
    ...setup,
    skillPicks: [{ branch: 0, tier: 0, slot: 0 }],
  });
  assert.equal(movementCost(plain, 'backStep'), 1);
  assert.equal(movementCost(enduring, 'backStep'), 0);
  assert.equal(movementCost(enduring, 'charge'), 0);
});

test('Invincible turns the next hit to 0, one stack per hit', () => {
  const unit = createCombatant(30, 30);
  const shielded = { ...unit, statuses: { ...unit.statuses, invincible: 2 } };
  const first = takeHit(shielded, 9, 'melee');
  assert.equal(first.hp, 30);
  assert.equal(first.statuses.invincible, 1);
  const second = takeHit(first, 9, 'magic', true);
  assert.equal(second.hp, 30, 'even Piercing');
  assert.equal(takeHit(second, 9, 'melee').hp, 21, 'then hits land');
});

test('Invincibility Frames: each Back Step adds Invincible 1; Rage gives energy on a kill', () => {
  const setup = {
    hp: 50,
    maxHp: 50,
    deck: ['backhand' as const],
    heroIds: ['squire' as const],
    might: 1,
    seed: 3,
  };
  const iFrames = { branch: 0, tier: 3, slot: 1 };
  const stepped = (picks: { branch: number; tier: number; slot: number }[]) => {
    const state = startCombat({ ...setup, skillPicks: picks });
    const front = {
      ...state,
      energy: 9,
      heroes: state.heroes.map((u) => ({ ...u, row: 'front' as const })),
    };
    return move(front, 'backStep').player.statuses.invincible;
  };
  assert.equal(stepped([iFrames]), 1);
  assert.equal(stepped([]), 0);
  const rage = { branch: 0, tier: 3, slot: 0 };
  const fight = (picks: { branch: number; tier: number; slot: number }[]) => {
    const state = startCombat({ ...setup, skillPicks: picks });
    const weak = {
      ...state,
      energy: 5,
      heroes: state.heroes.map((u) => ({
        ...u,
        row: 'front' as const,
        hp: 1,
        guard: 0,
      })),
    };
    return playCard(weak, 0, weak.heroes[0]!.uid).energy;
  };
  assert.equal(fight([rage]), fight([]) + 1);
});

test('Bull Rush: each rank adds 5% to the Momentum bonus', () => {
  const unit = createCombatant(30, 30);
  const charged = { ...unit, statuses: { ...unit.statuses, momentum: 1 } };
  const rank = { branch: 0, tier: 1, slot: 0 };
  assert.equal(attackDamage(100, charged, 'melee'), 150);
  const maxed = { ...charged, skillPicks: [rank, rank, rank, rank, rank] };
  assert.equal(attackDamage(100, maxed, 'melee'), 175);
  // Rampage doubles the whole bonus: +75% becomes +150%.
  assert.equal(attackDamage(100, maxed, 'melee', true), 250);
});

test('Light Feet: each rank adds 5% to the Reflex dodge', () => {
  const rank = { branch: 0, tier: 1, slot: 1 };
  assert.equal(reflexDodgeOf({}), 0.25);
  assert.equal(
    reflexDodgeOf({ skillPicks: [rank, rank, rank, rank, rank] }),
    0.5
  );
});
