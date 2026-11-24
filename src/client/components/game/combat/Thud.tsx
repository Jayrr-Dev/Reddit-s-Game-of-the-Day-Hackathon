// ===================================================================
// THUD
// One blunt blow (a Blunt Melee card: fists, shields, hammers): a dark
// bruise where it landed, jagged cracks bursting out from it, and a
// pale shockwave ring rolling outward. The counterpart of Slice.
// PERFORMANCE: static paths; only transform and opacity animate
// (index.css, "impact-thud" and "impact-shockwave").
// ===================================================================

import { seeded } from '../../../lib/seeded';

// --- CONSTANTS ---
const CRACK_FILL = 'var(--color-hp)';
const BRUISE_FILL = '#1a0306';
/** How many cracks burst out of the bruise. */
const CRACK_COUNT = 7;
/** Cracks start this far out (viewBox units of 100, centre 50). */
const CRACK_INNER = 14;
/** Shortest and extra length of a crack, before the centre gap. */
const CRACK_MIN = 24;
const CRACK_SPREAD = 12;

// --- HELPERS ---
/**
 * One jagged crack, `index` of CRACK_COUNT around the centre: a thin
 * wedge with a kink halfway, its length and kink seeded by the pop id
 * so it never jumps on re-render.
 */
const crackPath = (id: number, index: number): string => {
  const turn = ((index + seeded(id, 10 + index) * 0.5) / CRACK_COUNT) * 2;
  const angle = turn * Math.PI;
  const length = CRACK_MIN + seeded(id, 20 + index) * CRACK_SPREAD;
  const kink = (seeded(id, 30 + index) - 0.5) * 0.5;
  const at = (radius: number, bend = 0) => {
    const x = 50 + Math.cos(angle + bend) * radius;
    const y = 50 + Math.sin(angle + bend) * radius;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  };
  const outer = CRACK_INNER + length;
  const mid = CRACK_INNER + length * 0.55;
  return `M${at(CRACK_INNER, -0.22)}L${at(mid, kink)}L${at(outer)}L${at(mid, kink + 0.1)}L${at(CRACK_INNER, 0.22)}Z`;
};

// --- COMPONENT ---
/** Renders one blunt impact filling its (square) box. */
export const Thud = ({ id }: { id: number }) => (
  <span className="absolute inset-0">
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 size-full animate-impact-shockwave"
      aria-hidden
    >
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="#f3e6d8"
        strokeWidth="5"
        opacity="1"
      />
    </svg>
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 size-full animate-impact-thud"
      aria-hidden
    >
      <circle cx="50" cy="50" r="19" fill={CRACK_FILL} />
      <circle cx="50" cy="50" r="12" fill={BRUISE_FILL} />
      {Array.from({ length: CRACK_COUNT }, (_, index) => (
        <path key={index} d={crackPath(id, index)} fill={CRACK_FILL} />
      ))}
    </svg>
  </span>
);
