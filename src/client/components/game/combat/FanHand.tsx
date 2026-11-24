// ===================================================================
// FAN HAND
// The hand as a fan along the bottom. Each card sits at an absolute
// spot worked out from its place in the fan (closer together when the
// hand is big, so cards overlap). When a card leaves, the rest slide to
// their new spots (CSS transition) instead of the row jumping, and a
// card let go without being played glides back from where it was dropped.
// ===================================================================

import { useLayoutEffect, useRef } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { HAND_ATTR } from '../../../hooks/useCardFlights';
import { canPlayCard } from '../../../../shared/game/combat';
import { imbuesAt } from '../../../../shared/game/imbue';
import type { CombatState } from '../../../../shared/game/types';
import {
  HAND_SLOT_ATTR,
  HELD_CARD_ATTR,
  type CardBox,
} from '../../../hooks/useCardDrag';
import { useHandIds } from '../../../hooks/useHandIds';
import { usesSpentOn } from '../../../../shared/game/uses';
import { CardView } from '../CardView';
import { LIFT_SCALE } from './DraggedCard';

// --- TYPES ---
export type FanHandProps = {
  combat: CombatState;
  heldIndex: number | null;
  /** Slots the raised Imbue card may imbue: they glow teal. */
  imbueSlots: readonly number[];
  /** The slot the imbue arrow points at: its glow pulses. */
  imbueAimedSlot: number | null;
  onTapCard: (handIndex: number) => void;
  /** Pointer down on a card: may become a drag (see useCardDrag). */
  onPressCard: (handIndex: number, event: PointerEvent<HTMLElement>) => void;
  /** The card being dragged; its slot is left empty while it is lifted. */
  draggedIndex: number | null;
  /** Where the dragged card is drawn now (so it can glide back). */
  draggedBox: CardBox | null;
};

// --- CONSTANTS ---
/** Pixels each card drops per step away from the middle (whole pixels). */
const DROP_PER_CARD = 4;
/** The held card is raised out of the fan, upright and enlarged. */
const HELD_TRANSFORM = 'translateY(-34px) scale(1.4)';
/** Widest gap between card centres; tighter when the hand is big. */
const SLOT_WIDTH = '4.25rem';
/** How long a let-go card takes to glide back into its slot (ms). */
const RETURN_MS = 240;
/** A soft ease-out with no overshoot, so the card settles, not bounces. */
const RETURN_EASING = 'cubic-bezier(0.25, 0.8, 0.35, 1)';

// --- HELPERS ---
/**
 * Where a slot sits in the fan; the held card stands up out of it.
 * No tilt and whole-pixel steps only: a rotated card (or one on a
 * half pixel) rasterizes its small text blurry, so the fan is an
 * upright arc. translateX(-50%) centres the slot on its `left` spot
 * (a whole pixel too: the fan card is an even 68px wide).
 */
const slotTransform = (offset: number, isHeld: boolean): string => {
  const drop = Math.round(Math.abs(offset) * DROP_PER_CARD);
  const fan = isHeld ? HELD_TRANSFORM : `translateY(${drop}px)`;
  return `translateX(-50%) ${fan}`;
};

/**
 * A slot's `left`: the fan's middle plus its offset in slot widths,
 * snapped to a whole pixel so the card's text sits on the pixel grid.
 */
const slotLeft = (offset: number): string =>
  `round(calc(50% + ${offset} * var(--slot)), 1px)`;

// --- SUBCOMPONENTS ---
type HandSlotProps = {
  /** Its card's place in the hand (shots launch from the played slot). */
  handIndex: number;
  offset: number;
  isHeld: boolean;
  isLifted: boolean;
  liftedBox: CardBox | null;
  onPress: (event: PointerEvent<HTMLElement>) => void;
  children: ReactNode;
};

/**
 * One spot in the fan. While its card is lifted it remembers where the
 * card is drawn; when the card comes back (let go, not played) it plays
 * a short glide from that spot into the slot. Imperative on purpose:
 * this is a one-off animation started by an event (the release).
 */
const HandSlot = ({
  handIndex,
  offset,
  isHeld,
  isLifted,
  liftedBox,
  onPress,
  children,
}: HandSlotProps) => {
  const slotRef = useRef<HTMLDivElement>(null);
  const lastBoxRef = useRef<CardBox | null>(null);
  const wasLiftedRef = useRef(false);
  // While its card is lifted the slot stays in the fan pose (never the
  // raised "held" pose), so letting go starts no second transition.
  const transform = slotTransform(offset, isHeld && !isLifted);

  // RETURN GLIDE: runs before paint, so the card never flashes in place.
  useLayoutEffect(() => {
    if (isLifted) {
      lastBoxRef.current = liftedBox ?? lastBoxRef.current;
      wasLiftedRef.current = true;
      return;
    }
    const from = lastBoxRef.current;
    const slot = slotRef.current;
    const hand = slot?.offsetParent;
    if (!wasLiftedRef.current || !from || !slot || !hand) return;
    wasLiftedRef.current = false;
    // Where the slot's centre sits before its fan tilt, from layout
    // boxes (not the transformed box, which a running transition skews).
    const handBox = hand.getBoundingClientRect();
    const dx = from.center.x - (handBox.left + slot.offsetLeft);
    const dy =
      from.center.y - (handBox.top + slot.offsetTop + slot.offsetHeight / 2);
    // Start exactly where the lifted copy was drawn (same size, upright).
    const start = `translateX(-50%) translate(${dx}px, ${dy}px) scale(${LIFT_SCALE})`;
    slot.animate([{ transform: start }, { transform }], {
      duration: RETURN_MS,
      easing: RETURN_EASING,
    });
  }, [isLifted, liftedBox, transform]);

  return (
    <div
      ref={slotRef}
      // touch-none: a press on a card drags it instead of scrolling.
      className={`absolute bottom-3 flex origin-bottom touch-none select-none justify-center transition-[left,transform] duration-200 ${isHeld ? 'z-10' : ''} ${isLifted ? 'opacity-0' : ''}`}
      onPointerDown={onPress}
      style={{ left: slotLeft(offset), transform }}
      {...{ [HAND_SLOT_ATTR]: handIndex }}
      {...(isHeld ? { [HELD_CARD_ATTR]: true } : {})}
    >
      {children}
    </div>
  );
};

// --- COMPONENT ---
/** Renders the fanned hand. */
export const FanHand = ({
  combat,
  heldIndex,
  imbueSlots,
  imbueAimedSlot,
  onTapCard,
  onPressCard,
  draggedIndex,
  draggedBox,
}: FanHandProps) => {
  const keys = useHandIds(combat.hand, combat.turn);
  const count = combat.hand.length;
  const middle = (count - 1) / 2;
  // --slot: the gap between card centres, tighter when the hand is big.
  const slotWidth = `min(${SLOT_WIDTH}, calc((100% - 2rem) / ${Math.max(count, 1)}))`;
  return (
    <div
      className="relative z-20 h-32 shrink-0"
      style={{ ['--slot' as string]: slotWidth }}
      {...{ [HAND_ATTR]: true }}
    >
      {combat.hand.map((cardId, index) => {
        const isLifted = index === draggedIndex;
        return (
          <HandSlot
            key={keys[index]}
            handIndex={index}
            offset={index - middle}
            isHeld={index === heldIndex}
            isLifted={isLifted}
            liftedBox={isLifted ? draggedBox : null}
            onPress={(event) => onPressCard(index, event)}
          >
            <CardView
              cardId={cardId}
              attacker={combat.player}
              size="fan"
              isSelected={index === heldIndex}
              imbues={imbuesAt(combat, index)}
              usesSpent={usesSpentOn(combat.usesSpent, cardId)}
              isImbueTarget={imbueSlots.includes(index)}
              isImbueAimed={index === imbueAimedSlot}
              // While an Imbue aims, the cards it can't go on fade back.
              isFaded={
                imbueSlots.length > 0 &&
                index !== heldIndex &&
                !imbueSlots.includes(index)
              }
              // While imbuing, every card can be tapped (to pick or let go).
              isDisabled={
                imbueSlots.length === 0 && !canPlayCard(combat, index)
              }
              onClick={() => onTapCard(index)}
            />
          </HandSlot>
        );
      })}
    </div>
  );
};
