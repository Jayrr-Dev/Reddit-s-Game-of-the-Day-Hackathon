// ===================================================================
// USE GAIN POPS
// Watches one number (e.g. your Shroud) and, whenever it goes up, adds
// a "+N" pop that floats for a moment. Drops are ignored (Shroud
// clearing at a new turn or soaking a hit is not a gain).
// Pops clear themselves after GAIN_POP_MS.
// ===================================================================

import { useEffect, useRef, useState } from 'react';

// --- TYPES ---
export type GainPop = { id: number; amount: number };

// --- CONSTANTS ---
/** How long a gain stays on screen (matches --animate-gain-float). */
const GAIN_POP_MS = 1100;

// --- HOOK ---
/** Returns the "+N" pops to show right now for `value`. */
export const useGainPops = (value: number): GainPop[] => {
  const [pops, setPops] = useState<GainPop[]>([]);
  const lastValueRef = useRef(value);
  const nextIdRef = useRef(0);

  // VALUE ROSE -> NEW POP (side effect: a timer that removes it)
  useEffect(() => {
    const gained = value - lastValueRef.current;
    lastValueRef.current = value;
    if (gained <= 0) return;
    const pop = { id: nextIdRef.current++, amount: gained };
    setPops((current) => [...current, pop]);
    // No cleanup on purpose: a newer gain must not cancel this removal.
    window.setTimeout(
      () => setPops((current) => current.filter((p) => p.id !== pop.id)),
      GAIN_POP_MS
    );
  }, [value]);

  return pops;
};
