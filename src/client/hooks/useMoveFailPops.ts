// ===================================================================
// USE MOVE FAIL POPS
// The cancel signs on screen, and `show(uid)` to pop one over a hero
// whose pull or push failed. Each sign removes itself once its
// animation ends.
// ===================================================================

import { useCallback, useRef, useState } from 'react';
import type { Point } from './useCardDrag';
import { bodyPointOf } from './useHitPops';

// --- TYPES ---
export type FailPop = { id: number; point: Point };

// --- CONSTANTS ---
/** How long a sign stays (matches --animate-fail-pop). */
const FAIL_POP_MS = 900;

// --- HOOK ---
/** The signs on screen, and `show(uid)` to pop one over a hero. */
export const useMoveFailPops = () => {
  const [pops, setPops] = useState<FailPop[]>([]);
  const nextIdRef = useRef(0);

  /** Pops a sign over the hero's body; it removes itself. */
  const show = useCallback((uid: number) => {
    const point = bodyPointOf(uid);
    if (!point) return;
    const id = nextIdRef.current++;
    setPops((current) => [...current, { id, point }]);
    window.setTimeout(
      () => setPops((current) => current.filter((pop) => pop.id !== id)),
      FAIL_POP_MS
    );
  }, []);

  return { pops, show } as const;
};
