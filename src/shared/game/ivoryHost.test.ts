import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellsOf, isAnchored } from './battlefield.ts';
import { endTurnSteps, plannedHeroMoves } from './combat.ts';
import { ELITE_IDS, GRUNT_IDS, getHero } from './heroes.ts';
import { createSandboxWith, SANDBOX_SCENARIOS } from './sandbox.ts';

const host = SANDBOX_SCENARIOS.find(({ id }) => id === 'ivoryHost')!;

void test('Ivory Host adds five independent enemies without changing ranked pools', () => {
  const fight = createSandboxWith(19, host.heroIds, true);
  assert.equal(fight.heroes.length, 5);
  assert.equal(new Set(fight.heroes.map(({ heroId }) => heroId)).size, 5);
  const occupied = fight.heroes.flatMap(cellsOf).map(({ row, col }) => row + ':' + col);
  assert.equal(new Set(occupied).size, occupied.length);
  for (const id of host.heroIds) {
    assert.ok(!ELITE_IDS.includes(id) && !GRUNT_IDS.includes(id));
  }
  const sentinel = fight.heroes.find(({ heroId }) => heroId === 'hornedSentinel')!;
  assert.equal(getHero(sentinel.heroId).armor, 2);
  assert.equal(isAnchored(sentinel), false);
  assert.deepEqual(fight.heroes.map(hero => plannedHeroMoves(hero, fight.heroes)[0]?.move.name).sort(),
    ['Absolution', 'Conducting Thrust', 'Heartpiercer', 'Plant the Hammer', 'Unravel']);
});

void test('Angel Mage uses Borrowed Time to protect every ally', () => {
  const scenario = SANDBOX_SCENARIOS.find(({ id }) => id === 'angelMage')!;
  const fight = createSandboxWith(19, scenario.heroIds, true);
  assert.equal(fight.heroes.length, 3);
  const beat = endTurnSteps(fight).find(({ move }) => move?.name === 'Borrowed Time');
  assert.ok(beat);
  assert.ok(beat.state.heroes.every(({ statuses }) => statuses.protection === 1));
  assert.ok(beat.state.heroes.every(({ guard }) => guard >= 5));
});

void test('Oracle telegraphs and applies the one-turn Buff lock', () => {
  const fight = createSandboxWith(19, ['sevenEyedOracle'], true);
  const tagged = { ...fight, heroes: fight.heroes.map(h => ({ ...h, moveIndex: 2 })) };
  const spell = endTurnSteps(tagged).find(({ move }) => move?.name === 'Edict of Silence');
  assert.ok(spell);
  assert.equal(spell.state.player.statuses.malaise, 1);
  assert.equal(spell.state.player.hp, tagged.player.hp);
});

void test('Holy King has a dedicated solo boss encounter and actually applies Royal Aegis', () => {
  const scenario = SANDBOX_SCENARIOS.find(({ id }) => id === 'holyKing')!;
  const fight = createSandboxWith(19, scenario.heroIds, true);
  assert.deepEqual(fight.heroes.map(({ heroId }) => heroId), ['holyKing']);
  const king = fight.heroes[0]!;
  assert.equal(getHero(king.heroId).tier, 'boss');
  const beat = endTurnSteps(fight).find(({ move }) => move?.name === 'Royal Aegis');
  assert.ok(beat);
  assert.equal(beat.state.heroes[0]?.guard, 14);
  assert.equal(beat.state.heroes[0]?.statuses.protection, 1);
});

