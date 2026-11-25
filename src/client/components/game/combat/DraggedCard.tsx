// ===================================================================
// DRAGGED CARD
// The card lifted out of the hand while it is being dragged. It is
// drawn on a fixed, click-through layer at the finger, slightly
// enlarged, while its slot in the hand stays empty. Cards that act on
// the villain glow gold, brighter the higher they are pulled. While it
// is aimed at a hero, its text shows the damage that hero would take.
// ===================================================================

import type { ReactNode } from 'react';
import type { CardId } from '../../../../shared/game/cards';
import type { Combatant, HeroUnit } from '../../../../shared/game/types';
import { DRAGGED_CARD_ATTR, type CardBox } from '../../../hooks/useCardDrag';
import { CardView } from '../CardView';

// --- TYPES ---
export type DraggedCardProps = {
  cardId?: CardId | undefined;
  children?: ReactNode;
  attacker: Combatant;
  killsThisTurn: number;
  usesSpent: number;
  followUpReady?: boolean | undefined;
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
  children,
  attacker,
  killsThisTurn,
  usesSpent,
  followUpReady,
  target,
  box,
  glow,
}: DraggedCardProps) => (
  <div
    {...{ [DRAGGED_CARD_ATTR]: true }}
    className="pointer-events-none fixed left-0 top-0 z-40 will-change-transform transition-[filter] duration-150"
    style={{
      width: box.width,
      height: box.height,
      transform: `translate3d(${box.center.x}px, ${box.center.y}px, 0) translate(-50%, -50%) scale(${LIFT_SCALE})`,
      filter: glowFilter(glow),
    }}
  >
    {children ?? (cardId && <CardView
      cardId={cardId}
      usesSpent={usesSpent}
      attacker={attacker} killsThisTurn={killsThisTurn} followUpReady={followUpReady}
      target={target}
      size="fan"
      onClick={() => {}}
    />)}
  </div>
);
