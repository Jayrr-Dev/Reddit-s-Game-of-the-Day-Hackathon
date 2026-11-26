import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatOutcome, endTurn, endTurnSteps, plannedHeroMove, playCard, targetsFor } from './combat.ts';
import { addStatus } from './combatant.ts';
import { getHero } from './heroes.ts';
import { enterHeroSecondPhase } from './heroPhases.ts';
import { createSandboxWith } from './sandbox.ts';
import type { CombatState, HeroUnit } from './types.ts';

const staff = 'grandangelCerviel';
const bow = 'cervielBow';
const sword = 'cervielSword';

const fixture = (run: (state: CombatState) => void) => {
  const state = createSandboxWith(19, [sword], true);
  run({ ...state, player: { ...state.player, hp: 500, maxHp: 500 } });
};
const get = (s: CombatState, id: string) => {
  const unit = s.heroes.find(h => h.heroId === id);
  assert.ok(unit, id);
  return unit;
};
const withHero = (s: CombatState, id: string, f: (hero: HeroUnit) => HeroUnit): CombatState => (
  { ...s, heroes: s.heroes.map(unit => unit.heroId === id ? f(unit) : unit) }
);
const withBolt = (s: CombatState): CombatState => ({ ...s, hand: ['arcaneBolt'], energy: 10, handImbues: [[]] });
const lethal = (s: CombatState, id: string) => {
  const low = withBolt(withHero(s, id, u => ({ ...u, hp: 1, guard: 0 })));
  return playCard(low, 0, get(low, id).uid);
};

void test('Cerviel starts alone, then summons Staff left and Bow right once', () => fixture(state => {
  assert.equal(state.heroes.length, 1);
  const main = get(state, sword);
  assert.deepEqual([main.row, main.col], ['front', 1]);
  const turn1 = endTurn(state);
  assert.deepEqual([get(turn1, staff).row, get(turn1, staff).col, get(turn1, staff).summonerUid], ['back', 0, main.uid]);
  assert.equal(turn1.heroes.some(u => u.heroId === bow), false);
  const turn2 = endTurn(turn1);
  assert.deepEqual([get(turn2, bow).row, get(turn2, bow).col, get(turn2, bow).summonerUid], ['back', 2, main.uid]);
  assert.deepEqual(get(turn2, sword).summonedOnceIds, [staff, bow]);
  const staffDown = lethal(turn2, staff);
  assert.equal(staffDown.heroes.some(u => u.heroId === staff), false);
  const bowDown = lethal(staffDown, bow);
  assert.equal(bowDown.heroes.some(u => u.heroId === bow), false);
  const phaseTwo = lethal(bowDown, sword);
  for (let i = 0, round = phaseTwo; i < 4; i++, round = endTurn(round)) {
    assert.equal(round.heroes.length, 1);
    assert.equal(plannedHeroMove(get(round, sword), round.heroes)?.move.name, 'Sixfold Judgment');
  }
}));

void test('First lethal hit changes phase without a kill, preserves targeting; second is final', () => fixture(state => {
  const above = withHero(state, sword, u => ({ ...u, hp: 20 }));
  assert.equal(enterHeroSecondPhase(get(above, sword), getHero(sword)).phase, undefined);
  const withSummons = endTurn(endTurn(above));
  const original = get(withSummons, sword);
  const transformed = lethal(withSummons, sword);
  const phaseTwo = get(transformed, sword);
  assert.equal(phaseTwo.uid, original.uid);
  assert.equal(phaseTwo.hp, Math.ceil(phaseTwo.maxHp / 2));
  assert.equal(phaseTwo.phase, 2);
  assert.equal(transformed.slain, withSummons.slain);
  assert.equal(transformed.fallen.length, 0);
  assert.equal(transformed.heroes.length, 3);
  assert.ok(targetsFor(withBolt(transformed), 'arcaneBolt', 0).some(u => u.uid === phaseTwo.uid));
  const volley = endTurnSteps(transformed).find(step => step.actorUid === phaseTwo.uid);
  assert.equal(volley?.move?.name, 'Sixfold Judgment');
  assert.ok(volley?.move?.effects.some(e => e.kind === 'attack' && e.hits === 6));
  const final = lethal(transformed, sword);
  assert.equal(combatOutcome(final), 'won');
  assert.equal(final.heroes.length, 0);
  assert.equal(final.fallen.length, 3);
}));

void test('Lethal Poison also triggers the transition, and unused summons remain available', () => fixture(state => {
  const poisoned = withHero(state, sword, u => addStatus({ ...u, hp: 1 }, 'poison', 2));
  const phaseTwo = endTurn(poisoned);
  assert.equal(get(phaseTwo, sword).phase, 2);
  assert.deepEqual(get(phaseTwo, sword).summonedOnceIds, [staff]);
  assert.equal(get(phaseTwo, staff).col, 0);
  assert.equal(get(endTurn(phaseTwo), bow).col, 2);
}));

void test('A blocked summon does not consume the once-per-fight allowance', () => fixture(state => {
  const blocker = createSandboxWith(12, ['bard'], true).heroes[0]!;
  const blocked: CombatState = {
    ...state, nextUid: 3, heroes: [...state.heroes, { ...blocker, row: 'back', col: 0, uid: 2 }],
  };
  assert.equal(plannedHeroMove(get(blocked, sword), blocked.heroes)?.move.name, 'Call Bow');
  const calledBow = endTurn(blocked);
  assert.deepEqual(get(calledBow, sword).summonedOnceIds, [bow]);
  const opened = { ...calledBow, heroes: calledBow.heroes.filter(h => h.heroId !== 'bard') };
  assert.equal(endTurnSteps(opened).some(step => step.move?.name === 'Call Staff'), false);
  let cycled = opened;
  for (let turn = 0; turn < 8 && !get(cycled, sword).summonedOnceIds?.includes(staff); turn++) cycled = endTurn(cycled);
  assert.deepEqual(get(cycled, sword).summonedOnceIds, [bow, staff]);
}));
