// ===================================================================
// DRAGGED CARD
// The card lifted out of the hand while it is being dragged. It is
// drawn on a fixed, click-through layer at the finger, slightly
// enlarged, while its slot in the hand stays empty. Cards that act on
// the villain glow gold, brighter the higher they are pulled.
// ===================================================================

import type { CardId } from '../../../../shared/game/cards';
import type { Combatant, HeroUnit } from '../../../../shared/game/types';
import type { CardBox } from '../../../hooks/useCardDrag';
import { CardView } from '../CardView';

// --- TYPES ---
export type DraggedCardProps = {
  cardId: CardId;
  attacker: Combatant;
  /** The hero the drag is locked onto, so the numbers fit that hero. */
  target?: HeroUnit | undefined;
  box: CardBox;
  /** 0 (no glow) to 1 (pulled high enough to play). */
  glow: number;
};

// --- CONSTANTS ---
/** How much bigger the lifted card is drawn. */
export const LIFT_SCALE = 1.08;
/** The glow's blur radius (px) at rest and at full strength. */
const GLOW_MIN_PX = 6;
const GLOW_MAX_PX = 26;

// --- HELPERS ---
/** A gold halo whose size and strength follow the glow (0..1). */
const glowFilter = (glow: number): string => {
  if (glow <= 0) return 'drop-shadow(0 10px 14px rgb(0 0 0 / 0.7))';
  const blur = GLOW_MIN_PX + (GLOW_MAX_PX - GLOW_MIN_PX) * glow;
  const strength = Math.round(35 + 65 * glow);
  const gold = `color-mix(in srgb, var(--color-accent-hover) ${strength}%, transparent)`;
  return `drop-shadow(0 0 ${blur}px ${gold}) drop-shadow(0 0 ${blur / 3}px ${gold})`;
};

// --- COMPONENT ---
/** Renders the lifted card centred on its drag position. */
export const DraggedCard = ({
  cardId,
  attacker,
  target,
  box,
  glow,
}: DraggedCardProps) => (
  <div
    className="pointer-events-none fixed z-40 transition-[filter] duration-150"
    style={{
      left: box.center.x,
      top: box.center.y,
      transform: `translate(-50%, -50%) scale(${LIFT_SCALE})`,
      filter: glowFilter(glow),
    }}
  >
    <CardView
      cardId={cardId}
      attacker={attacker}
      target={target}
      size="fan"
      onClick={() => {}}
    />
  </div>
);
