import assert from 'node:assert/strict';
import { test } from 'node:test';
import { awardCharacterVictory, createCharacter, progressionFromWins, xpToNextLevel } from './character.ts';

void test('RPG experience rises each level and the first level-up takes three complete battles', () => {
  assert.deepEqual([1, 10, 25, 50, 99].map(level => xpToNextLevel(level, false, true)), [260, 402, 711, 1426, 3552]);
  for (let level = 1; level < 99; level++) {
    assert.ok(xpToNextLevel(level + 1, false, true) > xpToNextLevel(level, false, true));
  }
  assert.equal(xpToNextLevel(100, false, true), 0);
  const start = { ...createCharacter(), scaledExperience: true as const };
  const one = awardCharacterVictory(start);
  const two = awardCharacterVictory(one);
  const three = awardCharacterVictory(two);
  assert.deepEqual([one.level, two.level, three.level, three.xp], [1, 1, 2, 40]);
});

void test('returning players keep their level and the same fraction of the XP bar', () => {
  for (const wins of [0, 1, 3, 25, 100, 1000]) {
    const old = progressionFromWins(wins);
    const migrated = progressionFromWins(wins, false, wins);
    assert.equal(migrated.level, old.level);
    if (old.level === 100) continue;
    const expect = old.xp / xpToNextLevel(old.level);
    const actual = migrated.xp / xpToNextLevel(old.level, false, true);
    assert.ok(Math.abs(expect - actual) < .004);
    const future = awardCharacterVictory({ ...createCharacter(), ...migrated, scaledExperience: true });
    assert.deepEqual(progressionFromWins(wins + 1, false, wins), { level: future.level, xp: future.xp });
  }
});
