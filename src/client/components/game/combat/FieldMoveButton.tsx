// ===================================================================
// FIELD MOVE BUTTONS
// The villain's two moves on the battlefield itself, each a pill with
// its current energy cost (it rises by 1 for each use in a row, see
// fieldMoveCost), greyed out when there isn't enough energy:
//   CHARGE     shown while every hero holds the back row: the back row
//              steps up and you gain Momentum.
//   BACK STEP  shown while every hero stands in the front row: you fall
//              back, so the whole field ends up in the back row.
// ===================================================================

import type { FieldMoveId } from '../../../../shared/game/types';
import { Glyph, type GlyphName } from '../../ui/Glyph';

// --- TYPES ---
/** How one field move's pill looks and what its tooltip says. */
type FieldMoveLook = {
  label: string;
  glyph: GlyphName;
  title: string;
  toneClass: string;
};

// --- CONSTANTS ---
const FIELD_MOVE_LOOK: Record<FieldMoveId, FieldMoveLook> = {
  charge: {
    label: 'Charge',
    glyph: 'bolt',
    title:
      'Charge: the back row steps up, and your next Melee card this turn deals 50% more damage. Costs 1 more for each Charge in a row.',
    toneClass: 'bg-blood shadow-[0_0_14px_var(--color-blood)]',
  },
  backStep: {
    label: 'Back Step',
    glyph: 'march',
    title:
      'Back Step: fall back, so the heroes end up in the back row. Melee heroes cannot reach you until they step up again. Costs 1 more for each Back Step in a row.',
    toneClass:
      'bg-surface-raised shadow-[0_0_14px_var(--color-shroud)] [&_svg]:rotate-180',
  },
};

// --- COMPONENT ---
/** The pill for one field move, with its energy cost. */
export const FieldMoveButton = ({
  move,
  cost,
  isAffordable,
  onPress,
}: {
  move: FieldMoveId;
  /** Its energy cost right now. */
  cost: number;
  isAffordable: boolean;
  onPress: () => void;
}) => {
  const look = FIELD_MOVE_LOOK[move];
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={!isAffordable}
      title={look.title}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-1 pr-3 font-display text-sm font-black uppercase tracking-widest text-ink ring-1 ring-accent transition active:scale-95 enabled:animate-pulse disabled:opacity-40 disabled:shadow-none ${look.toneClass}`}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-energy text-xs text-surface-sunken">
        {cost}
      </span>
      <Glyph name={look.glyph} className="size-4" />
      {look.label}
    </button>
  );
};
