// ===================================================================
// SEEDED RANDOMNESS
// Every random choice in a run (map, heroes, card offers, shuffles)
// comes from these pure functions. The RNG state is a plain number that
// is passed in and returned, never hidden in a closure, so:
//   1. everyone who plays the same day gets the same run, and
//   2. the server can replay a player's actions and get the same result.
// ===================================================================

// --- TYPES ---
/** The whole RNG state. Store it in game state and thread it through calls. */
export type RngState = number;

/** A value drawn from the RNG plus the state to use for the next draw. */
export type RngResult<T> = readonly [value: T, next: RngState];

// --- CONSTANTS ---
const UINT32_RANGE = 2 ** 32;

// --- SEEDING ---

/**
 * Hashes any string into a 32-bit seed (FNV-1a).
 * Used to turn "2026-11-23:floor-3" into a seed, so each part of a run
 * gets its own stream that does not shift when other parts change.
 */
export const hashSeed = (text: string): RngState => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

// --- DRAWS ---

/**
 * Returns a float in [0, 1) and the next state (mulberry32).
 * Mulberry32 is tiny, fast and has a full 2^32 period, which is plenty
 * for a card game and keeps the state a single serializable number.
 */
export const nextFloat = (state: RngState): RngResult<number> => {
  const next = (state + 0x6d2b79f5) >>> 0;
  let mixed = next;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  return [value, next];
};

/** Returns an integer in [0, maxExclusive) and the next state. */
export const nextInt = (
  state: RngState,
  maxExclusive: number
): RngResult<number> => {
  const [value, next] = nextFloat(state);
  return [Math.floor(value * maxExclusive), next];
};

/** Picks one item from a non-empty list. */
export const pickOne = <T>(
  state: RngState,
  items: readonly T[]
): RngResult<T> => {
  const [index, next] = nextInt(state, items.length);
  const item = items[index];
  if (item === undefined) throw new Error('pickOne needs a non-empty list');
  return [item, next];
};

/** Picks one item where each item's chance is proportional to its weight. */
export const pickWeighted = <T>(
  state: RngState,
  entries: readonly { item: T; weight: number }[]
): RngResult<T> => {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const [roll, next] = nextFloat(state);
  let remaining = roll * total;
  for (const entry of entries) {
    remaining -= entry.weight;
    if (remaining < 0) return [entry.item, next];
  }
  const last = entries.at(-1);
  if (!last) throw new Error('pickWeighted needs a non-empty list');
  return [last.item, next];
};

/** Returns a shuffled copy (Fisher-Yates); the input is never mutated. */
export const shuffle = <T>(
  state: RngState,
  items: readonly T[]
): RngResult<T[]> => {
  const result = [...items];
  let current = state;
  for (let index = result.length - 1; index > 0; index -= 1) {
    const [swapIndex, next] = nextInt(current, index + 1);
    current = next;
    const a = result[index];
    const b = result[swapIndex];
    if (a === undefined || b === undefined) continue;
    result[index] = b;
    result[swapIndex] = a;
  }
  return [result, current];
};

/** Picks `count` distinct items (or fewer if the list is shorter). */
export const pickDistinct = <T>(
  state: RngState,
  items: readonly T[],
  count: number
): RngResult<T[]> => {
  const [shuffled, next] = shuffle(state, items);
  return [shuffled.slice(0, count), next];
};
