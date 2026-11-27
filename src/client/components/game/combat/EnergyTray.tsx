// --- ENERGY TRAY ---
import { characterBonuses, withBorrowedStats, type Equipment, type TraitNodes, type Traits } from '../../../../shared/game/character';
import type { BorrowedStats } from '../../../../shared/game/borrowedPowers';

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
const trayFill = (energy: number, reserve: number, startingEnergy: number, retainEnergy: number) => {
  const extra = Math.max(0, energy - startingEnergy - retainEnergy);
  const pipCount = startingEnergy + extra;
  const litPips = Math.min(energy, pipCount);
  const litReserve = Math.min(
    retainEnergy,
    Math.max(0, energy - pipCount) + reserve
  );
  return {
    pipCount,
    litPips,
    litReserve,
  };
};

// --- COMPONENT ---
/** Renders the energy pips and the reserve slots in their tray. */
export const EnergyTray = ({
  inspectable = false,
  energy,
  reserve,
  traits,
  traitNodes,
  equipment,
  borrowedStats,
}: {
  inspectable?: boolean;
  energy: number;
  reserve: number;
  traits?: Partial<Traits> | undefined;
  traitNodes?: TraitNodes | undefined;
  equipment?: Equipment | undefined;
  borrowedStats?: BorrowedStats | undefined;
}) => {
  const { startingEnergy, retainEnergy, maxEnergy } = withBorrowedStats(characterBonuses(traits, equipment, traitNodes), borrowedStats);
  const { pipCount, litPips, litReserve } = trayFill(energy, reserve, startingEnergy, retainEnergy);
  const showCount = pipCount + retainEnergy > MAX_VISIBLE_PIPS;
  const Tray = inspectable ? 'button' : 'div';
  return (
    <Tray
      // pt > pb: the pips sit a step lower, nearer the hand.
      role={inspectable ? undefined : 'img'}
      className="table-pips relative flex items-center gap-1.5 px-6 pb-1.5 pt-3.5"
      style={{ background: TRAY_BACKING, ...(inspectable && { pointerEvents: 'auto', cursor: 'pointer' }) }}
      aria-label={`${energy} of ${maxEnergy} energy, ${reserve} stored, retains up to ${retainEnergy}`}
    >
      {showCount ? <strong className="text-sm leading-none text-energy tabular-nums">
        {reserve ? `${reserve} held` : `${energy} / ${maxEnergy}`}
      </strong> : <>
      {Array.from({ length: pipCount }, (_, index) => (
        <span
          key={index}
          className={`${PIP_SHAPE} ${index < litPips ? LIT_PIP : 'bg-transparent'}`}
        />
      ))}
      {/* RESERVE SLOTS: a grey ring, filled gold while it holds energy */}
      {Array.from({ length: retainEnergy }, (_, index) => (
        <span
          key={`reserve-${index}`}
          title="Reserve: unspent energy carries over to your next turn"
          className={`${PIP_SHAPE} ${index < litReserve ? LIT_PIP : 'bg-transparent'}`}
        />
      ))}
      </>}
    </Tray>
  );
};
