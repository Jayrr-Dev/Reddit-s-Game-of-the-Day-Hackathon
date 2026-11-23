// ===================================================================
// VILLAIN DOCK
// The strip between the battlefield and the hand: the villain's
// portrait and HP on the left, energy and statuses in the middle, the
// draw pile and the End Turn hourglass on the right.
// ===================================================================

import { ENERGY_PER_TURN } from '../../../../shared/game/rules';
import type { CombatState } from '../../../../shared/game/types';
import { StatusRow } from '../StatusRow';

// --- TYPES ---
export type VillainDockProps = {
  combat: CombatState;
  onEndTurn: () => void;
};

// --- SUBCOMPONENTS ---
/** The villain's hooded portrait inside a ring that drains with HP. */
const VillainPortrait = ({ hp, maxHp }: { hp: number; maxHp: number }) => {
  const degrees = Math.max(0, (hp / maxHp) * 360);
  return (
    <div
      className="relative grid size-11 shrink-0 place-items-center rounded-full p-[3px]"
      style={{
        background: `conic-gradient(var(--color-hp) ${degrees}deg, var(--color-surface-sunken) 0)`,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 40 40"
        className="size-full rounded-full bg-surface-raised"
      >
        <path
          d="M6 40c1-11 7-16 14-16s13 5 14 16z"
          className="fill-card-curse"
        />
        <path
          d="M11 20c0-9 4-15 9-15s9 6 9 15l-3 5H14z"
          className="fill-surface-sunken"
        />
        <circle cx="17" cy="18" r="1.4" className="fill-hp" />
        <circle cx="23" cy="18" r="1.4" className="fill-hp" />
      </svg>
    </div>
  );
};

/** One pip per point of energy this turn; spent pips go dark. */
const EnergyPips = ({ energy }: { energy: number }) => {
  const pipCount = Math.max(ENERGY_PER_TURN, energy);
  return (
    <div className="flex gap-1" aria-label={`${energy} energy`}>
      {Array.from({ length: pipCount }, (_, index) => (
        <span
          key={index}
          className={`size-3 rounded-full ring-1 ring-black/60 ${index < energy ? 'bg-energy shadow-[0_0_6px_var(--color-energy)]' : 'bg-surface-sunken'}`}
        />
      ))}
    </div>
  );
};

// --- COMPONENT ---
/** Renders the dock. */
export const VillainDock = ({ combat, onEndTurn }: VillainDockProps) => {
  const { player } = combat;
  return (
    <div className="relative z-30 flex h-12 shrink-0 items-center gap-2 px-2">
      <VillainPortrait hp={player.hp} maxHp={player.maxHp} />
      <span className="w-12 font-display text-sm font-black text-hp">
        {player.hp}
        <span className="text-[10px] text-ink-muted">/{player.maxHp}</span>
      </span>
      <div className="flex flex-1 flex-col items-center gap-0.5">
        <EnergyPips energy={combat.energy} />
        <StatusRow combatant={player} />
      </div>
      <span
        className="grid h-9 w-7 place-items-center rounded bg-surface-raised text-xs font-bold ring-1 ring-edge"
        title="Draw pile"
      >
        {combat.drawPile.length}
      </span>
      <button
        type="button"
        onClick={onEndTurn}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-card-guard font-display text-[9px] font-black uppercase leading-tight text-accent ring-2 ring-accent/70 active:scale-95"
      >
        End
        <br />
        turn
      </button>
    </div>
  );
};
