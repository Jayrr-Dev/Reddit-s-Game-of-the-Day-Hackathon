// ===================================================================
// SLICE
// One blade cut: a semi-thin black line that tapers to a point at both
// ends, with a faint light edge so it reads on dark armour. Shared by
// the Melee hit marks (ImpactOverlay) and Melee target picks (PickMark).
// ===================================================================

// --- CONSTANTS ---
const SLICE_FILL = '#0b0507';

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
}) => {
  // A lens: two curves meeting in a point at each end.
  const lens = `M0 6Q50 ${6 - halfThickness * 2} 100 6Q50 ${6 + halfThickness * 2} 0 6Z`;
  return (
    <svg
      viewBox="0 0 100 12"
      className={`block w-full drop-shadow-[0_0_1.5px_rgb(255_255_255/0.45)] ${className}`}
      aria-hidden="true"
    >
      <path d={lens} fill={SLICE_FILL} />
    </svg>
  );
};
