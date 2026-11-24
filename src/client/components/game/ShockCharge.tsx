// ===================================================================
// SHOCK CHARGE
// Shock's chip icon: a lightning bolt that charges as the hits in a row add
// up toward the burst (SHOCK_HITS, 3):
//   empty   no hits yet        an outline
//   half    1 hit              half full
//   full    2 hits (primed)    full, and it pulses
//   splash  the 3rd hit        bursts outward as the damage lands
// PERFORMANCE: transform and opacity only (index.css "SHOCK CHARGE");
// reduced motion shows a steady full bolt (no pulse, no splash).
// ===================================================================

import { useId } from 'react';
import type { ShockStage } from '../../lib/shockStage';

// --- CONSTANTS ---
/** The bolt, on a 10 x 10 box. */
const BOLT_PATH = 'M6.2.5 2 5.6h2.7L3.6 9.5 8.2 4.2H5.4L6.2.5Z';
/** How far up the bolt is charged at each stage (y on the 10 box). */
const FILL_TOP: Record<ShockStage, number> = {
  empty: 10,
  half: 5.6,
  full: 0,
  splash: 0,
};
/** The discharge's sparks: which way each flies (degrees). */
const SPLASH_ANGLES = [-150, -100, -60, -20, 30] as const;

// --- COMPONENT ---
/** Renders the bolt at its stage, in the current text colour. */
export const ShockCharge = ({ stage }: { stage: ShockStage }) => {
  const clipId = useId();
  return (
    <span
      className="shock-charge relative inline-flex size-3"
      data-stage={stage}
    >
      <svg
        viewBox="0 0 10 10"
        className="shock-charge-body size-full"
        aria-hidden="true"
      >
        <clipPath id={clipId}>
          <rect x="0" y={FILL_TOP[stage]} width="10" height="10" />
        </clipPath>
        <path d={BOLT_PATH} fill="currentColor" clipPath={`url(#${clipId})`} />
        <path
          d={BOLT_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
        />
      </svg>
      {stage === 'splash' &&
        SPLASH_ANGLES.map((angle) => (
          <span
            key={angle}
            className="shock-charge-droplet absolute left-1/2 top-1/2 size-1 rounded-full bg-current"
            style={{ ['--drop-angle' as string]: `${angle}deg` }}
          />
        ))}
    </span>
  );
};
