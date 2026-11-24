// ===================================================================
// SEEDED
// Stable pseudo-random numbers for display effects. The same id and
// salt always give the same number, so an effect keyed by a pop id
// looks random but never jumps when React re-renders it.
// ===================================================================

// --- HELPERS ---
/** A stable number in [0, 1) from an id and a salt (a tiny integer hash). */
export const seeded = (id: number, salt: number): number => {
  const mixed = Math.imul(id * 31 + salt * 17 + 7, 2654435761) >>> 0;
  return (mixed % 1000) / 1000;
};

/** A stable spread from -1 to 1 (for offsets and tilts). */
export const spread = (id: number, salt: number): number =>
  seeded(id, salt) * 2 - 1;
