// ===================================================================
// MOVEMENT BUTTON
// The villain's moves on the battlefield itself, each a pill with its
// current energy cost (all movements share one streak that raises it,
// see movementCost), greyed out when there isn't enough energy:
//   CHARGE     shown while every hero holds the back row: the back row
//              steps up and you gain Momentum.
//   BACK STEP  shown while every hero stands in the front row: you fall
//              back, so the whole field ends up in the back row.
// ===================================================================

import type { MovementId } from '../../../../shared/game/types';
import { MOVEMENT_LOOK } from '../../../content/visuals';
import { Glyph } from '../../ui/Glyph';
import { Tooltip } from '../../ui/Tooltip';

// --- COMPONENT ---
/** The pill for one movement, with its energy cost. */
export const MovementButton = ({
  move,
  cost,
  isAffordable,
  onPress,
}: {
  move: MovementId;
  /** Its energy cost right now. */
  cost: number;
  isAffordable: boolean;
  onPress: () => void;
}) => {
  const look = MOVEMENT_LOOK[move];
  return (
    <Tooltip content={{ title: look.label, description: look.description }}>
      <button
        type="button"
        onClick={onPress}
        disabled={!isAffordable}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-1 pr-3 font-display text-sm font-black uppercase tracking-widest text-ink ring-1 ring-accent transition active:scale-95 enabled:animate-pulse disabled:opacity-40 disabled:shadow-none ${look.toneClass}`}
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-energy text-xs text-surface-sunken">
          <span className="num-center">{cost}</span>
        </span>
        <Glyph name={look.glyph} className="size-4" />
        {look.label}
      </button>
    </Tooltip>
  );
};
