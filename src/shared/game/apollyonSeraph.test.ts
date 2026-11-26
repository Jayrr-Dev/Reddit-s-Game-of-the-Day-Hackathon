import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellsOf, isImmovable } from './battlefield.ts';
import { endTurnSteps } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS } from './heroes.ts';
import { createSandboxWith, SANDBOX_SCENARIOS } from './sandbox.ts';

const scenario = SANDBOX_SCENARIOS.find(({ id }) => id === 'apollyonSeraph')!;

void test('Apollyon Seraph starts centered in front of two Biblical Angels', () => {
  const fight = createSandboxWith(19, scenario.heroIds, scenario.startsInPlace);
  assert.deepEqual(fight.heroes.map(({ heroId, row, col }) => [heroId, row, col]), [
    ['apollyonSeraph', 'front', 1],
    ['angelArcher', 'back', 0],
    ['angelArcher', 'back', 2],
  ]);
  const occupied = fight.heroes.flatMap(cellsOf).map(({ row, col }) => row + ':' + col);
  assert.equal(new Set(occupied).size, occupied.length);
  assert.equal(getHero('apollyonSeraph').tier, 'elite');
  assert.equal(isImmovable(fight.heroes[0]!), false);
  const ranked = [...GRUNT_IDS, ...ELITE_IDS, ...CHAMPION_IDS];
  assert.ok(scenario.heroIds.every((heroId) => !ranked.includes(heroId)));
});

void test('Apollyon uses a defensive opener and both Biblical Angels support it', () => {
  const fight = createSandboxWith(19, scenario.heroIds, scenario.startsInPlace);
  const first = endTurnSteps(fight).find(({ move }) => move?.name === 'Seal of the Host');
  assert.ok(first);
  assert.equal(first.state.heroes[0]?.guard, 10);
  assert.equal(first.state.heroes[0]?.statuses.protection, 1);

  const injured = { ...fight, heroes: fight.heroes.map((hero) => ({ ...hero, moveIndex: 1, hp: hero.heroId === 'apollyonSeraph' ? hero.hp - 20 : hero.hp })) };
  const heals = endTurnSteps(injured).filter(({ move }) => move?.name === 'Healing Light');
  assert.equal(heals.length, 2);
  assert.equal(heals.at(-1)?.state.heroes[0]?.hp, getHero('apollyonSeraph').maxHp - 8);
});
