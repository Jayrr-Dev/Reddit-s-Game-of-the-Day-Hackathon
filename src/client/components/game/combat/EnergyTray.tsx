// ===================================================================
// ENERGY TRAY
// The dark tray under the hand holding one pip per point of energy;
// spent pips go dark.
// ===================================================================

import { ENERGY_PER_TURN } from '../../../../shared/game/rules';

// --- COMPONENT ---
/** Renders the energy pips in their tray. */
export const EnergyTray = ({ energy }: { energy: number }) => {
  const pipCount = Math.max(ENERGY_PER_TURN, energy);
  return (
    <div
      className="flex gap-1.5 rounded-full bg-surface-sunken/90 px-3 py-1 ring-1 ring-accent/40"
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
