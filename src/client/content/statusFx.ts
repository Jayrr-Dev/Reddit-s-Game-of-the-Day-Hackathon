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
  | 'eye'
  /** The status's own icon (its POP_LOOK glyph: fist, sword, bow ...). */
  | 'icon'
  | 'arrow'
  | 'spark'
  | 'streak'
  /** A whipped arc of liquid, thin at both ends, shedding drips. */
  | 'lash'
  /** A blood splat: a blob with drops flung round it. */
  | 'splat'
  /** A lightning bolt striking down from the sky (Shock bursting). */
  | 'bolt';

/**
 * How a particle moves (index.css "STATUS FX"): rise floats up, fall
 * drips down, burst flies out from the middle, spin turns in place,
 * flash swells and fades in place, slam drops in big and hits down,
 * swing chops down from raised, dash shoots in from the left, whip
 * lashes across fast like flung water, splat lands a beat later and
 * lingers before it fades.
 */
export type FxMotion =
  | 'rise'
  | 'fall'
  | 'burst'
  | 'spin'
  | 'flash'
  | 'slam'
  | 'swing'
  | 'dash'
  | 'whip'
  | 'splat'
  | 'smite';

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

// --- TABLE ---
export const STATUS_FX: Record<FxKind, FxSpec> = {
  /** A miss (Out of Range): nothing lands, so nothing is drawn. */
  miss: { layers: [], hasGlow: false },
  dodge: { layers: [], hasGlow: false },
  heal: {
    layers: [{ shape: 'plus', motion: 'rise', count: 4, size: 16 }],
    hasGlow: true,
  },
  guard: {
    layers: [
      { shape: 'shield', motion: 'flash', count: 1, size: 56 },
      { shape: 'ring', motion: 'flash', count: 1, size: 84 },
    ],
    hasGlow: false,
  },
  // BUFFS: each built around its own icon, in Buff orange.
  /** Wrath (+damage to every hit): a fist slams down, a shockwave rings out. */
  wrath: {
    layers: [
      { shape: 'icon', motion: 'slam', count: 1, size: 46 },
      { shape: 'ring', motion: 'flash', count: 1, size: 92 },
      { shape: 'spark', motion: 'burst', count: 6, size: 10 },
    ],
    hasGlow: true,
  },
  /** Might (+Melee): a sword chops down, striking sparks. */
  might: {
    layers: [
      { shape: 'icon', motion: 'swing', count: 1, size: 54 },
      { shape: 'spark', motion: 'burst', count: 4, size: 9 },
    ],
    hasGlow: true,
  },
  /** Surge (+Magic): the swirl spins up, throwing off sparks. */
  surge: {
    layers: [
      { shape: 'icon', motion: 'spin', count: 1, size: 50 },
      { shape: 'spark', motion: 'burst', count: 8, size: 8 },
    ],
    hasGlow: true,
  },
  /** Hone (+Range): the bow flashes and arrows loose upward. */
  hone: {
    layers: [
      { shape: 'icon', motion: 'flash', count: 1, size: 42 },
      { shape: 'arrow', motion: 'rise', count: 3, size: 16 },
    ],
    hasGlow: true,
  },
  /** Sharpshooter: the crosshair flashes and arrows loose upward. */
  sharpshooter: {
    layers: [
      { shape: 'icon', motion: 'flash', count: 1, size: 42 },
      { shape: 'arrow', motion: 'rise', count: 3, size: 16 },
    ],
    hasGlow: true,
  },
  /** Berserker: the axe flashes and blades rise. */
  berserker: {
    layers: [
      { shape: 'icon', motion: 'flash', count: 1, size: 42 },
      { shape: 'arrow', motion: 'rise', count: 3, size: 16 },
    ],
    hasGlow: true,
  },
  /** Armor: the breastplate flashes and settles. */
  armor: {
    layers: [{ shape: 'icon', motion: 'flash', count: 1, size: 42 }],
    hasGlow: true,
  },
  /** Instinct (dodge): the dodging figure flashes, chevrons rise. */
  instinct: {
    layers: [
      { shape: 'icon', motion: 'flash', count: 1, size: 44 },
      { shape: 'chevron', motion: 'rise', count: 2, size: 16 },
    ],
    hasGlow: true,
  },
  reflex: { layers: [{ shape: 'chevron', motion: 'rise', count: 2, size: 14 }], hasGlow: false },
  /** Bane (stronger afflictions): the flask flashes and bubbles rise. */
  bane: {
    layers: [
      { shape: 'icon', motion: 'flash', count: 1, size: 42 },
      { shape: 'bubble', motion: 'rise', count: 5, size: 12 },
    ],
    hasGlow: true,
  },
  /** Reinforce (+Guard from cards): the shield flashes, boosted up. */
  reinforce: {
    layers: [
      { shape: 'icon', motion: 'flash', count: 1, size: 48 },
      { shape: 'chevron', motion: 'rise', count: 2, size: 16 },
    ],
    hasGlow: true,
  },
  /** Brace (Guard holds): the anchor drops and digs in behind a shield. */
  brace: {
    layers: [
      { shape: 'shield', motion: 'flash', count: 1, size: 60 },
      { shape: 'icon', motion: 'slam', count: 1, size: 42 },
    ],
    hasGlow: true,
  },
  /**
   * Protection (cuts each hit by tier): the aegis flashes up behind a
   * spreading ward of rings.
   */
  protection: {
    layers: [
      { shape: 'ring', motion: 'flash', count: 2, size: 96 },
      { shape: 'icon', motion: 'flash', count: 1, size: 52 },
    ],
    hasGlow: true,
  },
  /** Momentum (Charge: next Melee +50%): a bolt dashes in on speed lines. */
  momentum: {
    layers: [
      { shape: 'streak', motion: 'dash', count: 3, size: 34 },
      { shape: 'icon', motion: 'dash', count: 1, size: 40 },
    ],
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
  shock: {
    layers: [{ shape: 'spark', motion: 'burst', count: 5, size: 9 }],
    hasGlow: false,
  },
  /** Bleed biting (once per attack): drawn by its own BleedBurst sequence. */
  bleedBite: { layers: [], hasGlow: false },
  /** Bleed laid on: heavier drops run down. */
  bleed: {
    layers: [{ shape: 'drop', motion: 'fall', count: 6, size: 12 }],
    hasGlow: true,
  },
  /**
   * Shock discharging (its SHOCK_HITS-th hit): the bolt flashes, lightning lashes
   * across the body and sparks fly off.
   */
  shockBurst: {
    layers: [
      { shape: 'bolt', motion: 'smite', count: 1, size: 60 },
      { shape: 'icon', motion: 'flash', count: 1, size: 48 },
      { shape: 'spark', motion: 'burst', count: 16, size: 13 },
    ],
    hasGlow: true,
  },
  /** Enfeeble (cuts damage dealt): a blade shatters and drops, shards fall. */
  enfeeble: {
    layers: [
      { shape: 'icon', motion: 'slam', count: 1, size: 46 },
      { shape: 'shard', motion: 'fall', count: 5, size: 12 },
    ],
    hasGlow: true,
  },
  /** Vex (afflictions hit harder): the shield cracks, shards fall. */
  vex: {
    layers: [
      { shape: 'icon', motion: 'slam', count: 1, size: 44 },
      { shape: 'shard', motion: 'fall', count: 4, size: 10 },
    ],
    hasGlow: true,
  },
  weaken: {
    layers: [
      { shape: 'eye', motion: 'flash', count: 1, size: 46 },
      { shape: 'ring', motion: 'flash', count: 1, size: 90 },
    ],
    hasGlow: true,
  },
};
