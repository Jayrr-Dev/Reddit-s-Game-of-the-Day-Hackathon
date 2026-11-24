// ===================================================================
// SLICE
// One blade cut: a thin red wound that tapers to a point at both ends,
// with a dark core inside it. Shared by the Melee hit marks
// (ImpactOverlay) and Melee target picks (PickMark).
// PERFORMANCE: two static paths, no filters.
// ===================================================================

// --- CONSTANTS ---
const EDGE_FILL = 'var(--color-hp)';
const CORE_FILL = '#1a0306';
/** The core starts and ends this far in (viewBox units of 100). */
const CORE_INSET = 14;
/** The core's thickness as a share of the red edge's. */
const CORE_SHARE = 0.45;

// --- HELPERS ---
/**
 * A lens from x `from` to `to` on the centre line (y 6), `half` units
 * thick on each side: two curves meeting in a point at each end.
 */
const lens = (from: number, to: number, half: number): string => {
  const mid = (from + to) / 2;
  return `M${from} 6Q${mid} ${6 - half * 2} ${to} 6Q${mid} ${6 + half * 2} ${from} 6Z`;
};

// --- COMPONENT ---
/**
 * Renders the cut across its box's width. `halfThickness` (viewBox
 * units, the box is 100 x 12) sets how fat the middle is.
 */
export const Slice = ({
  halfThickness = 2.2,
  className = '',
}: {
  halfThickness?: number;
  className?: string;
}) => (
  <svg
    viewBox="0 0 100 12"
    className={`block w-full overflow-visible ${className}`}
    aria-hidden="true"
  >
    {/* RED EDGE, THEN THE DARK CORE INSIDE IT */}
    <path d={lens(0, 100, halfThickness)} fill={EDGE_FILL} />
    <path
      d={lens(CORE_INSET, 100 - CORE_INSET, halfThickness * CORE_SHARE)}
      fill={CORE_FILL}
    />
  </svg>
);
