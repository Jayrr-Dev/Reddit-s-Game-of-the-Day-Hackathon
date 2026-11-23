// ===================================================================
// DRAGGED CARD
// The card lifted out of the hand while it is being dragged. It is
// drawn on a fixed, click-through layer at the finger, slightly
// enlarged, while its slot in the hand stays empty.
// ===================================================================

import type { CardId } from '../../../../shared/game/cards';
import type { Combatant } from '../../../../shared/game/types';
import type { CardBox } from '../../../hooks/useCardDrag';
import { CardView } from '../CardView';

// --- TYPES ---
export type DraggedCardProps = {
  cardId: CardId;
  attacker: Combatant;
  box: CardBox;
};

// --- CONSTANTS ---
/** How much bigger the lifted card is drawn. */
const LIFT_SCALE = 1.08;

// --- COMPONENT ---
/** Renders the lifted card centred on its drag position. */
export const DraggedCard = ({ cardId, attacker, box }: DraggedCardProps) => (
  <div
    className="pointer-events-none fixed z-40 drop-shadow-[0_10px_14px_rgba(0,0,0,0.7)]"
    style={{
      left: box.center.x,
      top: box.center.y,
      transform: `translate(-50%, -50%) scale(${LIFT_SCALE})`,
    }}
  >
    <CardView
      cardId={cardId}
      attacker={attacker}
      size="fan"
      onClick={() => {}}
    />
  </div>
);
