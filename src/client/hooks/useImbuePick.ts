// ===================================================================
// USE IMBUE PICK
// Playing an Imbue card means choosing another card in hand for it:
//   1. Tap (or drag and let go of) the Imbue card: it rises and every
//      card it may imbue glows teal.
//   2. An arrow runs from it to the card under the pointer (live, gold,
//      over a card it may imbue).
//   3. Tap a glowing card to imbue it; that plays the Imbue card.
// Tapping anywhere that is not a card in hand, tapping the Imbue card
// again, or tapping a card it can't imbue lets it go; nothing is spent.
// ===================================================================

import { useCallback, useEffect, useState } from 'react';
import { canPlayCard } from '../../shared/game/combat';
import { imbueEffectOf, imbueSlotsFor } from '../../shared/game/imbue';
import type { RunAction } from '../../shared/game/run';
import type { CombatState } from '../../shared/game/types';
import { HAND_SLOT_ATTR, HELD_CARD_ATTR, type Point } from './useCardDrag';

// --- TYPES ---
/** The arrow from the Imbue card to the card under the pointer. */
export type ImbueArrow = { from: Point; to: Point; isLive: boolean };

// --- HELPERS ---
/** The hand slot an element sits in, or null outside the hand. */
const slotOf = (target: EventTarget | null): number | null => {
  const slot =
    target instanceof Element ? target.closest(`[${HAND_SLOT_ATTR}]`) : null;
  return slot ? Number(slot.getAttribute(HAND_SLOT_ATTR)) : null;
};

/** The top middle of an element's box on screen. */
const topOf = (element: Element | null): Point | null => {
  const rect = element?.getBoundingClientRect();
  return rect ? { x: rect.left + rect.width / 2, y: rect.top } : null;
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
  const [arrow, setArrow] = useState<ImbueArrow | null>(null);
  const imbuingIndex =
    chosenIndex !== null && isImbueReady(combat, chosenIndex)
      ? chosenIndex
      : null;
  const isImbuing = imbuingIndex !== null;
  const slots = isImbuing ? imbueSlotsFor(combat, imbuingIndex) : [];

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
    if (imbuingIndex === null || !slots.includes(slot)) return;
    onAction({
      type: 'playCard',
      handIndex: imbuingIndex,
      targetUid: 0,
      imbueIndex: slot,
    });
  };

  // POINTER: while imbuing, the arrow follows the card under the
  // pointer, and a press outside the hand lets go. Imperative on
  // purpose: these are document-wide pointer events.
  const slotsKey = slots.join(',');
  useEffect(() => {
    if (imbuingIndex === null) return;
    const allowed = slotsKey.split(',').map(Number);
    const onMove = (event: PointerEvent) => {
      const slot = slotOf(event.target);
      const from = topOf(document.querySelector(`[${HELD_CARD_ATTR}]`));
      const to = topOf(
        slot === null
          ? null
          : document.querySelector(`[${HAND_SLOT_ATTR}="${slot}"]`)
      );
      const isOther = slot !== null && slot !== imbuingIndex;
      setArrow(
        from && to && isOther
          ? { from, to, isLive: allowed.includes(slot) }
          : null
      );
    };
    const onDown = (event: PointerEvent) => {
      if (slotOf(event.target) === null) cancel();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [imbuingIndex, slotsKey, cancel]);

  return {
    imbuingIndex,
    isImbuing,
    slots,
    arrow: isImbuing ? arrow : null,
    begin,
    pick,
    cancel,
  } as const;
};
