// ===================================================================
// POP SIZE
// How big a floating number (damage, blocked, Guard gained) is drawn.
// Sizes are relative to a "typical hit": the median of the last few
// hits in this fight. A typical hit is drawn at NORMAL_FONT_PX; every
// doubling above it adds PX_PER_DOUBLING, every halving below takes it
// away (a log scale, so a 60 is not ten times a 6), between MIN and MAX.
// So a big hit always looks big next to what you've been dealing, from
// the first wave (hits around 6) to deep runs (hits around 30).
// ===================================================================

// --- CONSTANTS ---
/** Font size (px) of a hit exactly as big as the typical hit. */
const NORMAL_FONT_PX = 32;
/** Pixels added each time the amount doubles relative to typical. */
const PX_PER_DOUBLING = 10;
/** Smallest font size (px), so tiny hits stay readable. */
const MIN_FONT_PX = 20;
/** Largest font size (px), so huge hits still fit the post. */
const MAX_FONT_PX = 72;
/** The typical hit before any hits have landed (a starter Backhand). */
export const DEFAULT_TYPICAL_HIT = 6;
/** How many recent hits the median looks at. */
const HISTORY_SIZE = 15;

// --- HELPERS ---
/**
 * Font size (px) for a number, relative to `typical`, times `scale` for
 * smaller kinds of pop. With typical 6: 6 -> 32, 13 -> 42, 3 -> 23,
 * 27 -> 52 (the +1 keeps 0 and 1 sensible on the log curve).
 */
export const popFontPx = (
  amount: number,
  typical: number = DEFAULT_TYPICAL_HIT,
  scale = 1
): number => {
  const ratio = (1 + Math.max(0, amount)) / (1 + Math.max(0, typical));
  const onCurve = NORMAL_FONT_PX + PX_PER_DOUBLING * Math.log2(ratio);
  const clamped = Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, onCurve));
  return Math.round(clamped * scale);
};

/**
 * How big a hit is next to the typical hit, on the same curve as the
 * numbers: 1 for a typical hit, from about 0.6 (tiny) to 2.25 (huge).
 * Effects use it so a big hit's mark is big too (e.g. slash length).
 */
export const popScale = (
  amount: number,
  typical: number = DEFAULT_TYPICAL_HIT
): number => popFontPx(amount, typical) / NORMAL_FONT_PX;

/** The middle value of a non-empty list. */
const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

// --- HIT HISTORY ---
/**
 * Remembers the last HISTORY_SIZE hits (dealt and taken) and answers
 * what a typical hit is right now. One per fight view; each pop reads
 * typical() when it appears, so its size never changes mid-float.
 */
export class HitHistory {
  private amounts: number[] = [];

  /** Adds hits that just landed (zero-damage ones don't count). */
  record(amounts: readonly number[]): void {
    const landed = amounts.filter((amount) => amount > 0);
    this.amounts = [...this.amounts, ...landed].slice(-HISTORY_SIZE);
  }

  /** The median recent hit, or DEFAULT_TYPICAL_HIT before any land. */
  typical(): number {
    return this.amounts.length > 0 ? median(this.amounts) : DEFAULT_TYPICAL_HIT;
  }
}
