// ===================================================================
// SHOCK STAGE
// How charged Shock's bolt is drawn (see ShockCharge): it fills as the hits
// in a row add up toward the burst (SHOCK_HITS), full one hit before it.
// ===================================================================

import { SHOCK_HITS } from '../../shared/game/rules';

// --- TYPES ---
export type ShockStage = 'empty' | 'charging' | 'full' | 'splash';

/** The bolt's look: its stage and how full it is (0..1). */
export type ShockCharge = { stage: ShockStage; fill: number };

// --- HELPERS ---
/**
 * The bolt for a number of hits in a row: empty at 0, filling a step
 * per hit, full (primed) at SHOCK_HITS - 1, the hit before the burst.
 */
export const shockChargeOf = (hits: number): ShockCharge =>
  chargeOf(hits, SHOCK_HITS);

/**
 * A charge toward a burst that the `needed`-th count sets off (Shock's
 * hits, Bleed's attacks): full (primed) one count before it.
 */
export const chargeOf = (count: number, needed: number): ShockCharge => {
  const fill = Math.min(1, Math.max(0, count) / (needed - 1));
  if (fill === 0) return { stage: 'empty', fill };
  return { stage: fill < 1 ? 'charging' : 'full', fill };
};

/** The bolt as a Shock bursts: full, splashing. */
export const SHOCK_SPLASH: ShockCharge = { stage: 'splash', fill: 1 };
