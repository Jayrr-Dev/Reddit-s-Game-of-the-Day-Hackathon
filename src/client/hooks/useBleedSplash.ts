// ===================================================================
// USE BLEED SPLASH
// Bleed's chip disappears the moment it bursts (the 3rd hit clears it),
// so its drop could never be seen splashing. This keeps a note of the
// burst for SPLASH_MS: the value that went off, so the status row can
// show the drop splashing in step with the damage landing.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import { BLEED_HITS } from '../../shared/game/rules';
import type { Combatant } from '../../shared/game/types';

// --- CONSTANTS ---
/** How long the splash shows (matches .bleed-drop splash in index.css). */
const SPLASH_MS = 600;

// --- HELPERS ---
/**
 * True when Bleed just burst between two looks: it was primed, now it
 * is gone, and the unit lost HP (a Cleanse clears it without a splash).
 */
const didBurst = (before: Combatant, after: Combatant): boolean =>
  before.statuses.bleed > 0 &&
  (before.bleedHits ?? 0) >= BLEED_HITS - 1 &&
  after.statuses.bleed === 0 &&
  after.hp < before.hp;

// --- HOOK ---
/** The Bleed value that just burst, while its splash shows, else null. */
export const useBleedSplash = (combatant: Combatant): number | null => {
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
    setSplashed(before.statuses.bleed);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setSplashed(null), SPLASH_MS);
  }, [combatant]);

  // UNMOUNT: never leave a pending timer behind.
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return splashed;
};
