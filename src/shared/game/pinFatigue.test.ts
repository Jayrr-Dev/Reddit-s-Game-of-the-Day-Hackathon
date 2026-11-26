import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPlayCard, endTurn, fatigueAt, handCardCost, playCard, startPlayerTurn } from './combat.ts';
import { addStatus, endOfTurnUpkeep } from './combatant.ts';
import { pullHero, pushHero } from './battlefield.ts';
import { cardCost } from './cards.ts';
import { createSandboxWith } from './sandbox.ts';
import { canMove, movementBlockReason, offeredMovement } from './movement.ts';
import type { CombatState } from './types.ts';

// --- FIXTURES ---
const fight = () => createSandboxWith(7, ['squire', 'squire'], true);
const pinVillain = (state: CombatState, turns: number): CombatState => ({
  ...state, player: addStatus(state.player, 'pin', turns), energy: 9,
});

// --- PIN ---
void test('Pin stops the villain from moving until it wears off', () => {
  const state = fight();
  const offered = offeredMovement(state);
  assert.ok(offered);
  const pinned = pinVillain(state, 1);
  assert.equal(canMove(pinned, offered), false);
  assert.match(movementBlockReason(pinned, offered) ?? '', /Pinned/);
  // Pin 1 = 1 turn: gone after the villain's own upkeep.
  assert.equal(endOfTurnUpkeep(pinned.player).statuses.pin, 0);
});

void test('Pin never stacks past its longest duration', () => {
  const twice = addStatus(addStatus(fight().player, 'pin', 2), 'pin', 1);
  assert.equal(twice.statuses.pin, 2);
});

void test('A pinned hero holds its line against Pull and Knockback', () => {
  const state = fight();
  const hero = state.heroes[0]!;
  // Unpinned, a Knockback does move this hero.
  assert.notEqual(pushHero(state.heroes, hero.uid, 1).find((u) => u.uid === hero.uid)?.row, hero.row);
  const pinned = state.heroes.map((unit) => (unit.uid === hero.uid ? addStatus(unit, 'pin', 1) : unit));
  assert.equal(pushHero(pinned, hero.uid, 1).find((u) => u.uid === hero.uid)?.row, hero.row);
  assert.equal(pullHero(pinned, hero.uid, 1).find((u) => u.uid === hero.uid)?.row, hero.row);
});

// --- FATIGUE ---
void test('Fatigue 1 raises one random card in the new hand by 1, then clears', () => {
  const state = fight();
  const tired = startPlayerTurn({ ...state, player: addStatus(state.player, 'fatigue', 1) });
  const surcharged = tired.hand.map((_, index) => fatigueAt(tired, index));
  assert.equal(surcharged.filter((extra) => extra === 1).length, 1);
  assert.equal(tired.player.statuses.fatigue, 0);
  const slot = surcharged.indexOf(1);
  const id = tired.hand[slot]!;
  assert.equal(handCardCost(tired, slot), cardCost(id, 0, false) + 1);
});

void test('A fatigued card needs the extra energy, and Fatigue ends with the turn', () => {
  const state = fight();
  const tired = startPlayerTurn({ ...state, player: addStatus(state.player, 'fatigue', 1) });
  const slot = tired.hand.findIndex((_, index) => fatigueAt(tired, index) > 0);
  const short = { ...tired, energy: handCardCost(tired, slot) - 1 };
  assert.equal(canPlayCard(short, slot), false);
  assert.equal(playCard(short, slot, short.heroes[0]!.uid), short);
  const next = endTurn({ ...tired, waveArrival: true });
  assert.ok(next.hand.every((_, index) => fatigueAt(next, index) === 0));
});
