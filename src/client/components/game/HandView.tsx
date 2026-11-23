// ===================================================================
// HAND VIEW
// The cards in hand as a horizontally scrolling row. Tapping a playable
// card plays it at the currently targeted hero.
// ===================================================================

import { canPlayCard } from '../../../shared/game/combat';
import type { CombatState } from '../../../shared/game/types';
import { CardView } from './CardView';

export type HandViewProps = {
  combat: CombatState;
  onPlay: (handIndex: number) => void;
};

/** Renders the hand; unaffordable cards are dimmed and disabled. */
export const HandView = ({ combat, onPlay }: HandViewProps) => (
  <div className="flex w-full gap-1.5 overflow-x-auto px-2 pb-1 pt-2">
    {combat.hand.map((cardId, index) => (
      <CardView
        // A hand can hold duplicates, so the slot index is part of the key.
        key={`${combat.turn}-${index}-${cardId}`}
        cardId={cardId}
        attacker={combat.player}
        size="hand"
        isDisabled={!canPlayCard(combat, index)}
        onClick={() => onPlay(index)}
      />
    ))}
  </div>
);
