import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTurn, endTurnSteps, plannedHeroMove } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS } from './heroes.ts';
import { createSandboxWith, SANDBOX_SCENARIOS } from './sandbox.ts';

const scenario = SANDBOX_SCENARIOS.find(({ id }) => id === 'grandangelCerviel')!;
const createEncounter = () => createSandboxWith(19, scenario.heroIds, scenario.startsInPlace);

void test('Grandangel Cerviel opens alone then summons the two original forms', () => {
  const fight = createEncounter();
  assert.deepEqual(fight.heroes.map(({ heroId, row, col }) => [heroId, row, col]), [['cervielSword', 'front', 1]]);
  const first = endTurn(fight);
  const second = endTurn(first);
  assert.deepEqual(second.heroes.map(({ heroId, row, col }) => [heroId, row, col]), [
    ['cervielSword', 'front', 1], ['grandangelCerviel', 'back', 0], ['cervielBow', 'back', 2],
  ]);
  assert.equal(new Set(second.heroes.map(({ uid }) => uid)).size, 3);
  assert.deepEqual(second.heroes.map(({ heroId }) => getHero(heroId).tier), ['boss', 'elite', 'elite']);
  assert.ok(second.heroes.every(({ heroId }) => ![...GRUNT_IDS, ...ELITE_IDS, ...CHAMPION_IDS].includes(heroId)));
  const beats = endTurnSteps(second);
  assert.equal(beats.find(({ move }) => move?.name === 'Twin Sabre Cuts')?.attackType, 'melee');
  assert.ok(beats.some(({ move }) => move?.name === 'Staff of Accord' || move?.name === 'Trinity Pulse'));
  assert.equal(plannedHeroMove({ ...second.heroes[0]!, row: 'back' }, second.heroes)?.move.name, 'Distant Blade Arc');
});

void test('Grandangel Zadkiel uses his new name without changing the scenario ID', () => {
  assert.equal(getHero('zadkielOfDominations').name, 'Grandangel Zadkiel');
  assert.equal(SANDBOX_SCENARIOS.find(({ id }) => id === 'zadkielOfDominations')?.name, 'Grandangel Zadkiel');
});