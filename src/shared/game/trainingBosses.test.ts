import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SANDBOX_SCENARIOS, createSandboxWith } from './sandbox.ts';
import { getHero } from './heroes.ts';

void test('Approved designs remain selectable; Mikhael replaces the duplicate Zeruel', () => {
  assert.equal(SANDBOX_SCENARIOS.some(({ id }) => id === 'zeruelArmored'), false);
  for (const id of ['angelAssassin','archangelUriel','twinAxeKnight','archangelMikhael'] as const) {
    const scenario = SANDBOX_SCENARIOS.find(option => option.id === id);
    assert.ok(scenario);
    assert.equal(getHero(id).tier, id === 'angelAssassin' ? 'grunt' : 'boss');
    const field=createSandboxWith(13,scenario.heroIds,scenario.startsInPlace);
    const boss = field.heroes.find(unit => unit.heroId === id);
    assert.ok(boss);
    assert.deepEqual([boss.row,boss.col],['front',1]);
    if (id === 'archangelMikhael') assert.equal(field.heroes.length, 1);
  }
});
