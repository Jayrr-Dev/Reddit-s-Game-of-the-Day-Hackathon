// ===================================================================
// USE SHOCK SPLASH
// Shock's chip disappears the moment it bursts (the 3rd hit clears it),
// so its bolt could never be seen splashing. This keeps a note of the
// burst for SPLASH_MS: the value that went off, so the status row can
// show the bolt discharging in step with the damage landing.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import { SHOCK_HITS } from '../../shared/game/rules';
import type { Combatant } from '../../shared/game/types';

// --- CONSTANTS ---
/** How long the splash shows (matches .shock-charge splash in index.css). */
const SPLASH_MS = 600;

// --- HELPERS ---
/**
 * True when Shock just burst between two looks: it was primed, now it
 * is gone, and the unit lost HP (a Cleanse clears it without a splash).
 */
const didBurst = (before: Combatant, after: Combatant): boolean =>
  before.statuses.shock > 0 &&
  (before.shockHits ?? 0) >= SHOCK_HITS - 1 &&
  after.statuses.shock === 0 &&
  after.hp < before.hp;

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
