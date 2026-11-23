// ===================================================================
// FAN HAND
// The hand as a fan along the bottom. Each card sits in a slot that may
// shrink: with more cards than fit, slots shrink and the cards overlap
// on their own (the card keeps its width), so no width maths is needed.
// ===================================================================

import type { PointerEvent } from 'react';
import { canPlayCard } from '../../../../shared/game/combat';
import type { CombatState } from '../../../../shared/game/types';
import { CardView } from '../CardView';

// --- TYPES ---
export type FanHandProps = {
  combat: CombatState;
  heldIndex: number | null;
  onTapCard: (handIndex: number) => void;
  /** Pointer down on a card: may become a drag (see useCardDrag). */
  onPressCard: (handIndex: number, event: PointerEvent<HTMLElement>) => void;
};

// --- CONSTANTS ---
/** Degrees of tilt per card away from the middle of the fan. */
const TILT_PER_CARD = 4;
/** Pixels each card drops per step away from the middle. */
const DROP_PER_CARD = 3;

// --- COMPONENT ---
/** Renders the fanned hand. */
export const FanHand = ({
  combat,
  heldIndex,
  onTapCard,
  onPressCard,
}: FanHandProps) => {
  const middle = (combat.hand.length - 1) / 2;
  return (
    <div className="relative z-20 flex h-32 shrink-0 items-end justify-center px-4 pb-1">
      {combat.hand.map((cardId, index) => {
        const offset = index - middle;
        const isHeld = index === heldIndex;
        return (
          <div
            // A hand can hold duplicates, so the slot index is part of the key.
            key={`${combat.turn}-${index}-${cardId}`}
            // touch-none: a press on a card drags it instead of scrolling.
            className={`flex min-w-0 shrink basis-[4.25rem] touch-none select-none justify-center ${isHeld ? 'z-10' : ''}`}
            onPointerDown={(event) => onPressCard(index, event)}
            style={{
              transform: `translateY(${Math.abs(offset) * DROP_PER_CARD}px) rotate(${offset * TILT_PER_CARD}deg)`,
            }}
          >
            <CardView
              cardId={cardId}
              attacker={combat.player}
              size="fan"
              isSelected={isHeld}
              isDisabled={!canPlayCard(combat, index)}
              onClick={() => onTapCard(index)}
            />
          </div>
        );
      })}
    </div>
  );
};
