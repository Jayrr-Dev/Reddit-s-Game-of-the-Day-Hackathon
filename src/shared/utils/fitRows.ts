// ===================================================================
// FIT ROWS
// How many leading items of a wrapping row fit in `rows` lines of a
// given width. Items wrap line by line; only when the last line is
// full do the rest fold into an overflow chip, which then needs room
// on that last line. Pure, so it is easy to test (see useFitCount).
// ===================================================================

// --- HELPERS ---
/** Width of these items laid out on one line with gaps between them. */
const lineWidth = (widths: readonly number[], gap: number): number =>
  widths.reduce((total, width) => total + width, 0) +
  Math.max(0, widths.length - 1) * gap;

/**
 * How many leading items fill one line of `space` px, greedily (always
 * at least one, so an item wider than the line still takes a line).
 */
const lineCount = (
  space: number,
  widths: readonly number[],
  gap: number
): number => {
  let count = 1;
  while (
    count < widths.length &&
    lineWidth(widths.slice(0, count + 1), gap) <= space
  )
    count += 1;
  return Math.min(count, widths.length);
};

/**
 * How many leading items fit on a single line beside an overflow chip
 * `overflowWidth` wide (all of them when they fit without it).
 */
const lastLineCount = (
  space: number,
  widths: readonly number[],
  overflowWidth: number,
  gap: number
): number => {
  if (lineWidth(widths, gap) <= space) return widths.length;
  let count = widths.length - 1;
  while (
    count > 0 &&
    lineWidth(widths.slice(0, count), gap) + gap + overflowWidth > space
  )
    count -= 1;
  return count;
};

/**
 * How many leading items fit in `rows` lines of `space` px. The lines
 * before the last fill greedily; the last keeps room for the overflow
 * chip when items are left over.
 */
export const fitCountOf = (
  space: number,
  widths: readonly number[],
  overflowWidth: number,
  gap: number,
  rows = 1
): number => {
  // Imperative on purpose: each line starts where the last one ended.
  let placed = 0;
  for (let line = 1; line < rows && placed < widths.length; line++)
    placed += lineCount(space, widths.slice(placed), gap);
  const rest = widths.slice(placed);
  return placed + lastLineCount(space, rest, overflowWidth, gap);
};
