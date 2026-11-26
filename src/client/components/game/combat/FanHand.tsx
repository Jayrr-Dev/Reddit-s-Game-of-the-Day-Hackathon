// ===================================================================
// FAN HAND
// The hand as a fan along the bottom. Each card sits at an absolute
// spot worked out from its place in the fan (closer together when the
// hand is big, so cards overlap). When a card leaves, the rest slide to
// their new spots (CSS transition) instead of the row jumping, and a
// card let go without being played glides back from where it was dropped.
// ===================================================================

import { StatusRow } from '../StatusRow';
import { Tooltip } from '../../ui/Tooltip';
import { STATUS_INFO } from '../../../../shared/game/describe';
import { useLayoutEffect, useRef } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import {
  CARD_FLIGHT_MS,
  DRAW_STAGGER_MS,
  HAND_ATTR,
  PILE_ATTR,
} from '../../../hooks/useCardFlights';
import { useDrawOrder } from '../../../hooks/useDrawOrder';
import { prefersReducedMotion } from '../../../lib/motion';
import { buffLockedByMalaise, canPlayCard, fatigueAt, canPlayCardOnSelf, positionForCard, soleTargetFor } from '../../../../shared/game/combat';
import { cardImbuesAt } from '../../../../shared/game/imbue';
import { canMove, movementBlockReason, movementCost, offeredMovement } from '../../../../shared/game/movement';
import type { CombatState } from '../../../../shared/game/types';
import {
  MOVEMENT_SLOT,
  HAND_SLOT_ATTR,
  HELD_CARD_ATTR,
  type CardBox,
} from '../../../hooks/useCardDrag';
import { useHandIds } from '../../../hooks/useHandIds';
import { usesSpentOn } from '../../../../shared/game/uses';
import { CardView, MovementCard } from '../CardView';
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
const DROP_PER_CARD = 1;
/** The held card is raised out of the fan, upright and enlarged. */
const HELD_TRANSFORM = 'translateY(-34px) scale(1.4)';
/** Widest gap between card centres; tighter when the hand is big. */
const SLOT_WIDTH = 'var(--table-slot-width, 4.25rem)';
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
  const drop = Math.min(5, Math.round(Math.abs(offset) * DROP_PER_CARD));
  const fan = isHeld ? HELD_TRANSFORM : `translateY(${drop}px)`;
  return `translateX(-50%) ${fan}`;
};

/**
 * A slot's `left`: the fan's middle plus its offset in slot widths,
 * snapped to a whole pixel so the card's text sits on the pixel grid.
 */
const slotLeft = (offset: number): string =>
  `round(calc(50% + ${offset} * var(--slot)), 1px)`;

/** A drawn card leaves the draw pile this small, and grows into place. */
const DRAWN_START_SCALE = 0.3;
/** A gentle ease-out, so a drawn card lands softly in its slot. */
const DRAW_EASING = 'cubic-bezier(0.2, 0.75, 0.3, 1)';

/**
 * Flies a just-drawn slot in from the draw pile: it starts small over
 * the pile and grows into its fan pose, `delayMs` after the draw. It
 * waits hidden over the pile until then (fill: backwards). Imperative:
 * a one-off animation started when the card mounts.
 */
const flyInFromDrawPile = (
  slot: HTMLElement,
  transform: string,
  delayMs: number
) => {
  const pile = document.querySelector(`[${PILE_ATTR}="draw"]`);
  const hand = slot.offsetParent;
  if (!pile || !hand || prefersReducedMotion()) return;
  const pileBox = pile.getBoundingClientRect();
  const handBox = hand.getBoundingClientRect();
  // From the slot's own centre (layout box, before its fan pose).
  const dx =
    pileBox.left + pileBox.width / 2 - (handBox.left + slot.offsetLeft);
  const dy =
    pileBox.top +
    pileBox.height / 2 -
    (handBox.top + slot.offsetTop + slot.offsetHeight / 2);
  const start = `translateX(-50%) translate(${dx}px, ${dy}px) scale(${DRAWN_START_SCALE})`;
  slot.animate(
    [
      { transform: start, opacity: 0 },
      { opacity: 1, offset: 0.25 },
      { transform, opacity: 1 },
    ],
    {
      duration: CARD_FLIGHT_MS,
      delay: delayMs,
      easing: DRAW_EASING,
      fill: 'backwards',
    }
  );
};

// --- SUBCOMPONENTS ---
type HandSlotProps = {
  /** Its card's place in the hand (shots launch from the played slot). */
  handIndex: number;
  offset: number;
  isHeld: boolean;
  isLifted: boolean;
  liftedBox: CardBox | null;
  /** For a card just drawn: how long after the draw it flies in (ms). */
  drawDelayMs: number | null;
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
  drawDelayMs,
  onPress,
  children,
}: HandSlotProps) => {
  const slotRef = useRef<HTMLDivElement>(null);
  const lastBoxRef = useRef<CardBox | null>(null);
  const wasLiftedRef = useRef(false);
  // While its card is lifted the slot stays in the fan pose (never the
  // raised "held" pose), so letting go starts no second transition.
  const transform = slotTransform(offset, isHeld && !isLifted);

  // DRAW: a just-drawn card flies in from the draw pile (mount only).
  const drawDelayRef = useRef(drawDelayMs);
  const mountTransformRef = useRef(transform);
  useLayoutEffect(() => {
    const delayMs = drawDelayRef.current;
    if (slotRef.current && delayMs !== null)
      flyInFromDrawPile(slotRef.current, mountTransformRef.current, delayMs);
  }, []);

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
      {...(handIndex >= 0 ? { [HAND_SLOT_ATTR]: handIndex } : {})}
      {...(isHeld ? { [HELD_CARD_ATTR]: true } : {})}
    >
      {children}
    </div>
  );
};

/** A drawn card's fly-in delay: one stagger step per card before it. */
const drawDelayOf = (order: number | undefined): number | null =>
  order === undefined ? null : order * DRAW_STAGGER_MS;

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
  const drawOrder = useDrawOrder(keys);
  const move = offeredMovement(combat);
  const count = combat.hand.length + (move ? 1 : 0);
  const middle = (count - 1) / 2;
  // --slot: the gap between card centres, tighter when the hand is big.
  const slotWidth = `min(${SLOT_WIDTH}, calc((100% - var(--table-card-width, 68px) * 1.4 - 8px) / ${Math.max(count - 1, 1)}))`;
  return (
    <div
      className="relative z-20 h-32 shrink-0"
      style={{ ['--slot' as string]: slotWidth }}
      {...{ [HAND_ATTR]: true }}
    >
      <aside aria-label="Guard and hand bonuses" className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--table-card-height)+8px)] flex flex-col items-center">
        <StatusRow combatant={combat.player} group="hand" timedBuffs={combat.timedBuffs} />
        {combat.player.guard > 0 && (
          <Tooltip opensOn="click" content={{ title: STATUS_INFO.guard.label, description: STATUS_INFO.guard.description }}>
            <button type="button" className="hand-guard" aria-label={`Guard: ${combat.player.guard}`}>
              <span>{combat.player.guard}</span>
            </button>
          </Tooltip>
        )}
      </aside>
      {combat.hand.map((cardId, index) => {
        const isLifted = index === draggedIndex;
        const malaiseLocked = imbueSlots.length === 0 && buffLockedByMalaise(combat, cardId);
        return (
          <HandSlot
            key={keys[index]}
            handIndex={index}
            offset={index - middle}
            isHeld={index === heldIndex}
            isLifted={isLifted}
            liftedBox={isLifted ? draggedBox : null}
            drawDelayMs={drawDelayOf(drawOrder.get(keys[index] ?? ''))}
            onPress={(event) => onPressCard(index, event)}
          >
            <CardView
              cardId={cardId}
              fatigue={fatigueAt(combat, index)}
              killsThisTurn={combat.killsThisTurn ?? 0} followUpReady={combat.followUpReady}
              attacker={positionForCard(combat, cardId, index).player}
              target={soleTargetFor(combat, cardId, index)}
              size="fan"
              isSelected={index === heldIndex}
              imbues={cardImbuesAt(combat, index)}
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
                imbueSlots.length === 0 && !canPlayCard(combat, index) && !canPlayCardOnSelf(combat, index)
              }
              disabledReason={malaiseLocked ? 'Malaise: Buff cards are locked' : undefined}
              onClick={() => onTapCard(index)}
            />
          </HandSlot>
        );
      })}
      {move && (
        <HandSlot handIndex={MOVEMENT_SLOT} offset={middle} isHeld={false}
          isLifted={draggedIndex === MOVEMENT_SLOT} liftedBox={draggedIndex === MOVEMENT_SLOT ? draggedBox : null}
          drawDelayMs={null} onPress={event => { if (canMove(combat, move) && !imbueSlots.length) onPressCard(MOVEMENT_SLOT, event); }}>
          <MovementCard move={move} cost={movementCost(combat, move)}
            disabled={!canMove(combat, move) || imbueSlots.length > 0}
            blockReason={movementBlockReason(combat, move)} onPlay={() => onTapCard(MOVEMENT_SLOT)} />
        </HandSlot>
      )}
    </div>
  );
};
