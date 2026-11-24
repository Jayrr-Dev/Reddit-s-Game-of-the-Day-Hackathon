// ===================================================================
// PUNCTURE
// A Range hit: an arrow hole punched into the target. A ragged black
// rim around an open hole, thin cracks shooting out at uneven lengths,
// and sometimes a broken shock ring. Every part is drawn from the pop
// id, so each hole is different but never changes on re-render.
// PERFORMANCE: one static SVG per hit, no filters; the animation only
// touches transform and opacity (see impact-puncture in index.css).
// ===================================================================

import { seeded } from '../../../lib/seeded';

// --- CONSTANTS ---
/** The drawing is a 100 x 100 box centred on (50, 50). */
const CENTRE = 50;
const HOLE_RADIUS = 7;
const RIM_RADIUS = 14;
/** How far the rim's edge wobbles in or out (viewBox units). */
const RIM_JITTER = 2.6;
const RIM_POINTS = 16;
/** Cracks: 4 to 8 of them, 10 to 34 units past the rim. */
const MIN_CRACKS = 4;
const EXTRA_CRACKS = 5;
const MIN_CRACK_LENGTH = 10;
const EXTRA_CRACK_LENGTH = 24;
/** Half the angle (radians) a crack's base covers on the rim. */
const CRACK_BASE_HALF_ANGLE = 0.24;
/** Share of holes that also show a broken shock ring. */
const SHOCK_RING_CHANCE = 0.5;
const HOLE_FILL = '#0b0507';

// --- HELPERS ---
/** A point at `radius` from the centre, at `angle` radians. */
const polar = (radius: number, angle: number): string =>
  `${(CENTRE + radius * Math.cos(angle)).toFixed(1)} ${(CENTRE + radius * Math.sin(angle)).toFixed(1)}`;

/**
 * The rim as one path: a wobbly outer edge, then the round hole cut out
 * of it (drawn with evenodd fill, so the hole stays open).
 */
const rimPath = (id: number): string => {
  const outer = Array.from({ length: RIM_POINTS }, (_, i) => {
    const angle = (i / RIM_POINTS) * Math.PI * 2;
    const radius = RIM_RADIUS + (seeded(id, 20 + i) * 2 - 1) * RIM_JITTER;
    return `${i === 0 ? 'M' : 'L'}${polar(radius, angle)}`;
  }).join('');
  const hole = `M${CENTRE - HOLE_RADIUS} ${CENTRE}a${HOLE_RADIUS} ${HOLE_RADIUS} 0 1 0 ${HOLE_RADIUS * 2} 0a${HOLE_RADIUS} ${HOLE_RADIUS} 0 1 0 ${-HOLE_RADIUS * 2} 0Z`;
  return `${outer}Z${hole}`;
};

/**
 * The cracks: thin wedges spread round the rim with a little jitter, so
 * they never look evenly spaced, each its own length.
 */
const crackPaths = (id: number): string[] => {
  const count = MIN_CRACKS + Math.floor(seeded(id, 40) * EXTRA_CRACKS);
  const start = seeded(id, 41) * Math.PI * 2;
  return Array.from({ length: count }, (_, i) => {
    const jitter = (seeded(id, 50 + i) - 0.5) * (Math.PI / count);
    const angle = start + (i / count) * Math.PI * 2 + jitter;
    const length = MIN_CRACK_LENGTH + seeded(id, 60 + i) * EXTRA_CRACK_LENGTH;
    const baseRadius = RIM_RADIUS - 1;
    return `M${polar(baseRadius, angle - CRACK_BASE_HALF_ANGLE)}L${polar(RIM_RADIUS + length, angle)}L${polar(baseRadius, angle + CRACK_BASE_HALF_ANGLE)}Z`;
  });
};

// --- COMPONENT ---
/** Renders one arrow hole filling its box (the box sets size and spot). */
export const Puncture = ({
  id,
  className = '',
}: {
  id: number;
  className?: string;
}) => {
  const hasShockRing = seeded(id, 42) < SHOCK_RING_CHANCE;
  // A silver edge under the black keeps the hole readable on dark armour.
  const edge = {
    stroke: 'var(--color-range)',
    strokeWidth: 1.4,
    paintOrder: 'stroke',
    strokeLinejoin: 'round',
  } as const;
  return (
    <svg
      viewBox="0 0 100 100"
      className={`block size-full overflow-visible ${className}`}
      aria-hidden="true"
    >
      {hasShockRing && (
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={24 + seeded(id, 43) * 8}
          fill="none"
          stroke={HOLE_FILL}
          strokeWidth="1.2"
          strokeDasharray="9 7 3 7"
          opacity="0.6"
        />
      )}
      {crackPaths(id).map((d) => (
        <path key={d} d={d} fill={HOLE_FILL} {...edge} />
      ))}
      <path d={rimPath(id)} fill={HOLE_FILL} fillRule="evenodd" {...edge} />
    </svg>
  );
};
