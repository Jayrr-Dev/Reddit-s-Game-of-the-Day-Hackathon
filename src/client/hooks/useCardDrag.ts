// ===================================================================
// USE CARD DRAG
// Press and drag a card out of the hand to aim it:
//   1. Pointer down on a card records the card's box and the grab point.
//   2. Once the pointer moves past DRAG_START_PX it becomes a drag;
//      a shorter press stays a plain tap (handled by the card's click).
//   3. While dragging, the CARD follows the finger at CARD_FOLLOW speed
//      (it stays low, near the hand) and the AIM TIP runs ahead of the
//      finger (AIM_GAIN times the drag). So the arrow aims on its own:
//      a short drag reaches the front row, a longer one the back row.
//   4. Pointer up reports the drop (card, heroes under the tip, and
//      whether the tip is on the battlefield) and the drag ends.
// The cards themselves use `touch-action: none`, so only a press that
// starts on a card is captured; the rest of the post still scrolls.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// --- TYPES ---
export type Point = { x: number; y: number };

/** A card's box in viewport pixels (centre and size). */
export type CardBox = { center: Point; width: number; height: number };

/** A drag in progress, in viewport pixels. */
export type CardDrag = {
  handIndex: number;
  /** Where the dragged card is drawn now. */
  card: CardBox;
  /** Where the arrow points (runs ahead of the finger). */
  tip: Point;
  /** Heroes under the tip, nearest first. */
  overUids: number[];
  /** True when the tip is over the battlefield. */
  isOverField: boolean;
};

/** Where a drag ended. */
export type CardDrop = Pick<CardDrag, 'handIndex' | 'overUids' | 'isOverField'>;

/** A press that has not moved far enough to count as a drag yet. */
type Press = {
  handIndex: number;
  card: CardBox;
  grab: Point;
  pointerId: number;
};

// --- CONSTANTS ---
/** How far (px) a press must move before it turns into a drag. */
const DRAG_START_PX = 10;
/** The card travels this share of the finger's path (stays low). */
const CARD_FOLLOW = 0.5;
/** The aim tip travels this many times as far as the finger. */
const AIM_GAIN = 1.8;
/** Keep the tip this far inside the battlefield's top edge (px). */
const TIP_INSET_PX = 6;
/** Data attributes that mark drop targets in the DOM. */
export const HERO_UID_ATTR = 'data-hero-uid';
export const FIELD_ATTR = 'data-battlefield';

// --- GEOMETRY HELPERS ---
/** Point a + (b - a) * scale. */
const extend = (a: Point, b: Point, scale: number): Point => ({
  x: a.x + (b.x - a.x) * scale,
  y: a.y + (b.y - a.y) * scale,
});

/** Distance from a point to the centre of an element's box. */
const distanceToCenter = (point: Point, element: Element): number => {
  const rect = element.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.hypot(point.x - cx, point.y - cy);
};

/** Keeps the tip inside the window and below the field's top edge. */
const clampTip = (tip: Point): Point => {
  const field = document.querySelector(`[${FIELD_ATTR}]`);
  const top = field ? field.getBoundingClientRect().top + TIP_INSET_PX : 0;
  return {
    x: Math.min(Math.max(tip.x, 0), window.innerWidth - 1),
    y: Math.min(Math.max(tip.y, top), window.innerHeight - 1),
  };
};

// --- DOM PROBE ---
/**
 * Reads what lies under the tip. Front and back heroes overlap, so we
 * collect every hero under it and sort them nearest-centre first: aim
 * higher (drag further) and the back-row hero wins.
 */
const probe = (tip: Point): Pick<CardDrag, 'overUids' | 'isOverField'> => {
  const elements = document.elementsFromPoint(tip.x, tip.y);
  const heroes = elements.filter((element) =>
    element.hasAttribute(HERO_UID_ATTR)
  );
  const overUids = heroes
    .map((element) => ({
      uid: Number(element.getAttribute(HERO_UID_ATTR)),
      distance: distanceToCenter(tip, element),
    }))
    .sort((a, b) => a.distance - b.distance)
    .map((hit) => hit.uid);
  return {
    overUids,
    isOverField: elements.some((element) => element.hasAttribute(FIELD_ATTR)),
  };
};

/** True once the pointer has travelled far enough to count as a drag. */
const isPastThreshold = (from: Point, to: Point): boolean =>
  Math.hypot(to.x - from.x, to.y - from.y) >= DRAG_START_PX;

/** The drag state for a pointer position. */
const dragAt = (press: Press, pointer: Point): CardDrag => {
  const shift = { x: pointer.x - press.grab.x, y: pointer.y - press.grab.y };
  const card = {
    ...press.card,
    center: {
      x: press.card.center.x + shift.x * CARD_FOLLOW,
      y: press.card.center.y + shift.y * CARD_FOLLOW,
    },
  };
  const tip = clampTip(extend(press.grab, pointer, AIM_GAIN));
  return { handIndex: press.handIndex, card, tip, ...probe(tip) };
};

// --- HOOK ---
/**
 * Pointer handling for dragging cards. Returns the live drag (for the
 * card and arrow), a pointer-down handler for each card, and `wasDrag()` so the
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
      const pointer = { x: event.clientX, y: event.clientY };
      if (!current && !isPastThreshold(press.grab, pointer)) return;
      if (!current) {
        didDragRef.current = true;
        callbacksRef.current.onDragStart(press.handIndex);
      }
      current = dragAt(press, pointer);
      setDrag(current);
    };

    /** Ends the press; a real drag reports where it was dropped. */
    const handleEnd = (event: PointerEvent) => {
      if (event.pointerId !== press.pointerId) return;
      if (current && event.type === 'pointerup') {
        const { handIndex, overUids, isOverField } = current;
        callbacksRef.current.onDrop({ handIndex, overUids, isOverField });
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

  /** Pointer down on a card: remember its box and the grab point. */
  const pressCard = (
    handIndex: number,
    event: ReactPointerEvent<HTMLElement>
  ) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    didDragRef.current = false;
    setPress({
      handIndex,
      card: {
        center: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
        width: rect.width,
        height: rect.height,
      },
      grab: { x: event.clientX, y: event.clientY },
      pointerId: event.pointerId,
    });
  };

  /** True when the last press on a card turned into a drag. */
  const wasDrag = () => didDragRef.current;

  return { drag, pressCard, wasDrag } as const;
};
