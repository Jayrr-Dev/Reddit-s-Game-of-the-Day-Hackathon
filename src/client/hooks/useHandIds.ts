// ===================================================================
// USE HAND IDS
// The engine's hand is a plain list of card ids, so two Backhands look
// the same and every card after a played one shifts down an index.
// This hook gives each card in hand a stable React key: when the hand
// changes, cards that are still there keep their key (matched in order),
// and only new cards get new keys. Stable keys let the fan slide cards
// into their new places instead of remounting (and jumping) them.
// ===================================================================

import { useState } from 'react';
import type { CardId } from '../../shared/game/cards';

// --- TYPES ---
/** The last hand seen, with the key given to each of its cards. */
type KeyedHand = {
  turn: number;
  cards: readonly CardId[];
  keys: string[];
  /** The next fresh key number (keys are never reused). */
  nextId: number;
};

// --- HELPERS ---
/**
 * Carries keys from the old hand to the new one. Walks both lists in
 * order; a card that matches the next old card keeps its key, an old
 * card with no match was played or discarded and is skipped, and any
 * leftover new card gets a fresh key from `nextKey`.
 */
const carryKeys = (
  old: KeyedHand,
  cards: readonly CardId[],
  nextKey: () => string
): string[] => {
  let oldIndex = 0;
  return cards.map((cardId) => {
    while (oldIndex < old.cards.length && old.cards[oldIndex] !== cardId)
      oldIndex += 1;
    const key = old.keys[oldIndex];
    oldIndex += 1;
    return key ?? nextKey();
  });
};

/** True when the hand (and turn) is exactly the one already keyed. */
const isSameHand = (
  keyed: KeyedHand,
  cards: readonly CardId[],
  turn: number
): boolean =>
  keyed.turn === turn &&
  keyed.cards.length === cards.length &&
  keyed.cards.every((cardId, index) => cardId === cards[index]);

/** Keys a new hand, reusing the old keys when it is the same turn. */
const rekey = (
  old: KeyedHand,
  cards: readonly CardId[],
  turn: number
): KeyedHand => {
  let nextId = old.nextId;
  const nextKey = () => `card-${nextId++}`;
  const start = old.turn === turn ? old : { ...old, turn, cards: [], keys: [] };
  const keys = carryKeys(start, cards, nextKey);
  return { turn, cards: [...cards], keys, nextId };
};

const EMPTY: KeyedHand = { turn: -1, cards: [], keys: [], nextId: 0 };

// --- HOOK ---
/** Returns one stable key per card in hand (fresh each new turn). */
export const useHandIds = (
  cards: readonly CardId[],
  turn: number
): string[] => {
  const [keyed, setKeyed] = useState(() => rekey(EMPTY, cards, turn));
  if (isSameHand(keyed, cards, turn)) return keyed.keys;
  // The hand changed: re-key now (React's "adjust state while
  // rendering" pattern), so this very render already uses the new keys.
  const next = rekey(keyed, cards, turn);
  setKeyed(next);
  return next.keys;
};
