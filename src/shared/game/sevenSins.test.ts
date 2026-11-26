import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTurnSteps } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS } from './heroes.ts';
import { createSandboxWith, groupScenariosByUnitType } from './sandbox.ts';

void test('Greed and Envy fight as bosses under Seven Sins in Training', () => {
  const sins = groupScenariosByUnitType().find(group => group.unitType === 'sin');
  assert.ok(sins);
  assert.deepEqual(sins.scenarios.map(scenario => scenario.id), ['greed', 'envy']);
  for (const option of [
    { id: 'greed', row: 'back', opening: 'Hoard' },
    { id: 'envy', row: 'front', opening: 'Venom Spit' },
  ] as const) {
    assert.equal(getHero(option.id).tier, 'boss');
    assert.ok(![...GRUNT_IDS, ...ELITE_IDS, ...CHAMPION_IDS].includes(option.id));
    const scenario = sins.scenarios.find(item => item.id === option.id);
    assert.ok(scenario);
    const fight = createSandboxWith(19, scenario.heroIds, scenario.startsInPlace);
    assert.deepEqual(fight.heroes.map(unit => [unit.heroId, unit.row, unit.col]), [[option.id, option.row, 1]]);
    const opener = endTurnSteps(fight).find(step => step.move?.name === option.opening);
    assert.ok(opener);
    if (option.id === 'greed') assert.equal(opener.state.heroes[0]?.guard, 14);
    else assert.equal(opener.state.player.statuses.poison, 3);
  }
});
