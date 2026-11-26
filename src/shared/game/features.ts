// ===================================================================
// FEATURE FLAGS
// Switches for whole features still being playtested. Flip one here
// and the engine, the UI and the server all follow (they share this
// file). Keep each flag's reach listed so turning it off is safe.
// Code reads a flag when it runs (never at import), so a test can turn
// one on for its own file.
// ===================================================================

export const FEATURES = {
  /**
   * THREE-ROW FIELD: Backline (the Horizon) behind the Frontline and Midline, with
   * Out of Range misses, Longrange (keyword, Eagle Eye, the Ballista's
   * passive), hordes marching in from Backline and Charge closing 1
   * line. Off: the field is 2 rows deep, as before (Out of Range never comes up, Longrange is not
   * printed or offered). On for the playtest (Sam, 2026-11-24).
   */
  threeRowField: true,
};

// --- WHAT EACH FLAG GATES ---
/** True while Longrange (keyword and passive) is in play. */
export const isLongRangeOn = (): boolean => FEATURES.threeRowField;
