import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTurnSteps } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS } from './heroes.ts';
import { createSandboxWith, SANDBOX_SCENARIOS } from './sandbox.ts';

void test('Mage Borne Azula starts in the back center and opens with a ward', () => {
  const scenario = SANDBOX_SCENARIOS.find(({ id }) => id === 'mageBorneAzula');
  assert.ok(scenario);
  assert.equal(scenario.name, 'Mage Borne Azula');
  assert.equal(getHero('mageBorneAzula').tier, 'boss');
  assert.ok(![...GRUNT_IDS, ...ELITE_IDS, ...CHAMPION_IDS].includes('mageBorneAzula'));
  const fight = createSandboxWith(19, scenario.heroIds, scenario.startsInPlace);
  assert.deepEqual(fight.heroes.map(({ heroId, row, col }) => [heroId, row, col]), [
    ['mageBorneAzula', 'back', 1],
  ]);
  const cast = endTurnSteps(fight).find(({ move }) => move?.name === 'Sevenfold Ward');
  assert.ok(cast);
  assert.equal(cast.state.heroes[0]?.guard, 12);
  assert.equal(cast.state.heroes[0]?.statuses.protection, 1);
});