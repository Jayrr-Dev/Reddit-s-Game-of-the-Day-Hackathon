// ===================================================================
// USE SMOOTH POINT
// Eases a point toward a moving target, one animation frame at a time,
// so the aim arrow glides onto a newly snapped hero instead of jumping.
// Respects "reduce motion": the point then follows the target at once.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import type { Point } from './useCardDrag';

// --- CONSTANTS ---
/** Share of the remaining distance covered each frame (0..1). */
const EASE_PER_FRAME = 0.3;
/** Close enough (px) to stop animating. */
const SETTLE_PX = 0.5;

// --- HELPERS ---
/** True when the player asked the system for less motion. */
const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- HOOK ---
/** Returns `target` eased over a few frames; null while there is none. */
export const useSmoothPoint = (target: Point | null): Point | null => {
  const [shown, setShown] = useState<Point | null>(target);
  const shownRef = useRef<Point | null>(target);

  // ANIMATION LOOP: imperative on purpose (timing is the whole point).
  useEffect(() => {
    if (!target || !shownRef.current || prefersReducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    let frame = 0;
    /** Moves one step toward the target, then schedules the next. */
    const step = () => {
      const from = shownRef.current ?? target;
      const next = {
        x: from.x + (target.x - from.x) * EASE_PER_FRAME,
        y: from.y + (target.y - from.y) * EASE_PER_FRAME,
      };
      const isSettled =
        Math.hypot(target.x - next.x, target.y - next.y) < SETTLE_PX;
      shownRef.current = isSettled ? target : next;
      setShown(shownRef.current);
      if (!isSettled) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target?.x, target?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  return shown;
};
