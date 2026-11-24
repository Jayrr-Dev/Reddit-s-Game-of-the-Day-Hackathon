// ===================================================================
// MELEE SWEEPS (DATA)
// The silver blur a Melee swing draws over its targets comes in a few
// cuts, so swings don't all look alike. Each cut is one or more strokes
// (a crescent, or a narrow thrust), turned and flipped. Some cards
// always open with their own cut; every other swing, and every later
// hit of a multi-hit card, takes a random cut that never repeats the
// one just before it.
// Drawn by MeleeSweep (components/game/combat/MeleeSweep.tsx).
// ===================================================================

import type { CardId } from '../../shared/game/cards';

// --- TYPES ---
export type SweepStyleId =
  'sweep' | 'backhand' | 'downSlash' | 'upSlash' | 'cross' | 'thrust';

/** One stroke of a cut: its turn, whether it runs right to left, its delay. */
export type SweepStroke = {
  rotateDeg: number;
  isFlipped: boolean;
  delayMs: number;
};

/** A cut: a wide crescent or a narrow thrust, drawn as these strokes. */
export type SweepStyle = {
  shape: 'crescent' | 'thrust';
  strokes: readonly SweepStroke[];
};

// --- TABLE ---
const stroke = (rotateDeg: number, isFlipped = false, delayMs = 0) => ({
  rotateDeg,
  isFlipped,
  delayMs,
});

export const SWEEP_STYLES: Record<SweepStyleId, SweepStyle> = {
  /** Flat, left to right. */
  sweep: { shape: 'crescent', strokes: [stroke(0)] },
  /** Flat, right to left. */
  backhand: { shape: 'crescent', strokes: [stroke(0, true)] },
  /** Down and to the right. */
  downSlash: { shape: 'crescent', strokes: [stroke(30)] },
  /** Up and to the right. */
  upSlash: { shape: 'crescent', strokes: [stroke(-30)] },
  /** Two cuts crossing in an X, the second a beat later. */
  cross: { shape: 'crescent', strokes: [stroke(32), stroke(-32, true, 90)] },
  /** A straight stab, up at the target. */
  thrust: { shape: 'thrust', strokes: [stroke(-70)] },
};

export const SWEEP_STYLE_IDS = Object.keys(SWEEP_STYLES) as SweepStyleId[];

/** Cards whose swing always opens with their own cut. */
export const CARD_SWEEPS: Partial<Record<CardId, SweepStyleId>> = {
  backhand: 'backhand',
  cruelSlash: 'downSlash',
  twinDaggers: 'cross',
  quickJab: 'thrust',
  cleave: 'sweep',
  hurlAside: 'upSlash',
  spikedGuard: 'thrust',
  ruin: 'downSlash',
  undyingHatred: 'cross',
};

// --- HELPERS ---
/**
 * The cut for hit `hitIndex` of a card's swing. `roll` is a number in
 * [0, 1) that picks a random cut; `previous` is the cut just drawn, so
 * two in a row never match (unless a card's own cut asks for it).
 */
export const sweepStyleFor = (
  cardId: CardId,
  hitIndex: number,
  previous: SweepStyleId | null,
  roll: number
): SweepStyleId => {
  const own = CARD_SWEEPS[cardId];
  if (own && hitIndex === 0) return own;
  const pool = SWEEP_STYLE_IDS.filter((id) => id !== previous);
  return pool[Math.floor(roll * pool.length)] ?? 'sweep';
};
