// ===================================================================
// UNLOCKS TESTS
// A replayed run unlocks the heroes it killed, the cards in its deck
// and the maps it visited; admins (null access) see everything.
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_DECK } from './cards.ts';
import { createRun, replayRun } from './run.ts';
import { playBotRun } from './testBot.ts';
import {
  EMPTY_UNLOCKS,
  isLineupUnlocked,
  isUnlocks,
  mergeUnlocks,
  replayWithUnlocks,
  unlockedPracticeDeck,
} from './unlocks.ts';

const DAY = '2026-11-26';

test('a replayed run unlocks its kills, deck cards and maps', () => {
  const { actions } = playBotRun(DAY);
  const { state, unlocks } = replayWithUnlocks(createRun(DAY), actions);
  assert.deepEqual(state, replayRun(DAY, actions));
  assert.equal(new Set(unlocks.killedUnits).size, unlocks.killedUnits.length);
  assert.ok(unlocks.killedUnits.length > 0 && state.stats.heroesSlain > 0);
  assert.ok(unlocks.killedUnits.every((heroId) => unlocks.facedUnits.includes(heroId)));
  assert.ok(state.deck.every((cardId) => unlocks.deckCards.includes(cardId)));
  assert.ok(unlocks.visitedMaps.length > 0);
  assert.ok(isUnlocks(unlocks));
});

test('an empty log unlocks nothing', () => {
  const { unlocks } = replayWithUnlocks(createRun(DAY), []);
  assert.deepEqual(unlocks, EMPTY_UNLOCKS);
});

test('merging keeps every unlock once', () => {
  const a = { ...EMPTY_UNLOCKS, killedUnits: ['archer' as const], visitedMaps: ['Marsh'] };
  const b = { ...EMPTY_UNLOCKS, killedUnits: ['archer' as const, 'priest' as const] };
  assert.deepEqual(mergeUnlocks(a, b).killedUnits, ['archer', 'priest']);
  assert.deepEqual(mergeUnlocks(a, b).visitedMaps, ['Marsh']);
});

test('a lineup unlocks only when every unit was killed; admins see all', () => {
  const unlocks = { ...EMPTY_UNLOCKS, killedUnits: ['archer' as const] };
  assert.equal(isLineupUnlocked(unlocks, ['archer', 'archer']), true);
  assert.equal(isLineupUnlocked(unlocks, ['archer', 'priest']), false);
  assert.equal(isLineupUnlocked(null, ['priest']), true);
});

test('practice deck falls back to the starter deck before any run', () => {
  assert.deepEqual(unlockedPracticeDeck(EMPTY_UNLOCKS), [...STARTER_DECK]);
});
