// ===================================================================
// SHOCK STAGE
// Shock's bolt is fully charged as soon as it is applied.
// ===================================================================

// --- TYPES ---
export type ShockStage = 'full' | 'splash';

/** The bolt's look before and during the burst. */
export type ShockCharge = { stage: ShockStage };

// --- HELPERS ---
/** Any active Shock is ready for the next attack. */
export const SHOCK_PRIMED: ShockCharge = { stage: 'full' };

/** The bolt as a Shock bursts: full, splashing. */
export const SHOCK_SPLASH: ShockCharge = { stage: 'splash' };
