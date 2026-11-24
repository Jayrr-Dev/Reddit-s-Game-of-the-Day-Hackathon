// ===================================================================
// CURSE SIGIL
// What a curse (Hex eating at you) draws over the screen: a purple
// sigil, two rings around a pentagram, that blooms out of the centre
// while turning, with a skull burning in its heart and wisps of hex
// smoke curling off its points. Drawn in --color-hex, so it reads as
// the same harm as the Hex chip.
// PERFORMANCE: one SVG; transform and opacity animations only
// (index.css, "CURSE SIGIL").
// ===================================================================

import { Glyph } from '../../ui/Glyph';

// --- CONSTANTS ---
/** The pentagram's five points on a circle of radius 38 (viewBox 100). */
const STAR_POINTS = [0, 2, 4, 1, 3]
  .map((step) => {
    const angle = (step * 72 - 90) * (Math.PI / 180);
    return `${(50 + 38 * Math.cos(angle)).toFixed(1)},${(50 + 38 * Math.sin(angle)).toFixed(1)}`;
  })
  .join(' ');

/** Wisps curling off the sigil: [left %, top %, delay ms]. */
const WISPS: readonly (readonly [number, number, number])[] = [
  [50, 8, 0],
  [88, 38, 90],
  [74, 86, 180],
  [26, 86, 130],
  [12, 38, 60],
];

// --- COMPONENT ---
/** One curse landing: the sigil, its skull, and its smoke. */
export const CurseSigil = () => (
  <span className="relative block size-full text-hex">
    <svg
      viewBox="0 0 100 100"
      className="curse-sigil absolute inset-0 size-full drop-shadow-[0_0_8px_var(--color-hex)]"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
    >
      <circle cx="50" cy="50" r="46" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="40" strokeWidth="1" strokeDasharray="3 4" />
      <polygon points={STAR_POINTS} strokeWidth="2" />
    </svg>
    <span className="curse-skull absolute inset-[34%] flex">
      <Glyph name="skull" className="size-full" />
    </span>
    {WISPS.map(([left, top, delay]) => (
      <span
        key={`${left}-${top}`}
        className="curse-wisp absolute size-[9%] rounded-full bg-hex/60 blur-[3px]"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          animationDelay: `${delay}ms`,
        }}
      />
    ))}
  </span>
);
