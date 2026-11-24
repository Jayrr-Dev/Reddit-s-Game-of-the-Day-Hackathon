// ===================================================================
// USE FIT COUNT
// How many items of a row fit in the space it has, measured live. The
// row renders every item once, invisibly and zero-height (the measure
// row), so their real widths can be read; the visible row then shows
// only as many as fit, keeping room for an overflow chip when some
// must fold away. Re-measures whenever the space resizes or the items
// change (their numbers change their widths).
// ===================================================================

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// --- HELPERS ---
/**
 * How many leading items fit in `space` px: all of them if they do;
 * otherwise as many as fit beside an overflow chip `overflowWidth` wide.
 * Pure, so it is easy to test and reason about.
 */
export const fitCountOf = (
  space: number,
  widths: readonly number[],
  overflowWidth: number,
  gap: number
): number => {
  /** Width of the first `count` items laid out with gaps between them. */
  const rowWidth = (count: number): number =>
    widths.slice(0, count).reduce((total, width) => total + width, 0) +
    Math.max(0, count - 1) * gap;
  if (rowWidth(widths.length) <= space) return widths.length;
  // Folding: find the most items that still leave room for the overflow.
  let count = widths.length - 1;
  while (count > 0 && rowWidth(count) + gap + overflowWidth > space) count -= 1;
  return count;
};

// --- HOOK ---
/**
 * Refs for the space, the measure row (one child per item) and a
 * measuring overflow chip, plus how many items fit right now.
 */
export const useFitCount = (itemCount: number) => {
  const spaceRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLSpanElement>(null);
  const [fitCount, setFitCount] = useState(itemCount);

  /** Reads the widths and space, and stores how many fit. */
  const measure = useCallback(() => {
    const space = spaceRef.current;
    const row = measureRef.current;
    if (!space || !row) return;
    const widths = [...row.children].map(
      (child) => (child as HTMLElement).offsetWidth
    );
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const overflowWidth = overflowRef.current?.offsetWidth ?? 0;
    setFitCount(fitCountOf(space.clientWidth, widths, overflowWidth, gap));
  }, []);

  // EVERY RENDER: the items (and so their widths) may have changed.
  // setFitCount bails out when the count is unchanged, so this settles.
  useLayoutEffect(measure);

  // WHENEVER THE SPACE RESIZES
  useLayoutEffect(() => {
    const space = spaceRef.current;
    if (!space) return;
    const observer = new ResizeObserver(measure);
    observer.observe(space);
    return () => observer.disconnect();
  }, [measure]);

  return { spaceRef, measureRef, overflowRef, fitCount } as const;
};
