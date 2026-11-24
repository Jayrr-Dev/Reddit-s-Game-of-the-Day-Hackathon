// ===================================================================
// SMITE STAGE
// How full Smite's drop is drawn (see SmiteDrop): it fills as the hits
// in a row add up toward the burst (SMITE_HITS, 3).
// ===================================================================

// --- TYPES ---
export type SmiteStage = 'empty' | 'half' | 'full' | 'splash';

// --- HELPERS ---
/** The drop's stage for a number of hits in a row (0, 1, 2 or more). */
export const smiteStageOf = (hits: number): SmiteStage => {
  if (hits <= 0) return 'empty';
  return hits === 1 ? 'half' : 'full';
};
