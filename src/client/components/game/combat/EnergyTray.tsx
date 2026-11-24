// --- ENERGY TRAY ---
import {
  ENERGY_PER_TURN,
  RESERVE_ENERGY_SLOTS,
} from '../../../../shared/game/rules';

// --- CONSTANTS ---
/** A dark oval that fades to nothing well before the tray's edge. */
const TRAY_BACKING =
  'radial-gradient(closest-side, color-mix(in srgb, var(--color-surface-sunken) 92%, transparent) 55%, transparent)';

const MAX_VISIBLE_PIPS = 6;
const PIP_SHAPE = 'size-3 rounded-full border border-ink-muted/60';
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
  return {
    pipCount: Math.min(pipCount, MAX_VISIBLE_PIPS - RESERVE_ENERGY_SLOTS),
    litPips,
    litReserve,
  };
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
      role="img"
      className="table-pips relative flex items-center gap-1.5 px-6 pb-1.5 pt-3.5"
      style={{ background: TRAY_BACKING }}
      aria-label={`${energy} energy, ${litReserve} in reserve`}
    >
      {energy > MAX_VISIBLE_PIPS && (
        <strong className="absolute bottom-full left-1/2 -translate-x-1/2 rounded bg-surface-sunken px-1 text-xs leading-tight text-energy tabular-nums">
          {energy}
        </strong>
      )}
      {Array.from({ length: pipCount }, (_, index) => (
        <span
          key={index}
          className={`${PIP_SHAPE} ${index < litPips ? LIT_PIP : 'bg-transparent'}`}
        />
      ))}
      {/* RESERVE SLOTS: a grey ring, filled gold while it holds energy */}
      {Array.from({ length: RESERVE_ENERGY_SLOTS }, (_, index) => (
        <span
          key={`reserve-${index}`}
          title="Reserve: unspent energy carries over to your next turn"
          className={`${PIP_SHAPE} ${index < litReserve ? LIT_PIP : 'bg-transparent'}`}
        />
      ))}
    </div>
  );
};
