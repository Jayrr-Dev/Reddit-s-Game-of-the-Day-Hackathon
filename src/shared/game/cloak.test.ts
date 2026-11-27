import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCardEffect, describeHeroIntent } from './describe.ts';
import { autoTargets, endTurn, endTurnSteps, playCard, targetsFor } from './combat.ts';
import { addStatus } from './combatant.ts';
import { getCard, type CardId } from './cards.ts';
import { createSandboxWith } from './sandbox.ts';
import { move } from './movement.ts';
import type { CombatState } from './types.ts';

const fight = () => createSandboxWith(19, ['angelAssassin', 'squire'], true);
const withCard = (state: CombatState, card: CardId): CombatState => ({
  ...state, hand: [card], handImbues: [[]], energy: 4,
});

void test('Cloak 2 is described in rules and on the Assassin’s intent', () => {
  const state = fight();
  assert.equal(describeCardEffect({ kind: 'cloak', amount: 2 }, getCard('darkCloak')), 'Cloak 2');
  assert.equal(describeHeroIntent(state.heroes[0]!, state.heroes).intents[0]?.kind, 'cloak');
});

void test('Cloak 2 excludes direct and automatic aim, and the Assassin reveals on attack', () => {
  const state = endTurn(fight());
  const [assassin, squire] = state.heroes;
  assert.ok(assassin && squire);
  assert.equal(assassin.statuses.cloak, 2);
  const aimed = withCard(state, 'arcaneBolt');
  assert.deepEqual(targetsFor(aimed, 'arcaneBolt', 0).map(unit => unit.uid), [squire.uid]);
  assert.deepEqual(autoTargets(aimed, 0), [squire.uid]);
  assert.equal(playCard(aimed, 0, assassin.uid), aimed);
  const attack = endTurnSteps(state).find(step => step.move?.name === 'Silent Strike');
  assert.ok(attack);
  assert.equal(attack.state.heroes[0]?.statuses.cloak, 0);
  assert.ok(attack.state.player.hp < state.player.hp);
});

void test('Cloak lasts two opposing turns, but does not stop area attacks or existing poison', () => {
  const hidden = endTurn(fight());
  const [assassin, squire] = hidden.heroes;
  assert.ok(assassin && squire);
  const area = playCard(withCard(hidden, 'cleave'), 0, -1);
  assert.ok(area.heroes[0]!.hp < assassin.hp);
  const poisoned = { ...hidden, heroes: [addStatus(assassin, 'poison', 1), squire], waveArrival: true };
  const afterOne = endTurn(poisoned);
  assert.equal(afterOne.heroes[0]?.statuses.cloak, 1);
  const afterTwo = endTurn({ ...afterOne, waveArrival: true });
  assert.equal(afterTwo.heroes[0]?.statuses.cloak, 0);
  const poisonBeat = endTurnSteps({ ...poisoned, waveArrival: false })
    .find(step => step.state.heroes[0]?.poisonDamageTaken === 1 && step.state.heroes[0]?.statuses.cloak === 1);
  assert.ok(poisonBeat && poisonBeat.state.heroes[0]!.hp < assassin.hp);
});

void test('The player stays cloaked through movement and a guard card, then reveals on an attack', () => {
  const base = fight();
  const hidden = { ...base, player: addStatus(base.player, 'cloak', 2) };
  const guarded = playCard(withCard(hidden, 'darkCloak'), 0, -1);
  assert.equal(guarded.player.statuses.cloak, 2);
  const moved = move(guarded, 'backStep');
  assert.notEqual(moved, guarded);
  assert.equal(moved.player.statuses.cloak, 2);
  const attacked = playCard(withCard(moved, 'arcaneBolt'), 0, moved.heroes[0]!.uid);
  assert.equal(attacked.player.statuses.cloak, 0);
  const afterOne = endTurn(hidden);
  assert.equal(afterOne.player.hp, hidden.player.hp);
  assert.equal(afterOne.player.statuses.cloak, 1);
  const afterTwo = endTurn(afterOne);
  assert.equal(afterTwo.player.hp, hidden.player.hp);
  assert.equal(afterTwo.player.statuses.cloak, 0);
});

void test('Random shots never choose a cloaked unit', () => {
  const state = endTurn(fight());
  const random = playCard(withCard(state, 'wildVolley'), 0, -1);
  assert.equal(random.heroes[0]?.hp, state.heroes[0]?.hp);
  assert.ok(random.heroes[1]?.hp !== state.heroes[1]?.hp);
});
