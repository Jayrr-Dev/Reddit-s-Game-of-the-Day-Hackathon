import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTurnSteps } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS } from './heroes.ts';
import { createSandboxWith, groupScenariosByUnitType } from './sandbox.ts';

const lineups = [
  { id: 'greed', row: 'back', opening: 'Hoard', signature: 'Golden Tribute' },
  { id: 'envy', row: 'front', opening: 'Venom Spit', signature: 'Viridian Flood' },
  { id: 'sloth', row: 'front', opening: 'Basalt Layer', signature: 'Mountain Breaker' },
  { id: 'pride', row: 'front', opening: 'Royal Challenge', signature: 'Sovereign’s Verdict' },
  { id: 'lust', row: 'back', opening: 'Beckon', signature: 'Velvet Thrall' },
  { id: 'gluttony', row: 'front', opening: 'Ravenous Lash', signature: 'Devour' },
] as const;

void test('The six enemy Sins each have a solo boss fight; none enters random hordes', () => {
  const sins = groupScenariosByUnitType().find(group => group.unitType === 'sin');
  assert.ok(sins);
  assert.deepEqual(sins.scenarios.map(scenario => scenario.id), lineups.map(option => option.id));
  for (const option of lineups) {
    const hero = getHero(option.id);
    assert.equal(hero.tier, 'boss');
    assert.ok(![...GRUNT_IDS, ...ELITE_IDS, ...CHAMPION_IDS].includes(option.id));
    const scenario = sins.scenarios.find(item => item.id === option.id);
    assert.ok(scenario);
    const fight = createSandboxWith(19, scenario.heroIds, scenario.startsInPlace);
    assert.deepEqual(fight.heroes.map(unit => [unit.heroId, unit.row, unit.col]), [[option.id, option.row, 1]]);
    const opener = endTurnSteps(fight).find(step => step.move?.name === option.opening);
    assert.ok(opener);
    const signature = hero.moves.find(move => move.isSignature);
    assert.equal(signature?.name, option.signature);

    if (option.id === 'greed') assert.equal(opener.state.heroes[0]?.guard, 14);
    if (option.id === 'envy') assert.equal(opener.state.player.statuses.poison, 3);
    if (option.id === 'sloth') assert.equal(opener.state.heroes[0]?.guard, 20);
    if (option.id === 'pride') assert.equal(opener.state.heroes[0]?.statuses.wrath, 3);
    if (option.id === 'lust') assert.equal(opener.state.player.statuses.hex, 3);
    if (option.id === 'gluttony') assert.equal(opener.move?.effects.find(effect => effect.kind === 'attack')?.hits, 2);
  }
});

void test('The four new signatures keep their distinctive counterplay', () => {
  const move = (id: 'sloth' | 'pride' | 'lust' | 'gluttony') => getHero(id).moves.find(candidate => candidate.isSignature);
  assert.ok(move('sloth')?.effects.some(effect => effect.kind === 'knockBack'));
  assert.ok(move('pride')?.effects.some(effect => effect.kind === 'attack' && effect.hits === 2));
  assert.ok(move('lust')?.effects.some(effect => effect.kind === 'malaise' && effect.amount === 1));
  assert.ok(move('gluttony')?.effects.some(effect => effect.kind === 'heal' && effect.who === 'self'));
});
