// ===================================================================
// POP TONE
// The colours a damage number takes over its card type's own: a Shock
// burst's lightning yellow, or a ticking status's colour (Burn orange).
// ===================================================================

import type { PlayerHitPop, TickKind } from '../hooks/useHitPops';

// --- CONSTANTS ---
/** A Shock burst's number: lightning yellow. */
const SHOCK_TONE = 'var(--color-shock)';
/** Statuses whose tick damage pops in their own colour (Sam: Burn orange). */
const TICK_TONES: Partial<Record<TickKind, string>> = {
  burn: 'var(--color-burn)',
};

/**
 * The colour a pop's number takes over its card type's: a Shock burst's
 * yellow or a ticking status's own. Undefined keeps the usual tone.
 */
export const specialToneOf = (
  hit: Pick<PlayerHitPop, 'kind' | 'tick'>
): string | undefined =>
  hit.kind === 'shockBurst'
    ? SHOCK_TONE
    : hit.tick
      ? TICK_TONES[hit.tick]
      : undefined;
