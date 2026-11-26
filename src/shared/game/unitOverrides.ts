// ===================================================================
// UNIT STAT OVERRIDES
// Balance tweaks an admin makes in the game (HP, speed, armor), layered
// over the hero catalog. The catalog in heroes.ts stays the source of
// truth: an override only replaces the stats it names, and removing it
// brings back the catalog value. getHero reads the active overrides, so
// every screen and the server's run replay see the same numbers.
// ===================================================================

import type { HeroDef } from './types.ts';

// --- TYPES ---
/** The stats an admin can change. */
export type EditableUnitStat = 'maxHp' | 'speed' | 'armor';

/** One unit's changed stats; a missing stat keeps the catalog value. */
export type UnitStatOverride = Partial<Record<EditableUnitStat, number>>;

/** Every unit's overrides, by hero id. */
export type UnitStatOverrides = Readonly<Record<string, UnitStatOverride>>;

// --- RULES ---
/** Label and allowed range of each editable stat. */
export const EDITABLE_UNIT_STATS: Readonly<
  Record<EditableUnitStat, { label: string; min: number; max: number }>
> = {
  maxHp: { label: 'HP', min: 1, max: 9999 },
  speed: { label: 'Speed', min: 0, max: 999 },
  armor: { label: 'Armor', min: 0, max: 999 },
};

/** The editable stats, in the order the editor lists them. */
export const EDITABLE_UNIT_STAT_IDS: readonly EditableUnitStat[] = ['maxHp', 'speed', 'armor'];

// --- VALIDATION ---
/** True when a value is a whole number inside the stat's range. */
const isStatValue = (stat: EditableUnitStat, value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= EDITABLE_UNIT_STATS[stat].min &&
  value <= EDITABLE_UNIT_STATS[stat].max;

/** True when every key is an editable stat with a value in range. */
export const isUnitStatOverride = (data: unknown): data is UnitStatOverride =>
  typeof data === 'object' &&
  data !== null &&
  !Array.isArray(data) &&
  Object.entries(data).every(([key, value]) =>
    EDITABLE_UNIT_STAT_IDS.some((stat) => stat === key && isStatValue(stat, value))
  );

/** True when the data is a hero id -> override map. */
export const isUnitStatOverrides = (data: unknown): data is UnitStatOverrides =>
  typeof data === 'object' &&
  data !== null &&
  !Array.isArray(data) &&
  Object.values(data).every(isUnitStatOverride);

// --- PURE TRANSFORMS ---
/** A hero definition with an override's stats laid over it. */
export const applyUnitOverride = (
  hero: HeroDef,
  override: UnitStatOverride | undefined
): HeroDef => (override ? { ...hero, ...override } : hero);

/** The overrides with one unit's entry replaced, or removed when null. */
export const withUnitOverride = (
  overrides: UnitStatOverrides,
  heroId: string,
  override: UnitStatOverride | null
): UnitStatOverrides => {
  const { [heroId]: _removed, ...rest } = overrides;
  const isEmpty = !override || Object.keys(override).length === 0;
  return isEmpty ? rest : { ...rest, [heroId]: override };
};

// --- ACTIVE OVERRIDES ---
// One live set per process: the client sets it once from /api/init (and
// after an admin save), the server sets it from Redis before each request.
let activeOverrides: UnitStatOverrides = {};

/** Replaces the active overrides that getHero applies. */
export const setUnitOverrides = (overrides: UnitStatOverrides): void => {
  activeOverrides = overrides;
};

/** The active overrides (for the admin editor). */
export const getUnitOverrides = (): UnitStatOverrides => activeOverrides;
