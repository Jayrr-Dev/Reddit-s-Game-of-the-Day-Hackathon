// ===================================================================
// MAGIC BURST
// A Magic hit: a burst of arcane energy that plays out in four beats,
// each its own layer so it can fade on its own schedule:
//   FLASH     a small spiky star with a white-hot core
//   RAYS      thin straight rays shoot out from it
//   CURLS     the rays twist into wavy strands moving outward
//             (or, in the RING variant, a ring of short ticks)
//   SPARKS    the strands break into tiny squiggles that drift and vanish
// Ray count, lengths, rotation and variant come from the pop id, so each
// burst is different but never changes on re-render.
// PERFORMANCE: static SVG layers with no filters; each layer animates
// only transform and opacity (magic-* keyframes in index.css).
// ===================================================================

import { memo, type ReactNode } from 'react';
import { seeded } from '../../../lib/seeded';

// --- CONSTANTS ---
/** Every layer is a 100 x 100 box centred on (50, 50). */
const CENTRE = 50;
const MIN_RAYS = 7;
const EXTRA_RAYS = 5;
const SPARK_COUNT = 14;
const TICK_COUNT = 12;
const ENERGY = 'color-mix(in oklab, var(--color-shroud) 65%, #9ff3ff)';
/** A dark underline so the energy reads on light and blue armour. */
const SHADOW = 'rgb(10 6 20 / 0.7)';
const CORE = 'white';

// --- HELPERS ---
/** A point at `radius` from the centre, at `angle` radians, as "x y". */
const polar = (radius: number, angle: number): string =>
  `${(CENTRE + radius * Math.cos(angle)).toFixed(1)} ${(CENTRE + radius * Math.sin(angle)).toFixed(1)}`;

/** A straight line from radius `from` to `to` along `angle`. */
const radial = (angle: number, from: number, to: number): string =>
  `M${polar(from, angle)}L${polar(to, angle)}`;

/**
 * A wavy strand along `angle` from radius `from` to `to`: it bends from
 * side to side `waves` times, `amplitude` units off the straight line.
 */
const squiggle = (
  angle: number,
  from: number,
  to: number,
  waves: number,
  amplitude: number
): string => {
  const step = (to - from) / waves;
  const side = angle + Math.PI / 2;
  let d = `M${polar(from, angle)}`;
  for (let i = 0; i < waves; i++) {
    const mid = from + step * (i + 0.5);
    const bend = (i % 2 === 0 ? 1 : -1) * amplitude;
    const cx = CENTRE + mid * Math.cos(angle) + bend * Math.cos(side);
    const cy = CENTRE + mid * Math.sin(angle) + bend * Math.sin(side);
    d += `Q${cx.toFixed(1)} ${cy.toFixed(1)} ${polar(from + step * (i + 1), angle)}`;
  }
  return d;
};

/** The angles of the burst's rays, evenly spread with some jitter. */
const rayAngles = (id: number): number[] => {
  const count = MIN_RAYS + Math.floor(seeded(id, 90) * EXTRA_RAYS);
  const start = seeded(id, 91) * Math.PI * 2;
  const step = (Math.PI * 2) / count;
  return Array.from(
    { length: count },
    (_, i) => start + i * step + (seeded(id, 100 + i) - 0.5) * step * 0.5
  );
};

/** The spiky star at the heart of the flash (8 points). */
const starPath = (id: number): string =>
  Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2 + seeded(id, 92);
    const radius = i % 2 === 0 ? 9 + seeded(id, 120 + i) * 5 : 3;
    return `${i === 0 ? 'M' : 'L'}${polar(radius, angle)}`;
  }).join('') + 'Z';

// --- SUBCOMPONENTS ---
/** One stacked layer of the burst, with its own animation. */
const Layer = ({
  animation,
  children,
}: {
  animation: string;
  children: ReactNode;
}) => (
  <svg
    viewBox="0 0 100 100"
    className={`absolute inset-0 size-full overflow-visible ${animation}`}
    fill="none"
    strokeLinecap="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

// --- COMPONENT ---
/**
 * Renders one Magic burst filling its box (the box sets size and spot).
 * Memoised: its shape depends only on the id.
 */
export const MagicBurst = memo(function MagicBurst({ id }: { id: number }) {
  const angles = rayAngles(id);
  const isRing = seeded(id, 93) < 0.35;
  const rays = angles.map((a, i) =>
    radial(a, 7, 26 + seeded(id, 130 + i) * 18)
  );
  const curls = angles.map((a, i) =>
    squiggle(
      a,
      14,
      34 + seeded(id, 140 + i) * 10,
      3,
      2.5 + seeded(id, 150 + i) * 2
    )
  );
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) =>
    radial((i / TICK_COUNT) * Math.PI * 2 + seeded(id, 94), 24, 30)
  );
  const sparks = Array.from({ length: SPARK_COUNT }, (_, i) => {
    const angle = seeded(id, 160 + i) * Math.PI * 2;
    const radius = 26 + seeded(id, 180 + i) * 22;
    return squiggle(
      angle,
      radius,
      radius + 4 + seeded(id, 200 + i) * 4,
      2,
      1.6
    );
  });
  return (
    <span className="absolute inset-0">
      <Layer animation="animate-magic-flash">
        <path d={starPath(id)} fill={ENERGY} />
        <circle cx={CENTRE} cy={CENTRE} r="3.2" fill={CORE} />
      </Layer>
      <Layer animation="animate-magic-rays">
        <path d={rays.join('')} stroke={SHADOW} strokeWidth="4.2" />
        <path d={rays.join('')} stroke={ENERGY} strokeWidth="2.6" />
        <path d={rays.join('')} stroke={CORE} strokeWidth="0.9" />
      </Layer>
      <Layer animation="animate-magic-curls">
        <path
          d={(isRing ? ticks : curls).join('')}
          stroke={SHADOW}
          strokeWidth="3.6"
        />
        <path
          d={(isRing ? ticks : curls).join('')}
          stroke={ENERGY}
          strokeWidth="2.2"
        />
      </Layer>
      <Layer animation="animate-magic-sparks">
        <path d={sparks.join('')} stroke={SHADOW} strokeWidth="3" />
        <path d={sparks.join('')} stroke={ENERGY} strokeWidth="1.8" />
      </Layer>
    </span>
  );
});
