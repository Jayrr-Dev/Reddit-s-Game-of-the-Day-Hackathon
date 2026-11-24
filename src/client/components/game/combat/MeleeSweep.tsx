// ===================================================================
// MELEE SWEEP
// Your Melee card's blade passing over the heroes it hits, just before
// the red slices land on them: a silver-white crescent with a motion
// blur, swept left to right across every target. One target gets a
// short slash; a card that hits the whole front row sweeps all of it,
// so a wider swing reads as a wider cut.
// PERFORMANCE: one element per sweep; transform and opacity only
// (index.css, "MELEE SWEEP"), and the blur is a soft gradient, not a
// filter.
// ===================================================================

import type { CSSProperties } from 'react';
import type { SweepFlight } from '../../../lib/meleeSweep';

// --- COMPONENT ---
/** Renders one sweep (place it on a fixed, full-screen layer). */
export const MeleeSweep = ({ sweep }: { sweep: SweepFlight }) => (
  <span
    className="melee-sweep absolute block"
    style={
      {
        left: sweep.centre.x,
        top: sweep.centre.y,
        width: sweep.width,
        height: sweep.width * 0.42,
      } as CSSProperties
    }
    aria-hidden="true"
  >
    {/* THE CRESCENT: a thin bright edge over a wide silver blur */}
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
  </span>
);
