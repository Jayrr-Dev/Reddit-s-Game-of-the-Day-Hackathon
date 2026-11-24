// ===================================================================
// POP TONE
// The colours a damage number takes over its card type's own: a Shock
// burst's lightning yellow, or a ticking status's colour (Burn orange,
// Poison green, Bleed red, Hex purple).
// ===================================================================

import type { PlayerHitPop, TickKind } from '../hooks/useHitPops';

// --- CONSTANTS ---
/** A Shock burst's number: lightning yellow. */
const SHOCK_TONE = 'var(--color-shock)';
/** A Venom bite's number: serpent teal. */
const VENOM_TONE = 'var(--color-venom)';
/** Each ticking status's damage pops in that status's own colour. */
const TICK_TONES: Record<TickKind, string> = {
  burn: 'var(--color-burn)',
  poison: 'var(--color-poison)',
  bleed: 'var(--color-bleed)',
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
    : hit.kind === 'venomBite'
      ? VENOM_TONE
      : hit.tick
        ? TICK_TONES[hit.tick]
        : undefined;
