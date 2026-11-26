import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitNumbers } from './numberParts.ts';

void test('a multi-hit sum stays together as one number', () => {
  assert.deepEqual(splitNumbers('Melee attack for 4×4=16'), [
    { text: 'Melee attack for ', isNumber: false },
    { text: '4×4=16', isNumber: true },
  ]);
});

void test('percentages and several numbers in one line are all marked', () => {
  assert.deepEqual(splitNumbers('Guard 6, 25% evasion'), [
    { text: 'Guard ', isNumber: false },
    { text: '6', isNumber: true },
    { text: ', ', isNumber: false },
    { text: '25%', isNumber: true },
    { text: ' evasion', isNumber: false },
  ]);
});

void test('text without numbers comes back as one plain part', () => {
  assert.deepEqual(splitNumbers('Holds position.'), [{ text: 'Holds position.', isNumber: false }]);
});
