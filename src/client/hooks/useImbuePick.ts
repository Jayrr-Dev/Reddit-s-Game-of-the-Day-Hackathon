// ===================================================================
// USE IMBUE PICK
// Playing an Imbue card means choosing another card in hand for it:
//   1. Tap (or drag and let go of) the Imbue card: it rises and every
//      card it may imbue glows teal.
//   2. An arrow lobs from it, up over the hand and down onto the middle
//      of the card under the pointer (gold over a card it may imbue).
//      The card it would imbue pulses.
//   3. Tap a glowing card to imbue it; that plays the Imbue card.
// Tapping anywhere that is not a card in hand, tapping the Imbue card
// again, or tapping a card it can't imbue lets it go; nothing is spent.
// DRAG: pressing and dragging the Imbue card works the same way at once:
// the arrow follows the card under the finger, and letting go over a
// glowing card imbues it; anywhere else puts the Imbue card back.
// ===================================================================

import { useCallback, useEffect, useState } from 'react';
import { canPlayCard } from '../../shared/game/combat';
import { imbueEffectOf, imbueSlotsFor } from '../../shared/game/imbue';
import type { RunAction } from '../../shared/game/run';
import type { CombatState } from '../../shared/game/types';
import {
  DRAGGED_CARD_ATTR,
  HAND_SLOT_ATTR,
  HELD_CARD_ATTR,
  type Point,
} from './useCardDrag';

// --- TYPES ---
/** The arrow from the Imbue card to the card under the pointer. */
export type ImbueArrow = {
  from: Point;
  to: Point;
  /** True over a card it may imbue. */
  isLive: boolean;
  /** The hand slot the arrow points at. */
  slot: number;
};

// --- HELPERS ---
/** The hand slot an element sits in, or null outside the hand. */
const slotOf = (target: EventTarget | null): number | null => {
  const slot =
    target instanceof Element ? target.closest(`[${HAND_SLOT_ATTR}]`) : null;
  return slot ? Number(slot.getAttribute(HAND_SLOT_ATTR)) : null;
};

/**
 * The hand slot under a pointer, other than `ownSlot`. Read from the
 * point, not the event's target: while a card is dragged it holds the
 * pointer, so every event targets the dragged card.
 */
const slotUnder = (event: PointerEvent, ownSlot: number): number | null => {
  const slots = document
    .elementsFromPoint(event.clientX, event.clientY)
    .map(slotOf)
    .filter((slot): slot is number => slot !== null && slot !== ownSlot);
  return slots[0] ?? null;
};

/** The top middle of an element's box on screen. */
const topOf = (element: Element | null): Point | null => {
  const rect = element?.getBoundingClientRect();
  return rect ? { x: rect.left + rect.width / 2, y: rect.top } : null;
};

/** The centre of an element's box on screen. */
const centreOf = (element: Element | null): Point | null => {
  const rect = element?.getBoundingClientRect();
  return rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : null;
};

/** True when the card in `handIndex` is an Imbue card that can be played. */
export const isImbueReady = (combat: CombatState, handIndex: number) => {
  const cardId = combat.hand[handIndex];
  return (
    cardId !== undefined &&
    imbueEffectOf(cardId) !== undefined &&
    canPlayCard(combat, handIndex)
  );
};

// --- HOOK ---
/** The Imbue card being aimed, the cards it may imbue, and the arrow. */
export const useImbuePick = (
  combat: CombatState,
  onAction: (action: RunAction) => void
) => {
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [arrow, setArrow] = useState<ImbueArrow | null>(null);
  const imbuingIndex =
    chosenIndex !== null && isImbueReady(combat, chosenIndex)
      ? chosenIndex
      : null;
  const isImbuing = imbuingIndex !== null;
  // The Imbue card aiming right now: raised by a tap, or being dragged.
  const aimingIndex =
    imbuingIndex ??
    (draggedIndex !== null && isImbueReady(combat, draggedIndex)
      ? draggedIndex
      : null);
  const isDragging = imbuingIndex === null && aimingIndex !== null;
  const slots = aimingIndex === null ? [] : imbueSlotsFor(combat, aimingIndex);

  /** Lets the Imbue card go. */
  const cancel = useCallback(() => {
    setChosenIndex(null);
    setArrow(null);
  }, []);

  /** Raises the Imbue card in `handIndex` to choose what it imbues. */
  const begin = (handIndex: number) => {
    setArrow(null);
    setChosenIndex(handIndex);
  };

  /** Imbues the card in `slot` (playing the Imbue card), else lets go. */
  const pick = (slot: number) => {
    cancel();
    setDraggedIndex(null);
    if (aimingIndex === null || !slots.includes(slot)) return;
    onAction({
      type: 'playCard',
      handIndex: aimingIndex,
      targetUid: 0,
      imbueIndex: slot,
    });
  };

  /** A dragged Imbue card let go: imbue the glowing card under it, if any. */
  const drop = () => pick(arrow?.isLive ? arrow.slot : -1);

  // POINTER: while aiming, the arrow follows the card under the
  // pointer (from the raised card, or the dragged one), and a press
  // outside the hand lets a raised card go. Imperative on purpose:
  // these are document-wide pointer events.
  const slotsKey = slots.join(',');
  useEffect(() => {
    if (aimingIndex === null) return;
    const allowed = slotsKey.split(',').map(Number);
    const source = isDragging ? DRAGGED_CARD_ATTR : HELD_CARD_ATTR;
    const onMove = (event: PointerEvent) => {
      const slot = slotUnder(event, aimingIndex);
      const from = topOf(document.querySelector(`[${source}]`));
      const to = centreOf(
        slot === null
          ? null
          : document.querySelector(`[${HAND_SLOT_ATTR}="${slot}"]`)
      );
      setArrow(
        from && to && slot !== null
          ? { from, to, isLive: allowed.includes(slot), slot }
          : null
      );
    };
    const onDown = (event: PointerEvent) => {
      if (!isDragging && slotOf(event.target) === null) cancel();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [aimingIndex, isDragging, slotsKey, cancel]);

  return {
    imbuingIndex,
    isImbuing,
    slots,
    arrow: aimingIndex !== null ? arrow : null,
    begin,
    pick,
    drop,
    cancel,
    /** Follows the card being dragged (null when none is). */
    followDrag: setDraggedIndex,
  } as const;
};
