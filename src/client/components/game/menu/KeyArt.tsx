// ===================================================================
// KEY ART
// The title screen's scene, drawn as one SVG so it needs no image
// assets: a blood-red sunset, the heroes' castle on the skyline, the
// cloaked villain on a ridge in the foreground, and the horde gathering
// on both flanks. Colours come from the theme tokens.
// The scene is anchored to its bottom edge and cropped to fill, so it
// works in a tall phone box and a wide desktop box alike.
// ===================================================================

// --- CONSTANTS ---
/** Gradient ids (unique to this SVG). */
const SKY_ID = 'key-art-sky';
const SUN_ID = 'key-art-sun';
/** Tiny hero silhouettes on the flanks: [x, scale]. */
const HORDE: readonly (readonly [number, number])[] = [
  [40, 0.9],
  [62, 0.75],
  [84, 0.85],
  [276, 0.85],
  [298, 0.75],
  [320, 0.9],
];

// --- SUBCOMPONENTS ---
/** One distant hero: head, body and a raised spear. */
const HordeHero = ({ x, scale }: { x: number; scale: number }) => (
  <g transform={`translate(${x} 214) scale(${scale})`}>
    <circle cx="0" cy="-22" r="4" />
    <path d="M-6 0 L-4 -17 L4 -17 L6 0 Z" />
    <path d="M7 -30 L7 0" strokeWidth="1.5" stroke="currentColor" />
  </g>
);

/** The castle on the skyline: towers, spires and a great hall. */
const Castle = () => (
  <path
    d="M126 170 V128 h8 v-10 l5 -14 l5 14 v10 h8 v-22 l8 -26 l8 26 v22 h10
       v-40 l9 -34 l9 34 v40 h10 v-22 l8 -26 l8 26 v22 h8 v-10 l5 -14 l5 14
       v10 h8 V170 Z"
  />
);

/** The villain: a tall hooded cloak flaring in the wind. */
const Villain = () => (
  // Scaled about its feet on the ridge, so it stands below the logo.
  <g transform="translate(180 224) scale(0.62) translate(-180 -224)">
    <path d="M180 140 q-11 4 -12 18 l-14 66 q20 6 52 -2 l-12 -64 q-1 -16 -14 -18 Z" />
    <path d="M168 170 q-24 18 -40 46 q20 -10 32 -12 Z" />
    <circle cx="176" cy="152" r="1.6" style={{ fill: 'var(--color-blood)' }} />
    <circle cx="184" cy="152" r="1.6" style={{ fill: 'var(--color-blood)' }} />
  </g>
);

// --- COMPONENT ---
/** Draws the title scene; purely decorative. */
export const KeyArt = () => (
  <svg
    className="h-full w-full"
    viewBox="0 0 360 240"
    preserveAspectRatio="xMidYMax slice"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id={SKY_ID} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--color-surface)' }} />
        <stop offset="0.45" style={{ stopColor: 'var(--color-blood)' }} />
        <stop offset="0.85" style={{ stopColor: 'var(--color-wrath)' }} />
      </linearGradient>
      <radialGradient id={SUN_ID} cx="0.5" cy="0.75" r="0.45">
        <stop offset="0" style={{ stopColor: 'var(--color-accent-hover)' }} />
        <stop
          offset="1"
          style={{ stopColor: 'var(--color-accent)', stopOpacity: 0 }}
        />
      </radialGradient>
    </defs>
    {/* SKY AND SUN */}
    <rect width="360" height="240" fill={`url(#${SKY_ID})`} />
    <rect width="360" height="240" fill={`url(#${SUN_ID})`} />
    {/* CASTLE ON THE SKYLINE */}
    <g style={{ fill: 'var(--color-surface-raised)' }} opacity="0.9">
      <Castle />
    </g>
    {/* FAR HILLS */}
    <path
      d="M0 196 q60 -26 120 -14 t120 -6 t120 10 V240 H0 Z"
      style={{ fill: 'var(--color-surface-raised)' }}
    />
    {/* THE HORDE ON THE FLANKS */}
    <g style={{ fill: 'var(--color-surface)', color: 'var(--color-surface)' }}>
      {HORDE.map(([x, scale]) => (
        <HordeHero key={x} x={x} scale={scale} />
      ))}
    </g>
    {/* RIDGE AND THE VILLAIN */}
    <g style={{ fill: 'var(--color-surface-sunken)' }}>
      <path d="M0 222 q90 -22 180 -6 t180 2 V240 H0 Z" />
      <Villain />
    </g>
  </svg>
);
