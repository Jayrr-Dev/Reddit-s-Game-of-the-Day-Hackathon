import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellsOf, isImmovable, legalTargets } from './battlefield.ts';
import { endTurnSteps } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS } from './heroes.ts';
import { createSandboxWith, SANDBOX_SCENARIOS } from './sandbox.ts';

const scenario = SANDBOX_SCENARIOS.find(({ id }) => id === 'lightLordMori')!;

void test('Light Lord Mori starts behind a complete line of Elite Knights', () => {
  const fight = createSandboxWith(19, scenario.heroIds, scenario.startsInPlace);
  assert.deepEqual(fight.heroes.map(({ heroId, row, col }) => [heroId, row, col]), [
    ['lightLordMori', 'back', 1],
    ['paladin', 'front', 0],
    ['hornedSentinel', 'front', 1.5],
  ]);
  const [mori, ...knights] = fight.heroes;
  assert.equal(getHero(mori!.heroId).name, 'Light Lord Mori');
  assert.equal(getHero(mori!.heroId).tier, 'boss');
  assert.equal(isImmovable(mori!), true);
  assert.ok(knights.every(({ heroId }) => getHero(heroId).tier === 'elite'));
  assert.deepEqual(knights.flatMap(cellsOf).map(({ col }) => col), [0, 0.5, 1, 1.5, 2, 2.5]);
  assert.deepEqual(legalTargets(fight.heroes, 'front', 'melee'), knights);
  assert.ok(![...GRUNT_IDS, ...ELITE_IDS, ...CHAMPION_IDS].includes('lightLordMori'));
});

void test('Light Lord Mori shields and protects each Knight on the opening turn', () => {
  const fight = createSandboxWith(19, scenario.heroIds, scenario.startsInPlace);
  const opener = endTurnSteps(fight).find(({ move }) => move?.name === 'Benediction');
  assert.ok(opener);
  for (const knight of opener.state.heroes.slice(1)) {
    assert.equal(knight.guard, 8);
    assert.equal(knight.statuses.protection, 1);
  }
});