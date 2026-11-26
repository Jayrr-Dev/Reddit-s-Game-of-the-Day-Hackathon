import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endTurn, playCard, plannedHeroMove, startPlayerTurn } from './combat.ts';
import { addStatus } from './combatant.ts';
import { createSandboxWith } from './sandbox.ts';
import type { CombatState } from './types.ts';

// --- FIXTURES ---
/** Sir Brannoc has three moves, so a scramble always has somewhere to go. */
const fight = (): CombatState => ({ ...createSandboxWith(5, ['brannoc'], true), energy: 9 });
const withScrambleCard = (state: CombatState): CombatState => ({ ...state, hand: ['scramble'], handImbues: [[]] });

// --- ON AN ENEMY ---
void test('Scramble 1 swaps an enemy’s planned move for another of its moves', () => {
  const state = withScrambleCard(fight());
  const knight = state.heroes[0]!;
  const before = plannedHeroMove(knight, state.heroes)!.move.name;
  const after = playCard(state, 0, knight.uid);
  const scrambled = after.heroes[0]!;
  assert.equal(scrambled.statuses.scramble, 1);
  assert.notEqual(plannedHeroMove(scrambled, after.heroes)!.move.name, before);
});

void test('Scramble 1 lasts one turn; Scramble 2 re-rolls the move again for the next one', () => {
  const state = fight();
  const knight = state.heroes[0]!;
  const once = endTurn({ ...state, heroes: [addStatus(knight, 'scramble', 1)] });
  assert.equal(once.heroes[0]!.statuses.scramble, 0);
  const twice = endTurn({ ...state, heroes: [addStatus(knight, 'scramble', 2)] });
  assert.equal(twice.heroes[0]!.statuses.scramble, 1);
});

// --- ON THE VILLAIN ---
void test('A scrambled villain auto-plays one random playable card at turn start', () => {
  const state = fight();
  const started = startPlayerTurn({ ...state, player: addStatus(state.player, 'scramble', 1) });
  assert.ok(started.scrambledPlay);
  assert.equal(started.scrambledPlay.turn, started.turn);
  assert.equal(started.hand.length, startPlayerTurn(state).hand.length - 1);
});

void test('No scramble, no auto-play', () => {
  assert.equal(startPlayerTurn(fight()).scrambledPlay, undefined);
});
