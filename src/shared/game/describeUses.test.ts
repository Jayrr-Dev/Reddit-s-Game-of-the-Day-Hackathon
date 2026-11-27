import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCard, describeCardUse } from './describe.ts';
import { createCombatant } from './combatant.ts';

void test('Use tooltip matches one-use potions, three-use potions, and spent uses', () => {
  assert.ok(describeCard('healingPotion').includes('Use 1/1'));
  assert.equal(describeCardUse('healingPotion')?.label, 'Use');
  assert.match(describeCardUse('healingPotion')?.description ?? '', /\*\*Destroy\*\*/);
  assert.match(describeCardUse('healingPotion')?.description ?? '', /\*\*1\*\* play left/);
  assert.match(describeCardUse('rushPotion')?.description ?? '', /\*\*3\*\* plays left/);
  assert.ok(describeCard('rushPotion', undefined, undefined, 1).includes('Use 2/3'));
  assert.match(describeCardUse('rushPotion', 1)?.description ?? '', /\*\*2\*\* plays left/);
  assert.match(describeCardUse('rushPotion', 2)?.description ?? '', /\*\*1\*\* play left/);
  assert.equal(describeCardUse('arcaneBolt'), null);
});

void test('Use tooltip matches the bonus use from Overflow', () => {
  const player = { ...createCombatant(50, 50), skillPicks: [{ branch: 3, tier: 3, slot: 1 }] };
  assert.ok(describeCard('healingPotion', player).includes('Use 1/2'));
  assert.match(describeCardUse('healingPotion', 0, player)?.description ?? '', /\*\*2\*\* plays left/);
  assert.match(describeCardUse('healingPotion', 1, player)?.description ?? '', /\*\*1\*\* play left/);
});
