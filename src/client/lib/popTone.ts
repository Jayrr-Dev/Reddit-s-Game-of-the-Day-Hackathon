// ===================================================================
// POP TONE
// The colours a damage number takes over its card type's own: a Shock
// burst's lightning yellow, or a ticking status's colour (Burn orange,
// Poison green, Hex purple) or Bleed's red bite.
// ===================================================================

import type { PlayerHitPop, TickKind } from '../hooks/useHitPops';

// --- CONSTANTS ---
/** A Shock burst's number: lightning yellow. */
const SHOCK_TONE = 'var(--color-shock)';
/** A Bleed bite's number: blood red. */
const BLEED_TONE = 'var(--color-bleed)';
/** Each ticking status's damage pops in that status's own colour. */
const TICK_TONES: Record<TickKind, string> = {
  burn: 'var(--color-burn)',
  poison: 'var(--color-poison)',
  hex: 'var(--color-hex)',
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
    : hit.kind === 'bleedBite' || hit.kind === 'bleedBurst'
      ? BLEED_TONE
      : hit.tick
        ? TICK_TONES[hit.tick]
        : undefined;
