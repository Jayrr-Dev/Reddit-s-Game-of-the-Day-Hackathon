import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPlayCard, endTurn, fatigueAt, handCardCost, playCard, startPlayerTurn } from './combat.ts';
import { addStatus, endOfTurnUpkeep } from './combatant.ts';
import { pullHero, pushHero } from './battlefield.ts';
import { cardCost, getCard } from './cards.ts';
import { fatigueName } from './describe.ts';
import { createSandboxWith } from './sandbox.ts';
import { canMove, movementBlockReason, movementCost, offeredMovement } from './movement.ts';
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

// --- WHO LAYS THEM ---
void test("Sir Brannoc's Gatebreaker pins you; the Priest's Smite fatigues you", () => {
  const knight = endTurn(endTurn(createSandboxWith(3, ['brannoc'], true)));
  assert.equal(knight.player.statuses.pin, 1);
  const priest = endTurn(createSandboxWith(3, ['priest'], true));
  assert.equal(priest.hand.filter((_, index) => fatigueAt(priest, index) === 1).length, 1);
});

// --- FATIGUE ALL ---
void test('Fatigue 1 ALL raises every card in the next hand by 1', () => {
  const state = fight();
  const tired = startPlayerTurn({ ...state, player: addStatus(state.player, 'fatigueAll', 1) });
  assert.ok(tired.hand.length > 0);
  assert.ok(tired.hand.every((_, index) => fatigueAt(tired, index) === 1));
  assert.equal(tired.player.statuses.fatigueAll, 0);
});

void test('Fatigue 1 ALL Movement raises only Movement cards, Charge and Back Step', () => {
  const state = fight();
  const player = { ...addStatus(state.player, 'fatigueAll', 1), fatigueAllType: 'movement' as const };
  const tired = startPlayerTurn({ ...state, hand: [], handImbues: [], drawPile: ['chargeForward', 'backhand', 'retreat', 'backhand', 'backhand'], discardPile: [], player });
  assert.deepEqual(tired.hand.map((_, index) => fatigueAt(tired, index)), tired.hand.map((id) => (getCard(id).type === 'movement' ? 1 : 0)));
  assert.equal(tired.movementFatigue, 1);
  const offered = offeredMovement(tired);
  assert.ok(offered);
  assert.equal(movementCost(tired, offered), movementCost({ ...tired, movementFatigue: 0 }, offered) + 1);
  assert.equal(fatigueName({ amount: 1, all: true, cardType: 'movement' }), 'Fatigue 1 ALL Movement');
});
