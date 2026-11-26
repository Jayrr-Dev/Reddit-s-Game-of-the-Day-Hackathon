import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTurnSteps, plannedHeroMove } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS } from './heroes.ts';
import { createSandboxWith, SANDBOX_SCENARIOS } from './sandbox.ts';

const scenario = SANDBOX_SCENARIOS.find(({ id }) => id === 'grandangelCerviel')!;
const createEncounter = () => createSandboxWith(19, scenario.heroIds, scenario.startsInPlace);

void test('Grandangel Cerviel spawns all three independently targetable forms in Training', () => {
  const fight = createEncounter();
  assert.deepEqual(fight.heroes.map(({ heroId, row, col }) => [heroId, row, col]), [
    ['grandangelCerviel', 'back', 1],
    ['cervielSword', 'front', 2],
    ['cervielBow', 'back', 0],
  ]);
  assert.equal(new Set(fight.heroes.map(({ uid }) => uid)).size, 3);
  assert.deepEqual(fight.heroes.map(({ heroId }) => getHero(heroId).tier), ['boss', 'elite', 'elite']);
  const ranked = [...GRUNT_IDS, ...ELITE_IDS, ...CHAMPION_IDS];
  assert.ok(fight.heroes.every(({ heroId }) => !ranked.includes(heroId)));
});

void test('Staff wards the other forms and Sword and Bow each use their weapon', () => {
  const fight = createEncounter();
  const beats = endTurnSteps(fight);
  const staff = beats.find(({ move }) => move?.name === 'Staff of Accord');
  assert.ok(staff);
  for (const form of staff.state.heroes.slice(1)) {
    assert.equal(form.guard, 10);
    assert.equal(form.statuses.protection, 1);
  }
  assert.equal(beats.find(({ move }) => move?.name === 'Twin Sabre Cuts')?.attackType, 'melee');
  assert.equal(beats.find(({ move }) => move?.name === 'Gilded Volley')?.attackType, 'range');
  const rearSword = { ...fight.heroes[1]!, row: 'back' as const };
  assert.equal(plannedHeroMove(rearSword, fight.heroes)?.move.name, 'Distant Blade Arc');
});

void test('Grandangel Zadkiel uses his new name without changing the scenario ID', () => {
  assert.equal(getHero('zadkielOfDominations').name, 'Grandangel Zadkiel');
  assert.equal(SANDBOX_SCENARIOS.find(({ id }) => id === 'zadkielOfDominations')?.name, 'Grandangel Zadkiel');
});