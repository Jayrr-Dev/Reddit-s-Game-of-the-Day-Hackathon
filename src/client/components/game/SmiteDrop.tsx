// ===================================================================
// SMITE DROP
// Smite's chip icon: a blood drop that fills as the hits in a row add
// up toward the burst (SMITE_HITS, 3):
//   empty   no hits yet        an outline
//   half    1 hit              half full
//   full    2 hits (primed)    full, and it pulses
//   splash  the 3rd hit        bursts outward as the damage lands
// PERFORMANCE: transform and opacity only (index.css "SMITE DROP");
// reduced motion shows a steady full drop (no pulse, no splash).
// ===================================================================

import { useId } from 'react';
import type { SmiteStage } from '../../lib/smiteStage';

// --- CONSTANTS ---
/** The drop, on a 10 x 10 box (the same drop StatusFx uses). */
const DROP_PATH = 'M5 .5C6.5 3 8 4.8 8 6.6a3 3 0 0 1-6 0C2 4.8 3.5 3 5 .5Z';
/** Where the blood's surface sits for each stage (y on the 10 box). */
const FILL_TOP: Record<SmiteStage, number> = {
  empty: 10,
  half: 5.6,
  full: 0,
  splash: 0,
};
/** The splash's droplets: which way each flies (degrees). */
const SPLASH_ANGLES = [-150, -100, -60, -20, 30] as const;

// --- COMPONENT ---
/** Renders the drop at its stage, in the current text colour. */
export const SmiteDrop = ({ stage }: { stage: SmiteStage }) => {
  const clipId = useId();
  return (
    <span className="smite-drop relative inline-flex size-3" data-stage={stage}>
      <svg
        viewBox="0 0 10 10"
        className="smite-drop-body size-full"
        aria-hidden="true"
      >
        <clipPath id={clipId}>
          <rect x="0" y={FILL_TOP[stage]} width="10" height="10" />
        </clipPath>
        <path d={DROP_PATH} fill="currentColor" clipPath={`url(#${clipId})`} />
        <path
          d={DROP_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
        />
      </svg>
      {stage === 'splash' &&
        SPLASH_ANGLES.map((angle) => (
          <span
            key={angle}
            className="smite-drop-droplet absolute left-1/2 top-1/2 size-1 rounded-full bg-current"
            style={{ ['--drop-angle' as string]: `${angle}deg` }}
          />
        ))}
    </span>
  );
};
