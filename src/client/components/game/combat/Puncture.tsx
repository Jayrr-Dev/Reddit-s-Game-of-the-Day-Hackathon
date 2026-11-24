// ===================================================================
// PUNCTURE
// A Range hit: an arrow hole punched into the target, drawn thin like
// an ink sketch. A narrow ragged rim around an open hole, hairline
// cracks shooting out at uneven lengths, plus one of a few extras so
// no two holes read the same:
//   PLAIN     just the rim and cracks
//   RINGED    a broken shock ring around it
//   SPLINTER  short splinters between the long cracks
//   DOUBLE    a second, fainter rim just outside the first
// Every part is drawn from the pop id, so each hole is different but
// never changes on re-render.
// PERFORMANCE: one static SVG per hit, no filters; the animation only
// touches transform and opacity (see impact-puncture in index.css).
// ===================================================================

import { memo } from 'react';
import { seeded } from '../../../lib/seeded';

// --- TYPES ---
type Variant = 'plain' | 'ringed' | 'splinter' | 'double';

// --- CONSTANTS ---
/** The drawing is a 100 x 100 box centred on (50, 50). */
const CENTRE = 50;
const HOLE_RADIUS = 7.5;
const RIM_RADIUS = 10;
/** How far the rim's outer edge wobbles in or out (viewBox units). */
const RIM_JITTER = 1.1;
const RIM_POINTS = 18;
/** Long cracks: 4 to 8 of them, 14 to 40 units past the rim. */
const MIN_CRACKS = 4;
const EXTRA_CRACKS = 5;
const MIN_CRACK_LENGTH = 14;
const EXTRA_CRACK_LENGTH = 26;
/** Half the width (viewBox units) of a crack where it leaves the rim. */
const CRACK_HALF_WIDTH = 1.3;
/** Splinters (SPLINTER only): short cracks between the long ones. */
const SPLINTER_LENGTH = 6;
const VARIANTS: readonly Variant[] = ['plain', 'ringed', 'splinter', 'double'];
const INK = '#0b0507';

// --- HELPERS ---
/** A point at `radius` from the centre, at `angle` radians. */
const polar = (radius: number, angle: number): string =>
  `${(CENTRE + radius * Math.cos(angle)).toFixed(1)} ${(CENTRE + radius * Math.sin(angle)).toFixed(1)}`;

/** A closed circle path (for cutting the hole out of the rim). */
const circlePath = (radius: number): string =>
  `M${CENTRE - radius} ${CENTRE}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0Z`;

/**
 * The rim: a wobbly outer edge with the round hole cut out of it
 * (evenodd fill keeps the hole open), so only a thin ragged ring shows.
 */
const rimPath = (id: number, radius: number, salt: number): string => {
  const outer = Array.from({ length: RIM_POINTS }, (_, i) => {
    const angle = (i / RIM_POINTS) * Math.PI * 2;
    const wobble = (seeded(id, salt + i) * 2 - 1) * RIM_JITTER;
    return `${i === 0 ? 'M' : 'L'}${polar(radius + wobble, angle)}`;
  }).join('');
  return `${outer}Z${circlePath(radius - (RIM_RADIUS - HOLE_RADIUS))}`;
};

/** One hairline wedge leaving the rim at `angle`, `length` units long. */
const crack = (angle: number, length: number): string => {
  const spread = CRACK_HALF_WIDTH / RIM_RADIUS;
  const base = RIM_RADIUS - 0.5;
  return `M${polar(base, angle - spread)}L${polar(RIM_RADIUS + length, angle)}L${polar(base, angle + spread)}Z`;
};

/**
 * The cracks: spread round the rim with a little jitter, so they never
 * look evenly spaced, each its own length. SPLINTER adds a short one
 * halfway between each pair.
 */
const crackPaths = (id: number, variant: Variant): string[] => {
  const count = MIN_CRACKS + Math.floor(seeded(id, 40) * EXTRA_CRACKS);
  const start = seeded(id, 41) * Math.PI * 2;
  const step = (Math.PI * 2) / count;
  const long = Array.from({ length: count }, (_, i) => {
    const jitter = (seeded(id, 50 + i) - 0.5) * step * 0.6;
    const length = MIN_CRACK_LENGTH + seeded(id, 60 + i) * EXTRA_CRACK_LENGTH;
    return crack(start + i * step + jitter, length);
  });
  if (variant !== 'splinter') return long;
  const short = Array.from({ length: count }, (_, i) =>
    crack(
      start + (i + 0.5) * step,
      SPLINTER_LENGTH * (0.6 + seeded(id, 70 + i))
    )
  );
  return [...long, ...short];
};

/** A broken shock ring: dashes of uneven length (RINGED only). */
const ShockRing = ({ id }: { id: number }) => (
  <circle
    cx={CENTRE}
    cy={CENTRE}
    r={22 + seeded(id, 43) * 10}
    fill="none"
    stroke={INK}
    strokeWidth="0.9"
    strokeDasharray="10 6 3 8 14 7"
    strokeDashoffset={seeded(id, 44) * 40}
    opacity="0.55"
  />
);

// --- COMPONENT ---
/**
 * Renders one arrow hole filling its box (the box sets size and spot).
 * Memoised: its shape only depends on the id, so the geometry is built
 * once per hit, not on every re-render of the hero during a fight.
 */
export const Puncture = memo(function Puncture({
  id,
  className = '',
}: {
  id: number;
  className?: string;
}) {
  const variant = VARIANTS[Math.floor(seeded(id, 45) * VARIANTS.length)];
  // A hairline silver edge under the ink keeps it readable on dark armour.
  const edge = {
    stroke: 'var(--color-range)',
    strokeWidth: 0.7,
    paintOrder: 'stroke',
    strokeLinejoin: 'round',
  } as const;
  return (
    <svg
      viewBox="0 0 100 100"
      className={`block size-full overflow-visible ${className}`}
      aria-hidden="true"
    >
      {variant === 'ringed' && <ShockRing id={id} />}
      {variant === 'double' && (
        <path
          d={rimPath(id, RIM_RADIUS + 3.5, 80)}
          fill={INK}
          fillRule="evenodd"
          opacity="0.45"
        />
      )}
      {crackPaths(id, variant ?? 'plain').map((d) => (
        <path key={d} d={d} fill={INK} {...edge} />
      ))}
      <path
        d={rimPath(id, RIM_RADIUS, 20)}
        fill={INK}
        fillRule="evenodd"
        {...edge}
      />
    </svg>
  );
});
