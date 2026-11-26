import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAfflictionWord, splitAfflictionWords } from './afflictionWords.ts';

void test('affliction words match in any case, singular or plural', () => {
  for (const word of ['affliction', 'Affliction', 'afflictions', 'AFFLICTIONS'])
    assert.equal(isAfflictionWord(word), true);
  assert.equal(isAfflictionWord('Frost'), false);
});

void test('splitAfflictionWords flags only the affliction words in a sentence', () => {
  assert.deepEqual(
    splitAfflictionWords('Removes 1 random affliction. Afflictions stay.'),
    [
      { text: 'Removes 1 random ', isAffliction: false },
      { text: 'affliction', isAffliction: true },
      { text: '. ', isAffliction: false },
      { text: 'Afflictions', isAffliction: true },
      { text: ' stay.', isAffliction: false },
    ]
  );
});

void test('splitAfflictionWords leaves words that only contain the stem alone', () => {
  assert.deepEqual(splitAfflictionWords('unafflictioned text'), [
    { text: 'unafflictioned text', isAffliction: false },
  ]);
});
