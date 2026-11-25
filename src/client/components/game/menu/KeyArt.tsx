// ===================================================================
// KEY ART
// The title screen's scene, drawn as one SVG so it needs no image
// assets: a blood-red sunset, the heroes' castle on the skyline, the
// cloaked villain on a ridge in the foreground, and the horde gathering
// on both flanks. Colours come from the theme tokens.
// The scene is anchored to its bottom edge and cropped to fill, so it
// works in a tall phone box and a wide desktop box alike.
// ===================================================================

import { useLayoutEffect, useRef } from 'react';

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

/**
 * Where the castle stands: off to the left on the far hills, so the
 * centred logo never covers it (the low tower faces the logo). Its base runs down past the hill line
 * (CASTLE_FOOTING) and is hidden by the hills, so it rises out of them
 * instead of stopping on a flat edge. Kept low enough that a wide,
 * short post (which crops the sky) never clips its spire.
 */
const CASTLE_AT = { x: 72, y: 180, scale: 0.66 } as const;
const CASTLE_FOOTING = 40;

/**
 * The heroes' castle: a tall keep with a spire, flanking towers with
 * conical roofs and crenellated curtain walls. Drawn about its base
 * centre (y = 0 is the hill line); a few lit windows give it life.
 */
const Castle = () => {
  const castle = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const group = castle.current;
    const svg = group?.ownerSVGElement;
    if (!group || !svg) return;
    const fit = () => {
      const { width, height } = svg.getBoundingClientRect();
      if (!width || !height) return;
      // Match xMidYMax slice so the castle fits the visible part of the sky.
      const zoom = Math.max(width / 360, height / 240);
      const left = (360 - width / zoom) / 2;
      const top = 240 - height / zoom;
      const gap = 12 / zoom;
      const scale = Math.min(CASTLE_AT.scale, Math.max(0, (CASTLE_AT.y - top - gap) / 84));
      const x = Math.max(CASTLE_AT.x, left + gap + 40 * scale);
      group.setAttribute('transform', `translate(${x} ${CASTLE_AT.y}) scale(${scale})`);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  return (
  <g ref={castle} transform={`translate(${CASTLE_AT.x} ${CASTLE_AT.y}) scale(${CASTLE_AT.scale})`}>
    {/* CURTAIN WALLS, WITH BATTLEMENTS */}
    <path
      d={`M-30 ${CASTLE_FOOTING} V-26 h3 v-4 h3 v4 h3 v-4 h3 v4 h3 v-4 h3 v4
          h3 v-4 h3 v4 h3 v-4 h3 v4 h3 v-4 h3 v4 h3 v-4 h3 v4 h3 v-4 h3 v4
          h3 v-4 h3 v4 h3 v-4 h3 v4 V${CASTLE_FOOTING} Z`}
    />
    {/* FLANKING TOWERS AND THEIR ROOFS */}
    <path d={`M-38 ${CASTLE_FOOTING} V-44 h14 V${CASTLE_FOOTING} Z`} />
    <path d="M-40 -44 L-31 -62 L-22 -44 Z" />
    <path d={`M24 ${CASTLE_FOOTING} V-30 h12 V${CASTLE_FOOTING} Z`} />
    <path d="M22 -30 L30 -42 L38 -30 Z" />
    {/* THE KEEP AND ITS SPIRE */}
    <path d={`M-10 ${CASTLE_FOOTING} V-56 h20 V${CASTLE_FOOTING} Z`} />
    <path d="M-12 -56 L0 -84 L12 -56 Z" />
    {/* LIT WINDOWS */}
    <g style={{ fill: 'var(--color-wrath)' }} opacity="0.8">
      <rect x="-2" y="-46" width="4" height="6" rx="2" />
      <rect x="-33" y="-34" width="3" height="5" rx="1.5" />
      <rect x="28.5" y="-22" width="3" height="5" rx="1.5" />
    </g>
  </g>
  );
};

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
    <g style={{ fill: 'var(--color-surface-raised)' }}>
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
