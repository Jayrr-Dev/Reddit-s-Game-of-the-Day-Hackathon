// ===================================================================
// BLEED BURST
// Bleed going off (its Nth attack): one ~1.3 s sequence over the body,
//   0-30%   two thin dark-red slashes fly in from the upper corners
//   20-45%  a red star flares inside a soft glow
//   30-55%  the slashes cross into an X over the flare
//   35-50%  a ragged blood ring bursts out, droplets flying off
//   55-70%  the X and the flare fade
//   60-100% the ring breaks up, piece by piece, and fades
// Everything is data (SLASHES, RING_PIECES, DROPLETS) on a 100 x 100
// box. PERFORMANCE: transform and opacity only (index.css "BLEED
// BURST"); reduced motion shows the ring alone, fading.
// ===================================================================

import type { CSSProperties } from 'react';

// --- TYPES ---
/**
 * One slash: its blade's diagonal, the upper end it grows from (a short
 * dash at the corner, then the full blade across), and where it flies in
 * from.
 */
type Slash = {
  path: string;
  originX: number;
  originY: number;
  fromX: number;
  fromY: number;
};
/** One piece of the ring: its arc, and when it breaks off (ms). */
type RingPiece = { path: string; fadeDelayMs: number };
/** One droplet: its size and where it flies to (box units). */
type Droplet = { r: number; dx: number; dy: number };

// --- DATA ---
/** The two blades, thin and tapered, crossing at the centre as an X. */
const SLASHES: readonly Slash[] = [
  {
    path: 'M22 22 L51.2 49 L78 78 L49 51.2 Z',
    originX: 22,
    originY: 22,
    fromX: -6,
    fromY: -8,
  },
  {
    path: 'M78 22 L51 51.2 L22 78 L49 49 Z',
    originX: 78,
    originY: 22,
    fromX: 6,
    fromY: -8,
  },
];

/**
 * The ragged ring, in seven uneven pieces around a radius of about 17,
 * each a thick swoosh that breaks off at its own time.
 */
const RING_PIECES: readonly RingPiece[] = [
  { path: 'M35 40 Q38 32 47 33 L46 36 Q40 36 37 42 Z', fadeDelayMs: 760 },
  { path: 'M51 33 Q60 31 65 38 L62 39 Q58 35 52 36 Z', fadeDelayMs: 900 },
  { path: 'M66 43 Q69 50 66 56 L63 54 Q65 50 63 45 Z', fadeDelayMs: 820 },
  { path: 'M64 60 Q60 67 53 68 L53 65 Q58 63 61 58 Z', fadeDelayMs: 960 },
  { path: 'M47 68 Q40 68 36 63 L39 61 Q42 64 47 65 Z', fadeDelayMs: 820 },
  { path: 'M33 58 Q31 52 33 46 L36 48 Q34 52 36 57 Z', fadeDelayMs: 820 },
  { path: 'M41 36 L44 34 L43 38 Z', fadeDelayMs: 700 },
];

/** Blood droplets thrown off as the ring bursts. */
const DROPLETS: readonly Droplet[] = [
  { r: 1.6, dx: -22, dy: -18 },
  { r: 1.2, dx: 26, dy: -20 },
  { r: 1.4, dx: 30, dy: 4 },
  { r: 1.1, dx: 24, dy: 22 },
  { r: 1.5, dx: -2, dy: 30 },
  { r: 1.0, dx: -30, dy: 20 },
  { r: 1.3, dx: -28, dy: -2 },
  { r: 0.9, dx: 8, dy: -30 },
];

/** The star flare: eight long points and eight short. */
const STAR_PATH = (() => {
  const points = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * Math.PI) / 8;
    const reach = i % 2 === 0 ? 20 : 4;
    return `${(50 + Math.cos(angle) * reach).toFixed(1)} ${(50 + Math.sin(angle) * reach).toFixed(1)}`;
  });
  return `M${points.join(' L')} Z`;
})();

// --- HELPERS ---
/** A CSS custom property bag (for the keyframes' offsets). */
const vars = (entries: Record<string, string>): CSSProperties =>
  entries as CSSProperties;

// --- COMPONENT ---
/** Renders one Bleed burst over its parent's box; it plays once. */
export const BleedBurst = () => (
  <svg
    viewBox="0 0 100 100"
    className="bleed-burst pointer-events-none absolute inset-0 size-full overflow-visible"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="bleed-burst-glow">
        <stop offset="0%" stopColor="var(--color-bleed)" stopOpacity="0.75" />
        <stop offset="100%" stopColor="var(--color-bleed)" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* GLOW AND STAR FLARE */}
    <g className="bleed-burst-flare">
      <circle cx="50" cy="50" r="24" fill="url(#bleed-burst-glow)" />
      <path d={STAR_PATH} fill="var(--color-bleed)" />
      <circle cx="50" cy="50" r="2.2" fill="white" />
    </g>
    {/* THE RAGGED RING, BREAKING UP PIECE BY PIECE */}
    <g className="bleed-burst-ring">
      {RING_PIECES.map((piece) => (
        <path
          key={piece.path}
          d={piece.path}
          className="bleed-burst-piece"
          fill="#a50f1d"
          style={vars({ '--piece-delay': `${piece.fadeDelayMs}ms` })}
        />
      ))}
    </g>
    {/* DROPLETS FLY OFF */}
    {DROPLETS.map((drop) => (
      <circle
        key={`${drop.dx},${drop.dy}`}
        cx="50"
        cy="50"
        r={drop.r}
        fill="#a50f1d"
        className="bleed-burst-drop"
        style={vars({ '--dx': `${drop.dx}px`, '--dy': `${drop.dy}px` })}
      />
    ))}
    {/* THE TWO SLASHES FLY IN AND CROSS */}
    {SLASHES.map((slash) => (
      <path
        key={slash.path}
        d={slash.path}
        className="bleed-burst-slash"
        fill="#5e0610"
        stroke="var(--color-bleed)"
        strokeWidth="0.4"
        style={vars({
          '--from-x': `${slash.fromX}px`,
          '--from-y': `${slash.fromY}px`,
          transformOrigin: `${slash.originX}px ${slash.originY}px`,
        })}
      />
    ))}
  </svg>
);
