import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTurnSteps, plannedHeroMove } from './combat.ts';
import { getHero } from './heroes.ts';
import { createSandboxWith, SANDBOX_SCENARIOS } from './sandbox.ts';

void test('Zeruel summons Alpha and Omega once on his back flanks', () => {
  const encounter = SANDBOX_SCENARIOS.find(({ id }) => id === 'archangelZeruel')!;
  const fight = createSandboxWith(19, encounter.heroIds, encounter.startsInPlace);
  assert.deepEqual(fight.heroes.map(({ heroId }) => heroId), ['archangelZeruel']);
  const zeruel = fight.heroes[0]!;
  const call = endTurnSteps(fight).find(beat => beat.move?.name === 'Call the Twin Suns');
  assert.ok(call);
  const suns = call.state.heroes.filter(unit => unit.summonerUid === zeruel.uid);
  assert.deepEqual(suns.map(unit => [getHero(unit.heroId).name, unit.row, unit.col]), [
    ['Alpha', 'back', 0],
    ['Omega', 'back', 2],
  ]);
  assert.ok(suns.every(unit => unit.onceSummoned && unit.joinedMidFight));
  const after = call.state.heroes.find(unit => unit.uid === zeruel.uid)!;
  assert.notEqual(plannedHeroMove({ ...after, moveIndex: 0 }, [after])?.move.name, 'Call the Twin Suns');
});
