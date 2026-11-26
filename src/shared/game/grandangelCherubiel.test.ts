import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTurnSteps } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS } from './heroes.ts';
import { createSandboxWith, SANDBOX_SCENARIOS } from './sandbox.ts';

void test('Grandangel Cherubiel starts as a centered Training boss with a Shock ward', () => {
  const scenario = SANDBOX_SCENARIOS.find(({ id }) => id === 'grandangelCherubiel');
  assert.ok(scenario);
  assert.equal(scenario.name, 'Grandangel Cherubiel');
  assert.equal(getHero('grandangelCherubiel').tier, 'boss');
  assert.ok(![...GRUNT_IDS, ...ELITE_IDS, ...CHAMPION_IDS].includes('grandangelCherubiel'));
  const fight = createSandboxWith(19, scenario.heroIds, scenario.startsInPlace);
  assert.deepEqual(fight.heroes.map(({ heroId, row, col }) => [heroId, row, col]), [
    ['grandangelCherubiel', 'back', 1],
  ]);
  const cast = endTurnSteps(fight).find(({ move }) => move?.name === 'Shattered Halo');
  assert.ok(cast);
  assert.equal(cast.state.heroes[0]?.guard, 14);
  assert.equal(cast.state.player.statuses.shock, 3);
});