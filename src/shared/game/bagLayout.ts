// ===================================================================
// BAG LAYOUT
// Where each owned stack sits in the backpack grid and the belt strip.
// The layout only stores positions (slot keys); what the player owns
// and how many always come from the inventory, so a stale layout can
// never create or hide an item.
// ===================================================================
import { BACKPACK_COLUMNS, BACKPACK_SLOTS, BELT_SLOTS } from '../constants/game.ts';

// --- TYPES ---
export type BagArea = 'backpack' | 'belt';
/** One cell: which area, and its index in that area. */
export type BagCell = { area: BagArea; index: number };
/** Slot keys (e.g. "card:backhand") by cell; null is an empty cell. */
export type BagLayout = { backpack: (string | null)[]; belt: (string | null)[] };

// --- LIMITS ---
/** Longest slot key a saved layout may hold. */
const MAX_KEY_LENGTH = 64;
/** Most backpack cells a saved layout may hold. */
const MAX_BACKPACK_CELLS = 64;

// --- HELPERS ---
/** Empty cells for one area. */
const emptyCells = (count: number): (string | null)[] => Array<string | null>(count).fill(null);
/** Rounds a cell count up to whole backpack rows. */
const wholeRows = (count: number) => Math.ceil(count / BACKPACK_COLUMNS) * BACKPACK_COLUMNS;
/** Copies a layout so edits never touch the caller's arrays. */
const cloneLayout = (layout: BagLayout): BagLayout => ({ backpack: [...layout.backpack], belt: [...layout.belt] });

// --- VALIDATION ---
/** True for a saved layout of short string keys or empty cells, within the size limits. */
export function isBagLayout(data: unknown): data is BagLayout {
  if (!data || typeof data !== 'object' || !('backpack' in data) || !('belt' in data)) return false;
  const cellsOk = (cells: unknown, max: number) =>
    Array.isArray(cells) && cells.length <= max &&
    cells.every((key) => key === null || (typeof key === 'string' && key.length <= MAX_KEY_LENGTH));
  return cellsOk(data.backpack, MAX_BACKPACK_CELLS) && cellsOk(data.belt, BELT_SLOTS);
}

// --- ARRANGE ---
/**
 * Fits the owned stacks into the saved layout: kept stacks stay where they
 * were, gone ones leave their cell empty, and new ones fill the first free
 * backpack cells (adding rows when the backpack is full).
 */
export function arrangeBag(saved: BagLayout | undefined, ownedKeys: readonly string[]): BagLayout {
  const owned = new Set(ownedKeys);
  const placed = new Set<string>();
  /** Keeps a key only if it is owned and not already placed. */
  const keep = (key: string | null) => {
    if (key === null || !owned.has(key) || placed.has(key)) return null;
    placed.add(key);
    return key;
  };
  const belt = emptyCells(BELT_SLOTS).map((_, i) => keep(saved?.belt[i] ?? null));
  const backpack = (saved?.backpack ?? []).map(keep);
  const unplaced = ownedKeys.filter((key) => !placed.has(key));
  const size = Math.max(BACKPACK_SLOTS, wholeRows(backpack.filter((k) => k !== null).length + unplaced.length));
  const cells = [...backpack, ...emptyCells(size)].slice(0, Math.max(size, backpack.length));
  for (const key of unplaced) cells[cells.indexOf(null)] = key;
  // Trim trailing empty rows beyond the minimum size.
  while (cells.length > BACKPACK_SLOTS && cells.slice(-BACKPACK_COLUMNS).every((k) => k === null))
    cells.splice(-BACKPACK_COLUMNS);
  return { backpack: cells, belt };
}

// --- EDITS ---
/** The key in one cell. */
export const keyAt = (layout: BagLayout, cell: BagCell) => layout[cell.area][cell.index] ?? null;

/** Moves a stack to another cell; a stack already there swaps into the old cell. */
export function moveStack(layout: BagLayout, from: BagCell, to: BagCell): BagLayout {
  const next = cloneLayout(layout);
  const moving = keyAt(layout, from);
  if (moving === null || to.index >= next[to.area].length) return layout;
  next[from.area][from.index] = keyAt(layout, to);
  next[to.area][to.index] = moving;
  return next;
}

/** Puts a stack in a cell (used when an unequipped item returns to the bag). */
export function placeStack(layout: BagLayout, key: string, to: BagCell): BagLayout {
  const next = cloneLayout(layout);
  const displaced = keyAt(layout, to);
  for (const area of ['backpack', 'belt'] as const)
    next[area] = next[area].map((k) => (k === key ? null : k));
  next[to.area][to.index] = key;
  if (displaced !== null && displaced !== key) {
    const free = next.backpack.indexOf(null);
    if (free >= 0) next.backpack[free] = displaced;
    else next.backpack.push(displaced, ...emptyCells(BACKPACK_COLUMNS - 1));
  }
  return next;
}

/** Packs the backpack's stacks to the front in the given order; the belt stays as it is. */
export function sortBackpack(layout: BagLayout, order: readonly string[]): BagLayout {
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i < 0 ? order.length : i;
  };
  const keys = layout.backpack.filter((k) => k !== null).sort((a, b) => rank(a) - rank(b));
  return { backpack: [...keys, ...emptyCells(layout.backpack.length - keys.length)], belt: [...layout.belt] };
}
