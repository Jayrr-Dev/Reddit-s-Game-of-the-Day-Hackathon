// ===================================================================
// ENERGY TRAY
// A soft dark pool under the hand holding one pip per point of energy;
// spent pips go dark. No rim: the backing feathers out at its edges
// (TRAY_BACKING), so it reads as shade rather than a box.
// ===================================================================

import { ENERGY_PER_TURN } from '../../../../shared/game/rules';

// --- CONSTANTS ---
/** A dark oval that fades to nothing well before the tray's edge. */
const TRAY_BACKING =
  'radial-gradient(closest-side, color-mix(in srgb, var(--color-surface-sunken) 92%, transparent) 55%, transparent)';

// --- COMPONENT ---
/** Renders the energy pips in their tray. */
export const EnergyTray = ({ energy }: { energy: number }) => {
  const pipCount = Math.max(ENERGY_PER_TURN, energy);
  return (
    <div
      // pt > pb: the pips sit a step lower, nearer the hand.
      className="flex gap-1.5 px-6 pb-1.5 pt-3.5"
      style={{ background: TRAY_BACKING }}
      aria-label={`${energy} energy`}
    >
      {Array.from({ length: pipCount }, (_, index) => (
        <span
          key={index}
          className={`size-3 rounded-full ring-1 ring-black/60 ${index < energy ? 'bg-energy shadow-[0_0_6px_var(--color-energy)]' : 'bg-surface-raised'}`}
        />
      ))}
    </div>
  );
};
