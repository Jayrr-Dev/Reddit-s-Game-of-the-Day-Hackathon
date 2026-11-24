// ===================================================================
// USE SHOCK SPLASH
// Shock's chip disappears the moment it bursts (the SHOCK_HITS-th hit clears it),
// so its bolt could never be seen splashing. This keeps a note of the
// burst for SPLASH_MS: the value that went off, so the status row can
// show the bolt discharging in step with the damage landing.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import type { Combatant } from '../../shared/game/types';

// --- CONSTANTS ---
/** How long the splash shows (matches .shock-charge splash in index.css). */
const SPLASH_MS = 600;

// --- HELPERS ---
/**
 * True when Shock just burst between two looks: the engine counted a
 * burst. Shock fading to 0 or a Cleanse clearing it is no burst.
 */
const didBurst = (before: Combatant, after: Combatant): boolean =>
  (after.shockBursts ?? 0) > (before.shockBursts ?? 0) &&
  before.statuses.shock > 0;

// --- HOOK ---
/** The Shock value that just burst, while its splash shows, else null. */
export const useShockSplash = (combatant: Combatant): number | null => {
  const [splashed, setSplashed] = useState<number | null>(null);
  const lastRef = useRef(combatant);
  // The splash's timer lives in a ref, not in the effect's cleanup: the
  // combatant changes again within the splash (the next hit, the next
  // beat), and a cleanup there would cancel the timer and leave the
  // splash chip stuck on screen for good.
  const timerRef = useRef<number | undefined>(undefined);

  // Event-like: compare with the last look, start a timed splash.
  useEffect(() => {
    const before = lastRef.current;
    lastRef.current = combatant;
    if (!didBurst(before, combatant)) return;
    setSplashed(before.statuses.shock);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setSplashed(null), SPLASH_MS);
  }, [combatant]);

  // UNMOUNT: never leave a pending timer behind.
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return splashed;
};
