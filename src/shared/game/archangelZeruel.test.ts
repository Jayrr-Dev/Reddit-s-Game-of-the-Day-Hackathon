import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTurnSteps } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS } from './heroes.ts';
import { createSandboxWith, SANDBOX_SCENARIOS } from './sandbox.ts';

void test('Zeruel starts between his two independently targetable suns', () => {
  const encounter = SANDBOX_SCENARIOS.find(({ id }) => id === 'archangelZeruel')!;
  const fight = createSandboxWith(19, encounter.heroIds, encounter.startsInPlace);
  assert.deepEqual(fight.heroes.map(({ heroId, row, col }) => [heroId, row, col]), [
    ['archangelZeruel', 'front', 1],
    ['zeruelRedSun', 'back', 0],
    ['zeruelBlueSun', 'back', 2],
  ]);
  assert.equal(new Set(fight.heroes.map(({ uid }) => uid)).size, 3);
  assert.deepEqual(fight.heroes.map(({ heroId }) => getHero(heroId).name), ['Archangel Zeruel', 'Alpha', 'Omega']);
  assert.deepEqual(fight.heroes.map(({ heroId }) => getHero(heroId).tier), ['boss', 'summon', 'summon']);
  assert.ok(fight.heroes.every(({ heroId }) => ![...GRUNT_IDS, ...ELITE_IDS, ...CHAMPION_IDS].includes(heroId)));
  const moves = endTurnSteps(fight).map(beat => beat.move?.name);
  assert.ok(moves.includes('Crimson Flare'));
  assert.ok(moves.includes('Blue Radiance'));
});
