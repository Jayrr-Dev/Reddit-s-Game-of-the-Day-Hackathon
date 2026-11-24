// ===================================================================
// USE DRAW ORDER
// Which cards in hand were just drawn, and in what order, so each can
// fly in from the draw pile a beat after the one before it. A card is
// "just drawn" when its hand key (see useHandIds) was not in the hand
// the last time the hand changed.
// ===================================================================

import { useState } from 'react';

// --- TYPES ---
/** The hand as last seen, and the order its newest cards came in. */
type SeenHand = {
  keys: readonly string[];
  drawOrder: ReadonlyMap<string, number>;
};

// --- HELPERS ---
/** True when two key lists hold the same keys in the same order. */
const isSameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, index) => key === b[index]);

/** The keys in `keys` that `before` did not have, numbered in order. */
const newcomersOf = (
  before: readonly string[],
  keys: readonly string[]
): ReadonlyMap<string, number> => {
  const known = new Set(before);
  const drawn = keys.filter((key) => !known.has(key));
  return new Map(drawn.map((key, order) => [key, order]));
};

// --- HOOK ---
/**
 * For each hand key just drawn: its place among this draw (0 first).
 * Keys already in hand are absent. Derived during render (React's
 * "store the previous value" pattern), so no extra effect pass.
 */
export const useDrawOrder = (
  keys: readonly string[]
): ReadonlyMap<string, number> => {
  const [seen, setSeen] = useState<SeenHand>(() => ({
    keys,
    drawOrder: newcomersOf([], keys),
  }));
  if (isSameKeys(seen.keys, keys)) return seen.drawOrder;
  const next = { keys, drawOrder: newcomersOf(seen.keys, keys) };
  setSeen(next);
  return next.drawOrder;
};
