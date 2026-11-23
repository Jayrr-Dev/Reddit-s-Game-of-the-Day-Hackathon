// ===================================================================
// USE CARD DRAG
// Press and drag a card out of the hand to aim it, like a sling:
//   1. Pointer down on a card records where the drag started.
//   2. Once the pointer moves past DRAG_START_PX it becomes a drag;
//      a shorter press stays a plain tap (handled by the card's click).
//   3. While dragging we track the pointer and the hero under it.
//   4. Pointer up reports the drop (card, hero under the pointer, and
//      whether it landed on the battlefield) and the drag ends.
// The cards themselves use `touch-action: none`, so only a press that
// starts on a card is captured; the rest of the post still scrolls.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// --- TYPES ---
export type Point = { x: number; y: number };

/** A drag in progress, in viewport pixels. */
export type CardDrag = {
  handIndex: number;
  from: Point;
  to: Point;
  /** The hero under the pointer, if any. */
  overUid: number | null;
  /** True when the pointer is over the battlefield. */
  isOverField: boolean;
};

/** Where a drag ended. */
export type CardDrop = Pick<CardDrag, 'handIndex' | 'overUid' | 'isOverField'>;

/** A press that has not moved far enough to count as a drag yet. */
type Press = { handIndex: number; from: Point; pointerId: number };

// --- CONSTANTS ---
/** How far (px) a press must move before it turns into a drag. */
const DRAG_START_PX = 10;
/** Data attributes that mark drop targets in the DOM. */
export const HERO_UID_ATTR = 'data-hero-uid';
export const FIELD_ATTR = 'data-battlefield';

// --- HELPERS ---
/** Reads what lies under a viewport point: a hero uid and the field. */
const probe = (point: Point): Pick<CardDrag, 'overUid' | 'isOverField'> => {
  const element = document.elementFromPoint(point.x, point.y);
  const heroUid = element
    ?.closest(`[${HERO_UID_ATTR}]`)
    ?.getAttribute(HERO_UID_ATTR);
  return {
    overUid: heroUid == null ? null : Number(heroUid),
    isOverField: element?.closest(`[${FIELD_ATTR}]`) != null,
  };
};

/** True once the pointer has travelled far enough to count as a drag. */
const isPastThreshold = (from: Point, to: Point): boolean =>
  Math.hypot(to.x - from.x, to.y - from.y) >= DRAG_START_PX;

// --- HOOK ---
/**
 * Pointer handling for dragging cards. Returns the live drag (for the
 * arrow), a pointer-down handler for each card, and `wasDrag()` so the
 * card's click can ignore the click a browser fires after a drag.
 */
export const useCardDrag = (
  onDragStart: (handIndex: number) => void,
  onDrop: (drop: CardDrop) => void
) => {
  const [drag, setDrag] = useState<CardDrag | null>(null);
  const [press, setPress] = useState<Press | null>(null);
  const didDragRef = useRef(false);

  // Latest callbacks, so the window listeners below never go stale.
  const callbacksRef = useRef({ onDragStart, onDrop });
  useEffect(() => {
    callbacksRef.current = { onDragStart, onDrop };
  });

  // WINDOW LISTENERS WHILE A CARD IS PRESSED
  // Imperative on purpose: the pointer can leave the card, so we listen
  // on the window and stop as soon as the press ends.
  useEffect(() => {
    if (!press) return;
    let current: CardDrag | null = null;

    /** Follows the pointer, starting the drag once past the threshold. */
    const handleMove = (event: PointerEvent) => {
      if (event.pointerId !== press.pointerId) return;
      const to = { x: event.clientX, y: event.clientY };
      if (!current && !isPastThreshold(press.from, to)) return;
      if (!current) {
        didDragRef.current = true;
        callbacksRef.current.onDragStart(press.handIndex);
      }
      current = {
        handIndex: press.handIndex,
        from: press.from,
        to,
        ...probe(to),
      };
      setDrag(current);
    };

    /** Ends the press; a real drag reports where it was dropped. */
    const handleEnd = (event: PointerEvent) => {
      if (event.pointerId !== press.pointerId) return;
      if (current && event.type === 'pointerup') {
        const { handIndex, overUid, isOverField } = current;
        callbacksRef.current.onDrop({ handIndex, overUid, isOverField });
      }
      setDrag(null);
      setPress(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [press]);

  /** Pointer down on a card: remember it, the arrow starts at its top. */
  const pressCard = (
    handIndex: number,
    event: ReactPointerEvent<HTMLElement>
  ) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    didDragRef.current = false;
    setPress({
      handIndex,
      from: { x: rect.left + rect.width / 2, y: rect.top },
      pointerId: event.pointerId,
    });
  };

  /** True when the last press on a card turned into a drag. */
  const wasDrag = () => didDragRef.current;

  return { drag, pressCard, wasDrag } as const;
};
