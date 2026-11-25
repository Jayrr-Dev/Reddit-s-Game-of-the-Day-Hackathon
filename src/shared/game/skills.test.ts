// --- SKILL PROGRESSION ---
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, restoreCharacter } from './character.ts';
import {
  planSkillPath,
  buySkill,
  skillPointsLeft,
} from './skills.ts';

test('a starter point can be spent once across all paths', () => {
  const c = buySkill(createCharacter(), { branch: 4, tier: 0, slot: 0 });
  assert.equal(skillPointsLeft(c), 0);
  assert.equal(buySkill(c, { branch: 1, tier: 0, slot: 0 }), c);
  assert.equal(skillPointsLeft({ ...c, level: 2 }), 1);
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
  for (const slot of [0,1]) {
    const start = {...createCharacter(),level:70};
    const target = {branch:2,tier:3,slot};
    assert.equal(buySkill(start,target), start);
    const end = planSkillPath(start,target).character;
    assert.equal(skillPointsLeft(end),59);
    assert.equal(planSkillPath(end,{...target,slot:1-slot}).character,end);
    const legacy = {...end,skillPicks:[...end.skillPicks!,{branch:2,tier:4,slot:1},{branch:2,tier:6,slot,option:1}]};
    assert.deepEqual(restoreCharacter(legacy).skillPicks,end.skillPicks);
  }
});
