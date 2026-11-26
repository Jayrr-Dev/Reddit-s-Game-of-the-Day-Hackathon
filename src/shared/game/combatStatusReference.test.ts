import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT_STATUS_SECTIONS } from './combatStatusReference.ts';
import { STATUS_INFO, PASSIVE_INFO } from './describe.ts';

void test('Combat Rules lists every active status exactly once', () => {
  const entries = COMBAT_STATUS_SECTIONS.flatMap(section => section.entries);
  const ids = entries.flatMap(entry => entry.badge ? [entry.badge] : []);
  assert.deepEqual(ids.sort(), Object.keys(STATUS_INFO).sort());
  assert.ok(entries.every(entry => !entry.description.includes('**?**')));
});

void test('Combat Rules includes every boss passive and combat counter', () => {
  const labels = COMBAT_STATUS_SECTIONS.flatMap(section => section.entries.map(entry => entry.label));
  for (const label of [...Object.values(PASSIVE_INFO).map(info => info.label), 'Cleanse', 'Dispel', 'Disrupt', 'Homing', 'Out of Range']) {
    assert.ok(labels.includes(label), label);
  }
});
