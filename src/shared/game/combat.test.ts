// ===================================================================
// COMBAT ENGINE TESTS
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CardId } from './cards.ts';
import {
  attackDamage,
  endOfTurnUpkeep,
  takeDamage,
  createCombatant,
} from './combatant.ts';
import {
  canPlayCard,
  combatOutcome,
  endTurn,
  playCard,
  startCombat,
} from './combat.ts';
import { CARDS_PER_TURN, ENERGY_PER_TURN } from './rules.ts';
import type { CombatState } from './types.ts';

// --- FIXTURES ---
/** A fight against one Squire with the given deck. */
const fightWith = (deck: CardId[]): CombatState =>
  startCombat({
    hp: 60,
    maxHp: 60,
    deck,
    heroIds: ['squire'],
    might: 1,
    seed: 7,
  });

/** Puts a specific card in hand slot 0 so a test controls what is played. */
const withHand = (state: CombatState, hand: CardId[]): CombatState => ({
  ...state,
  hand,
});

// --- COMBATANT RULES ---
void test('shroud absorbs damage before HP', () => {
  const shrouded = { ...createCombatant(20, 20), shroud: 5 };
  const hit = takeDamage(shrouded, 8);
  assert.equal(hit.shroud, 0);
  assert.equal(hit.hp, 17);
});

void test('wrath adds to each hit and dread cuts damage by 25%', () => {
  const base = createCombatant(10, 10);
  assert.equal(
    attackDamage(6, { ...base, statuses: { hex: 0, dread: 0, wrath: 2 } }),
    8
  );
  assert.equal(
    attackDamage(8, { ...base, statuses: { hex: 0, dread: 1, wrath: 0 } }),
    6
  );
});

void test('hex deals its damage at end of turn and then drops by one', () => {
  const hexed = {
    ...createCombatant(20, 20),
    statuses: { hex: 3, dread: 1, wrath: 0 },
  };
  const after = endOfTurnUpkeep(hexed);
  assert.equal(after.hp, 17);
  assert.deepEqual(after.statuses, { hex: 2, dread: 0, wrath: 0 });
});

// --- TURN FLOW ---
void test('a fight starts with a full hand and full energy', () => {
  const state = fightWith(Array<CardId>(10).fill('backhand'));
  assert.equal(state.hand.length, CARDS_PER_TURN);
  assert.equal(state.energy, ENERGY_PER_TURN);
  assert.equal(state.turn, 1);
});

void test('playing a card spends energy and damages the target', () => {
  const state = withHand(fightWith(Array<CardId>(10).fill('backhand')), [
    'backhand',
  ]);
  const after = playCard(state, 0, 1);
  assert.equal(after.energy, ENERGY_PER_TURN - 1);
  assert.equal(after.heroes[0]?.hp, 14 - 6);
  assert.deepEqual(after.discardPile, ['backhand']);
});

void test('a card that costs too much is refused', () => {
  const broke = { ...withHand(fightWith(['ruin']), ['ruin']), energy: 1 };
  assert.equal(canPlayCard(broke, 0), false);
  assert.equal(playCard(broke, 0, 1), broke);
});

void test('a fading card leaves the fight after use', () => {
  const after = playCard(withHand(fightWith(['seethe']), ['seethe']), 0, 1);
  assert.deepEqual(after.fadedPile, ['seethe']);
  assert.equal(after.player.statuses.wrath, 2);
});

void test('killing the last hero wins the fight and counts it as slain', () => {
  const state = withHand(fightWith(['undyingHatred']), ['undyingHatred']);
  const after = playCard(state, 0, 1);
  assert.equal(combatOutcome(after), 'won');
  assert.equal(after.slain, 1);
});

void test('a stale target falls back to a living hero', () => {
  const after = playCard(
    withHand(fightWith(['backhand']), ['backhand']),
    0,
    99
  );
  assert.equal(after.heroes[0]?.hp, 8);
});

void test('ending the turn lets the hero act and deals a new hand', () => {
  const state = fightWith(Array<CardId>(10).fill('backhand'));
  const after = endTurn(state);
  assert.equal(after.player.hp, 60 - 5); // Squire opens with Swing (5).
  assert.equal(after.turn, 2);
  assert.equal(after.hand.length, CARDS_PER_TURN);
  assert.equal(after.heroes[0]?.moveIndex, 1);
});
