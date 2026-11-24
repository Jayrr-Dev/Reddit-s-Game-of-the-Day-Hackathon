// ===================================================================
// MELEE SWEEP
// Your Melee card's blade passing over the heroes it hits, just before
// the red slices land on them: a silver-white blur centred on the
// targets, as wide as the swing (one target, a short cut; the whole
// front row, a long one). Its cut (flat sweep, backhand, down- or
// up-slash, a crossing X, a thrust) comes from SWEEP_STYLES
// (content/meleeSweeps.ts), so swings don't all look alike.
// PERFORMANCE: transform and opacity only (index.css, "MELEE SWEEP");
// the blur is a soft gradient, not a filter.
// ===================================================================

import type { CSSProperties } from 'react';
import {
  SWEEP_STYLES,
  type SweepStroke,
  type SweepStyle,
} from '../../../content/meleeSweeps';
import type { SweepFlight } from '../../../lib/meleeSweep';

// --- CONSTANTS ---
/** Height of each shape, as a share of the swing's width. */
const SHAPE_HEIGHT: Record<SweepStyle['shape'], number> = {
  crescent: 0.42,
  thrust: 0.14,
};

// --- SUBCOMPONENTS ---
/** A crescent: a thin bright edge over a wide silver blur. */
const Crescent = () => (
  <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="size-full">
    <defs>
      <linearGradient id="melee-sweep-blur" x1="0" x2="1">
        <stop offset="0" stopColor="#dfe6ee" stopOpacity="0" />
        <stop offset="0.55" stopColor="#dfe6ee" stopOpacity="0.45" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.95" />
      </linearGradient>
    </defs>
    <path d="M2 30 Q50 -4 98 22 Q50 14 2 30Z" fill="url(#melee-sweep-blur)" />
    <path
      d="M10 26 Q52 2 97 22"
      fill="none"
      stroke="#ffffff"
      strokeWidth="1.2"
      strokeLinecap="round"
      opacity="0.9"
    />
  </svg>
);

/** A thrust: a straight streak, blurred behind, sharp at the point. */
const Thrust = () => (
  <svg viewBox="0 0 100 14" preserveAspectRatio="none" className="size-full">
    <defs>
      <linearGradient id="melee-thrust-blur" x1="0" x2="1">
        <stop offset="0" stopColor="#dfe6ee" stopOpacity="0" />
        <stop offset="0.7" stopColor="#dfe6ee" stopOpacity="0.5" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="1" />
      </linearGradient>
    </defs>
    <path
      d="M0 3 L86 5.5 L100 7 L86 8.5 L0 11Z"
      fill="url(#melee-thrust-blur)"
    />
    <path
      d="M30 7 L99 7"
      stroke="#ffffff"
      strokeWidth="1"
      strokeLinecap="round"
    />
  </svg>
);

/** One stroke: turned and maybe flipped, then swept out from its tail. */
const Stroke = ({
  sweep,
  stroke,
  shape,
}: {
  sweep: SweepFlight;
  stroke: SweepStroke;
  shape: SweepStyle['shape'];
}) => (
  <span
    className="absolute block"
    style={{
      left: sweep.centre.x,
      top: sweep.centre.y,
      width: sweep.width,
      height: sweep.width * SHAPE_HEIGHT[shape],
      transform: `translate(-50%, -50%) rotate(${stroke.rotateDeg}deg) scaleX(${stroke.isFlipped ? -1 : 1})`,
    }}
  >
    <span
      className="melee-sweep block size-full"
      style={{ animationDelay: `${stroke.delayMs}ms` } as CSSProperties}
    >
      {shape === 'thrust' ? <Thrust /> : <Crescent />}
    </span>
  </span>
);

// --- COMPONENT ---
/** Renders one swing (place it on a fixed, full-screen layer). */
export const MeleeSweep = ({ sweep }: { sweep: SweepFlight }) => {
  const { shape, strokes } = SWEEP_STYLES[sweep.style];
  return (
    <span aria-hidden="true">
      {strokes.map((stroke, index) => (
        <Stroke key={index} sweep={sweep} stroke={stroke} shape={shape} />
      ))}
    </span>
  );
};
