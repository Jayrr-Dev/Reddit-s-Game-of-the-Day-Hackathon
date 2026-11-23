// ===================================================================
// POP SIZE
// How big a floating number (damage, blocked, Shroud gained) is drawn.
// Size grows with the log of the amount, so every doubling adds the
// same few pixels: a 2 and a 4 look clearly different, but a 60 is not
// ten times a 6 and still fits the 512 px post.
// ===================================================================

// --- CONSTANTS ---
/** Where the log curve starts (px, for an amount of 0). */
const BASE_FONT_PX = 16;
/** Smallest font size (px), so tiny hits stay readable. */
const MIN_FONT_PX = 22;
/** Pixels added each time the amount doubles. */
const PX_PER_DOUBLING = 8;
/** Largest font size (px), so huge hits still fit the post. */
const MAX_FONT_PX = 72;

// --- HELPERS ---
/**
 * Font size (px) for a number, times `scale` for smaller kinds of pop:
 * 1 -> 24, 3 -> 32, 7 -> 40, 15 -> 48, 31 -> 56 ..., kept between 22
 * and 72 before scaling.
 */
export const popFontPx = (amount: number, scale = 1): number => {
  const onCurve =
    BASE_FONT_PX + PX_PER_DOUBLING * Math.log2(1 + Math.max(0, amount));
  const clamped = Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, onCurve));
  return Math.round(clamped * scale);
};
