// ===================================================================
// THUD
// One blunt blow (a Blunt Melee card: fists, shields, hammers): a comic
// "impact" burst, no blood. A black splat of tapered, curling spikes
// with a hollow heart, short speed streaks flying off it, and a thin
// pale shock ring rolling outward. The counterpart of Slice.
// PERFORMANCE: static paths; only transform and opacity animate
// (index.css, "impact-thud" and "impact-shockwave").
// ===================================================================

import { seeded } from '../../../lib/seeded';

// --- CONSTANTS ---
/** The splat's ink: flat black, like a comic panel's impact. */
const INK = '#050304';
/** The shock ring and the splat's thin pale rim. */
const RING_STROKE = '#f3e6d8';
/** How many spikes the splat throws out. */
const SPIKE_COUNT = 11;
/** Spike tips reach this far out, plus up to SPIKE_SPREAD (viewBox 100). */
const SPIKE_TIP = 34;
const SPIKE_SPREAD = 14;
/** The valleys between spikes sit this far out. */
const VALLEY = 20;
/** The hollow heart's spikes (smaller, the same rhythm). */
const HOLE_TIP = 12;
const HOLE_VALLEY = 7;
/** How far each spike curls sideways (radians), so it reads as a splash. */
const CURL = 0.22;
/** Speed streaks flying off between the spikes. */
const STREAK_COUNT = 6;

// --- HELPERS ---
/** A point `radius` out from the centre at `angle` (radians). */
const at = (angle: number, radius: number): string =>
  `${(50 + Math.cos(angle) * radius).toFixed(1)} ${(50 + Math.sin(angle) * radius).toFixed(1)}`;

/**
 * A closed star of curling spikes: valley, curve out to a tip, curve
 * back to the next valley. Tip lengths are seeded by the pop id (via
 * `salt`) so each blow looks different but never jumps on re-render.
 */
const spikyRing = (
  id: number,
  salt: number,
  tip: number,
  spread: number,
  valley: number
): string => {
  const step = (Math.PI * 2) / SPIKE_COUNT;
  const turn = seeded(id, salt) * step;
  const parts = Array.from({ length: SPIKE_COUNT }, (_, index) => {
    const base = turn + index * step;
    const tipAngle = base + step / 2 + CURL * 0.5;
    const reach = tip + seeded(id, salt + 1 + index) * spread;
    // Control points pulled toward the tip's curl: a tapered, bent spike.
    const out = at(base + step * 0.35, reach * 0.62);
    const back = at(base + step * 0.85, reach * 0.55);
    return `Q${out} ${at(tipAngle, reach)}Q${back} ${at(base + step, valley)}`;
  });
  return `M${at(turn, valley)}${parts.join('')}Z`;
};

/** One speed streak: a thin wedge flying out past the spikes. */
const streakPath = (id: number, index: number): string => {
  const angle =
    ((index + seeded(id, 40 + index) * 0.6) / STREAK_COUNT) * Math.PI * 2;
  const from = SPIKE_TIP + 6 + seeded(id, 50 + index) * 4;
  const to = from + 8 + seeded(id, 60 + index) * 6;
  return `M${at(angle - 0.03, from)}L${at(angle, to)}L${at(angle + 0.03, from)}Z`;
};

// --- COMPONENT ---
/** Renders one blunt impact filling its (square) box. */
export const Thud = ({ id }: { id: number }) => (
  <span className="absolute inset-0">
    {/* SHOCK RING: thin, rolling outward */}
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
        stroke={RING_STROKE}
        strokeWidth="1.5"
      />
    </svg>
    {/* THE SPLAT: black spikes with a hollow heart, and streaks */}
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 size-full animate-impact-thud"
      aria-hidden
    >
      <path
        d={`${spikyRing(id, 0, SPIKE_TIP, SPIKE_SPREAD, VALLEY)}${spikyRing(id, 20, HOLE_TIP, 4, HOLE_VALLEY)}`}
        fill={INK}
        fillRule="evenodd"
        stroke={RING_STROKE}
        strokeWidth="0.8"
        strokeOpacity="0.5"
      />
      {Array.from({ length: STREAK_COUNT }, (_, index) => (
        <path key={index} d={streakPath(id, index)} fill={INK} />
      ))}
    </svg>
  </span>
);
