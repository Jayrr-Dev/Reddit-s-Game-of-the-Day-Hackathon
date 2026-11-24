// ===================================================================
// BLEED STAGE
// How full Bleed's drop is drawn (see BleedDrop): it fills as the hits
// in a row add up toward the burst (BLEED_HITS, 3).
// ===================================================================

// --- TYPES ---
export type BleedStage = 'empty' | 'half' | 'full' | 'splash';

// --- HELPERS ---
/** The drop's stage for a number of hits in a row (0, 1, 2 or more). */
export const bleedStageOf = (hits: number): BleedStage => {
  if (hits <= 0) return 'empty';
  return hits === 1 ? 'half' : 'full';
};
