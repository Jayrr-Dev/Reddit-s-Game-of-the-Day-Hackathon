// ===================================================================
// CARD RELEASES TESTS
// The release list must cover every card once, and the "New cards"
// test deck must hold exactly the newest cards from it.
// ===================================================================

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CARD_RELEASE_ORDER,
  isReleaseOrderComplete,
  newestCardIds,
} from './cardReleases.ts';
import { NEW_CARDS_COUNT, sandboxDeckCards } from './sandboxDecks.ts';

// --- TESTS ---
void test('every card is in the release order exactly once', () => {
  assert.ok(
    isReleaseOrderComplete(),
    'append each new card id to CARD_RELEASE_ORDER'
  );
});

void test('newest cards come from the end of the release order, newest first', () => {
  assert.deepEqual(newestCardIds(2), [
    CARD_RELEASE_ORDER.at(-1),
    CARD_RELEASE_ORDER.at(-2),
  ]);
});

void test('New cards deck holds the 10 newest cards, two copies each', () => {
  const cards = sandboxDeckCards('newCards');
  const newest = newestCardIds(NEW_CARDS_COUNT);
  assert.equal(new Set(cards).size, 10);
  assert.deepEqual(new Set(cards), new Set(newest));
  assert.equal(cards.length, 20);
});
