// ===================================================================
// SHOCK CHARGE
// Shock's chip icon: a lightning bolt that charges as the hits in a row add
// up toward the burst (SHOCK_HITS, see lib/shockStage):
//   empty     no hits yet            an outline
//   charging  some hits              filled a step per hit
//   full      one hit off (primed)   full, and it pulses
//   splash    the bursting hit       bursts outward as the damage lands
// PERFORMANCE: transform and opacity only (index.css "SHOCK CHARGE");
// reduced motion shows a steady full bolt (no pulse, no splash).
// ===================================================================

import { useId } from 'react';
import type { ShockCharge as Charge } from '../../lib/shockStage';

// --- CONSTANTS ---
/** The bolt, on a 10 x 10 box. */
const BOLT_PATH = 'M6.2.5 2 5.6h2.7L3.6 9.5 8.2 4.2H5.4L6.2.5Z';
/** A blood drop, on the same box (Bleed's charge toward its burst). */
export const DROP_PATH =
  'M5 .6C3.6 3 2.2 4.8 2.2 6.6a2.8 2.8 0 0 0 5.6 0C7.8 4.8 6.4 3 5 .6Z';
/** The bolt's box height: a full fill reaches y 0 on it. */
const BOX = 10;
/** The discharge's sparks: which way each flies (degrees). */
const SPLASH_ANGLES = [-150, -100, -60, -20, 30] as const;

// --- COMPONENT ---
/** Renders the bolt (or `path`) at its charge, in the current text colour. */
export const ShockCharge = ({
  charge,
  path = BOLT_PATH,
}: {
  charge: Charge;
  path?: string;
}) => {
  const { stage, fill } = charge;
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
          <rect x="0" y={BOX * (1 - fill)} width={BOX} height={BOX} />
        </clipPath>
        <path d={path} fill="currentColor" clipPath={`url(#${clipId})`} />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="0.9" />
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
