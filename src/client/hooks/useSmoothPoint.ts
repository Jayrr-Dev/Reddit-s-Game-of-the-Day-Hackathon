// ===================================================================
// USE SMOOTH POINT
// Eases a point toward a moving target, one animation frame at a time,
// so the aim arrow glides onto a newly snapped hero instead of jumping.
// Respects "reduce motion": the point then follows the target at once.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import type { Point } from './useCardDrag';
import { prefersReducedMotion } from '../lib/motion';

// --- CONSTANTS ---
/** Share of the remaining distance covered each frame (0..1). */
const EASE_PER_FRAME = 0.3;
/** Close enough (px) to stop animating. */
const SETTLE_PX = 0.5;

// --- HELPERS ---

// --- HOOK ---
/**
 * Returns `target` eased over a few frames; null while there is none.
 * When a target appears, the point flies out from `origin` (if given),
 * so the arrow grows from the card instead of popping in; when it goes,
 * the point pulls back into `origin`. A null origin hides it at once.
 */
export const useSmoothPoint = (
  target: Point | null,
  origin: Point | null = null
): Point | null => {
  const [shown, setShown] = useState<Point | null>(null);
  const shownRef = useRef<Point | null>(null);
  const originRef = useRef(origin);
  useEffect(() => {
    originRef.current = origin;
  });

  // ANIMATION LOOP: imperative on purpose (timing is the whole point).
  // With a target the point glides onto it; when the target goes away
  // the point pulls back into the origin (the card), then disappears.
  useEffect(() => {
    const goal = target ?? originRef.current;
    const isRetracting = !target;
    if (
      !goal ||
      prefersReducedMotion() ||
      (isRetracting && !shownRef.current)
    ) {
      shownRef.current = null;
      const frame = requestAnimationFrame(() => setShown(null));
      return () => cancelAnimationFrame(frame);
    }
    // A new target with nothing shown yet starts from the origin.
    shownRef.current ??= originRef.current;
    let frame = 0;
    /** Moves one step toward the goal, then schedules the next. */
    const step = () => {
      const from = shownRef.current ?? goal;
      const next = {
        x: from.x + (goal.x - from.x) * EASE_PER_FRAME,
        y: from.y + (goal.y - from.y) * EASE_PER_FRAME,
      };
      const isSettled =
        Math.hypot(goal.x - next.x, goal.y - next.y) < SETTLE_PX;
      // Fully pulled back: hide it, so the next aim flies out fresh.
      shownRef.current = isSettled ? (isRetracting ? null : goal) : next;
      setShown(shownRef.current);
      if (!isSettled) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target?.x, target?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gone once the drag ends; instant with reduced motion; else eased
  // (including the pull-back while the target is gone).
  if (!origin) return null;
  if (target && prefersReducedMotion()) return target;
  return shown;
};
