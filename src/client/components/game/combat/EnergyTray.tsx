// ===================================================================
// ENERGY TRAY
// A soft dark pool under the hand holding one pip per point of energy;
// spent pips go dark. After them sit the reserve slots (grey rings,
// RESERVE_ENERGY_SLOTS): energy left unspent at the end of the turn
// waits there and is added to the next turn. No rim: the backing
// feathers out at its edges (TRAY_BACKING), so it reads as shade
// rather than a box.
// ===================================================================

import {
  ENERGY_PER_TURN,
  RESERVE_ENERGY_SLOTS,
} from '../../../../shared/game/rules';

// --- CONSTANTS ---
/** A dark oval that fades to nothing well before the tray's edge. */
const TRAY_BACKING =
  'radial-gradient(closest-side, color-mix(in srgb, var(--color-surface-sunken) 92%, transparent) 55%, transparent)';

const PIP_SHAPE = 'size-3 rounded-full';
const LIT_PIP = 'bg-energy shadow-[0_0_6px_var(--color-energy)]';

// --- HELPERS ---
/**
 * How many pips and reserve slots are lit. Energy fills the normal pips
 * first (the turn's own, plus any extra a card gave), then the reserve
 * slots, so the carried point is the first one spent. Between turns
 * the stored `reserve` lights its slots.
 */
const trayFill = (energy: number, reserve: number) => {
  const extra = Math.max(0, energy - ENERGY_PER_TURN - RESERVE_ENERGY_SLOTS);
  const pipCount = ENERGY_PER_TURN + extra;
  const litPips = Math.min(energy, pipCount);
  const litReserve = Math.min(
    RESERVE_ENERGY_SLOTS,
    Math.max(0, energy - pipCount) + reserve
  );
  return { pipCount, litPips, litReserve };
};

// --- COMPONENT ---
/** Renders the energy pips and the reserve slots in their tray. */
export const EnergyTray = ({
  energy,
  reserve,
}: {
  energy: number;
  reserve: number;
}) => {
  const { pipCount, litPips, litReserve } = trayFill(energy, reserve);
  return (
    <div
      // pt > pb: the pips sit a step lower, nearer the hand.
      className="flex items-center gap-1.5 px-6 pb-1.5 pt-3.5"
      style={{ background: TRAY_BACKING }}
      aria-label={`${energy} energy, ${litReserve} in reserve`}
    >
      {Array.from({ length: pipCount }, (_, index) => (
        <span
          key={index}
          className={`${PIP_SHAPE} ring-1 ring-black/60 ${index < litPips ? LIT_PIP : 'bg-surface-raised'}`}
        />
      ))}
      {/* RESERVE SLOTS: a grey ring, filled gold while it holds energy */}
      {Array.from({ length: RESERVE_ENERGY_SLOTS }, (_, index) => (
        <span
          key={`reserve-${index}`}
          title="Reserve: unspent energy carries over to your next turn"
          className={`${PIP_SHAPE} ml-1 ring-2 ring-ink-muted ${index < litReserve ? LIT_PIP : 'bg-transparent'}`}
        />
      ))}
    </div>
  );
};
