// ===================================================================
// TARGET PLATE
// The top of the combat screen belongs to the hero you are aiming at
// (the one you focused, or the one your dragged card has snapped to):
//   NAME                                   (gold, above the bar's left)
//   ======[ HP ]======                     big drain bar + HP emblem
//   next move (left)          effects (right)
// A gear button in the top-right corner opens the pause sheet.
// ===================================================================

import { getHero } from '../../../../shared/game/heroes';
import type { HeroUnit } from '../../../../shared/game/types';
import { Glyph } from '../../ui/Glyph';
import { StatusRow } from '../StatusRow';
import { DrainBar } from './DrainBar';
import { IntentChips } from './HeroPlate';

// --- TYPES ---
export type TargetPlateProps = {
  unit: HeroUnit | undefined;
  onOpenMenu: () => void;
};

// --- SUBCOMPONENTS ---
/** The settings-style gear in the corner. */
const GearButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Pause menu"
    className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-surface-sunken/85 text-accent ring-1 ring-accent/50 active:scale-95"
  >
    <Glyph name="cog" className="size-5" />
  </button>
);

/** Name, big bar, intent and effects for one hero. */
const Readout = ({ unit }: { unit: HeroUnit }) => (
  <div className="mx-auto flex w-full max-w-md flex-col gap-1 px-12">
    <span className="pl-2 font-display text-xs font-bold uppercase tracking-wider text-accent drop-shadow">
      {getHero(unit.heroId).name}
    </span>
    <DrainBar hp={unit.hp} maxHp={unit.maxHp} size="large" />
    <div className="mt-1 flex items-start justify-between gap-2">
      <IntentChips unit={unit} />
      <StatusRow combatant={unit} />
    </div>
  </div>
);

// --- COMPONENT ---
/** Renders the plate over the top of the battlefield. */
export const TargetPlate = ({ unit, onOpenMenu }: TargetPlateProps) => (
  <header className="pointer-events-none relative z-30 shrink-0 bg-surface pb-2 pt-2">
    {unit ? <Readout unit={unit} /> : <div className="h-14" />}
    <div className="pointer-events-auto">
      <GearButton onClick={onOpenMenu} />
    </div>
  </header>
);
