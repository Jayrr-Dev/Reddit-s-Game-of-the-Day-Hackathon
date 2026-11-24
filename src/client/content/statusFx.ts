// ===================================================================
// STATUS FX (DATA)
// The one table of what each status looks like when it lands on a
// character (applied, gained) or goes off on them (a tick). Each entry
// is a few layers of particles: which shape, how it moves, how many,
// how big. The colour is never stored here: it is the status's own
// token (POP_LOOK -> toneVarOf), so the effect always matches its chip.
// Drawn by StatusFx (components/game/combat/StatusFx.tsx).
// ===================================================================

import type { PopKind } from '../hooks/useHitPops';

// --- TYPES ---
/** A particle's drawing (see SHAPE_PATHS in StatusFx). */
export type FxShape =
  | 'bubble'
  | 'flame'
  | 'shard'
  | 'sigil'
  | 'drop'
  | 'plus'
  | 'chevron'
  | 'shield'
  | 'ring'
  | 'eye';

/**
 * How a particle moves (index.css "STATUS FX"): rise floats up, fall
 * drips down, burst flies out from the middle, spin turns in place,
 * flash swells and fades in place.
 */
export type FxMotion = 'rise' | 'fall' | 'burst' | 'spin' | 'flash';

/** One layer of identical particles. */
export type FxLayer = {
  shape: FxShape;
  motion: FxMotion;
  count: number;
  /** Width of one particle, as a % of the character's box. */
  size: number;
};

/** A status's whole effect: its layers, and whether it washes in a glow. */
export type FxSpec = { layers: readonly FxLayer[]; hasGlow: boolean };

/** Every pop kind that has its own effect (a plain hit has marks instead). */
export type FxKind = Exclude<PopKind, 'hit'>;

// --- SHARED LAYERS ---
/** Every buff flares the same way, in its own (Buff orange) tone. */
const BUFF_FLARE: FxSpec = {
  layers: [
    { shape: 'ring', motion: 'flash', count: 1, size: 70 },
    { shape: 'chevron', motion: 'rise', count: 3, size: 20 },
  ],
  hasGlow: true,
};

// --- TABLE ---
export const STATUS_FX: Record<FxKind, FxSpec> = {
  heal: {
    layers: [{ shape: 'plus', motion: 'rise', count: 4, size: 16 }],
    hasGlow: true,
  },
  shroud: {
    layers: [
      { shape: 'shield', motion: 'flash', count: 1, size: 56 },
      { shape: 'ring', motion: 'flash', count: 1, size: 84 },
    ],
    hasGlow: false,
  },
  wrath: BUFF_FLARE,
  might: BUFF_FLARE,
  surge: BUFF_FLARE,
  piercing: BUFF_FLARE,
  protection: BUFF_FLARE,
  momentum: {
    layers: [{ shape: 'chevron', motion: 'rise', count: 4, size: 22 }],
    hasGlow: true,
  },
  hex: {
    layers: [
      { shape: 'sigil', motion: 'spin', count: 1, size: 62 },
      { shape: 'ring', motion: 'flash', count: 1, size: 80 },
    ],
    hasGlow: true,
  },
  poison: {
    layers: [{ shape: 'bubble', motion: 'rise', count: 6, size: 13 }],
    hasGlow: true,
  },
  burn: {
    layers: [{ shape: 'flame', motion: 'rise', count: 5, size: 18 }],
    hasGlow: true,
  },
  frost: {
    layers: [{ shape: 'shard', motion: 'burst', count: 7, size: 16 }],
    hasGlow: true,
  },
  bleed: {
    layers: [{ shape: 'drop', motion: 'fall', count: 4, size: 9 }],
    hasGlow: false,
  },
  bleedBurst: {
    layers: [{ shape: 'drop', motion: 'burst', count: 9, size: 9 }],
    hasGlow: true,
  },
  dread: {
    layers: [
      { shape: 'eye', motion: 'flash', count: 1, size: 46 },
      { shape: 'ring', motion: 'flash', count: 1, size: 90 },
    ],
    hasGlow: true,
  },
};
