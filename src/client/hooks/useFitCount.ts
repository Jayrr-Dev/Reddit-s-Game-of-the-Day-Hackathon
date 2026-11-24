// ===================================================================
// USE FIT COUNT
// How many items of a row fit in the space it has (over `rows` lines,
// see shared/utils/fitRows), measured live. The
// row renders every item once, invisibly and zero-height (the measure
// row), so their real widths can be read; the visible row then shows
// only as many as fit, keeping room for an overflow chip when some
// must fold away. Re-measures whenever the space resizes or the items
// change (their numbers change their widths).
// ===================================================================

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { fitCountOf } from '../../shared/utils/fitRows';

// --- HOOK ---
/**
 * Refs for the space, the measure row (one child per item) and a
 * measuring overflow chip, plus how many items fit right now.
 */
export const useFitCount = (itemCount: number, rows = 1) => {
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
    setFitCount(
      fitCountOf(space.clientWidth, widths, overflowWidth, gap, rows)
    );
  }, [rows]);

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
