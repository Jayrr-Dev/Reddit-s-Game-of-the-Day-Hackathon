// ===================================================================
// SHOCK CHARGE
// Shock's chip icon: a lightning bolt that's charged immediately.
//   full      ready for an attack   full, and it pulses
//   splash    the burst       bursts outward as the damage lands
// PERFORMANCE: transform and opacity only (index.css "SHOCK CHARGE");
// reduced motion shows a steady full bolt (no pulse, no splash).
// ===================================================================

import type { ShockCharge as Charge } from '../../lib/shockStage';

// --- CONSTANTS ---
/** The bolt, on a 10 x 10 box. */
const BOLT_PATH = 'M6.2.5 2 5.6h2.7L3.6 9.5 8.2 4.2H5.4L6.2.5Z';
/** The discharge's sparks: which way each flies (degrees). */
const SPLASH_ANGLES = [-150, -100, -60, -20, 30] as const;

// --- COMPONENT ---
/** Renders the bolt at its charge, in the current text colour. */
export const ShockCharge = ({ charge }: { charge: Charge }) => {
  const { stage } = charge;
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
        <path d={BOLT_PATH} fill="currentColor" stroke="currentColor" strokeWidth="0.9" />
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
