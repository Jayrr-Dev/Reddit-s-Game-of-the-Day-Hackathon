import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { deathVoiceCues, deathVoiceOf, fallenWithDeathVoice } from './deathVoices.ts';

test('human families rotate between takes; creature bosses have unique cues', () => {
  assert.equal(deathVoiceCues.low.length, 2);
  assert.equal(deathVoiceCues.breath.length, 2);
  assert.equal(deathVoiceOf('holt'), 'low');
  assert.equal(deathVoiceOf('maren'), 'breath');
  assert.equal(deathVoiceOf('shieldmaiden'), 'grit');
  assert.equal(deathVoiceOf('bard'), 'mid');
  assert.equal(deathVoiceOf('holyDragon'), 'sol');
  assert.equal(deathVoiceOf('grandGriffon'), 'rio');
  assert.notEqual(deathVoiceCues.sol[0], deathVoiceCues.rio[0]);
  assert.equal(deathVoiceOf('ballista'), undefined);
  assert.equal(deathVoiceOf('angelArcher'), undefined);
});

test('does not voice spawns, nonlethal hits, already fallen units, siege or angel deaths', () => {
  const human = { uid: 1, heroId: 'holt', hp: 1 } as const;
  const fallenHuman = { ...human, hp: 0 };
  const boss = { uid: 2, heroId: 'grandGriffon', hp: 1 } as const;
  const angel = { uid: 3, heroId: 'angelArcher', hp: 1 } as const;
  const ballista = { uid: 4, heroId: 'ballista', hp: 1 } as const;
  const alreadyFallen = { uid: 5, heroId: 'maren', hp: 0 } as const;
  const spawned = { uid: 6, heroId: 'holyDragon', hp: 10 } as const;
  assert.deepEqual(fallenWithDeathVoice([human, boss, angel, ballista, alreadyFallen], [fallenHuman, spawned]), [human, boss]);
  assert.deepEqual(fallenWithDeathVoice([fallenHuman, spawned], [fallenHuman, { ...spawned, hp: 3 }]), []);
});
