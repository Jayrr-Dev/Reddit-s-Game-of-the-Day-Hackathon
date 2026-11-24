// ===================================================================
// SHOCK STAGE
// How charged Shock's bolt is drawn (see ShockCharge): it fills as the hits
// in a row add up toward the burst (SHOCK_HITS, 3).
// ===================================================================

// --- TYPES ---
export type ShockStage = 'empty' | 'half' | 'full' | 'splash';

// --- HELPERS ---
/** The bolt's stage for a number of hits in a row (0, 1, 2 or more). */
export const shockStageOf = (hits: number): ShockStage => {
  if (hits <= 0) return 'empty';
  return hits === 1 ? 'half' : 'full';
};
