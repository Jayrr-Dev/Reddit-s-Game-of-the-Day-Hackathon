// ===================================================================
// PLAYER PANEL
// The villain's HP, shroud, statuses and remaining energy.
// ===================================================================

import { ENERGY_PER_TURN } from '../../../shared/game/rules';
import type { Combatant } from '../../../shared/game/types';
import { Glyph } from '../ui/Glyph';
import { Meter } from '../ui/Meter';
import { StatusRow } from './StatusRow';

export type PlayerPanelProps = {
  player: Combatant;
  energy: number;
};

/** Energy orb plus HP bar and statuses. */
export const PlayerPanel = ({ player, energy }: PlayerPanelProps) => (
  <div className="flex w-full items-center gap-3">
    <div
      className="flex size-12 shrink-0 flex-col items-center justify-center rounded-full bg-surface-sunken text-energy ring-2 ring-energy"
      title="Energy"
    >
      <Glyph name="bolt" className="size-4" />
      <span className="text-sm font-black leading-none">
        {energy}/{ENERGY_PER_TURN}
      </span>
    </div>
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-display font-bold">The Villain</span>
        <StatusRow combatant={player} />
      </div>
      <Meter
        value={player.hp}
        max={player.maxHp}
        fillClass="bg-hp"
        label={`${player.hp} / ${player.maxHp}`}
      />
    </div>
  </div>
);
