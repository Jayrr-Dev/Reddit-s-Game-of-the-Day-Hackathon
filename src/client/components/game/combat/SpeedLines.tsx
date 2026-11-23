// ===================================================================
// SPEED LINES
// The Charge burst: thin wedges radiate from the edges toward the
// middle of the battlefield, rush inward and fade (--animate-speed-lines),
// like the villain lunging at the back row. Drawn as one SVG; the
// wedges are generated, so there are no assets.
// ===================================================================

// --- CONSTANTS ---
const LINE_COUNT = 36;
/** Wedges stop short of the centre by this much (viewBox units, 0-100). */
const INNER_MIN = 34;
const INNER_SPREAD = 16;
/** Wedge width at the outer end, in degrees. */
const WEDGE_DEGREES = 2.4;
const OUTER_RADIUS = 150;

// --- HELPERS ---
/** A point `radius` from the centre at `degrees` (viewBox -100..100). */
const polar = (degrees: number, radius: number): string => {
  const rad = (degrees * Math.PI) / 180;
  return `${(Math.cos(rad) * radius).toFixed(1)},${(Math.sin(rad) * radius).toFixed(1)}`;
};

/**
 * One wedge per line: evenly spaced, with a fixed pseudo-random wobble
 * in angle and length (from the index, so every burst looks the same
 * and renders identically on server and client).
 */
const WEDGES: readonly string[] = Array.from({ length: LINE_COUNT }, (_, i) => {
  const angle = (i * 360) / LINE_COUNT + ((i * 37) % 7) - 3;
  const inner = INNER_MIN + ((i * 53) % INNER_SPREAD);
  const tip = polar(angle, inner);
  const left = polar(angle - WEDGE_DEGREES / 2, OUTER_RADIUS);
  const right = polar(angle + WEDGE_DEGREES / 2, OUTER_RADIUS);
  return `M${tip} L${left} L${right} Z`;
});

// --- COMPONENT ---
/** Plays the burst once; re-key it to play again. */
export const SpeedLines = () => (
  // Clipped to the battlefield, so the inward rush never covers the bars.
  <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
    <svg
      className="size-full animate-speed-lines"
      viewBox="-100 -100 200 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g className="fill-ink" opacity="0.7">
        {WEDGES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  </div>
);
