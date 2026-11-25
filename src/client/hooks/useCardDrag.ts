// ===================================================================
// USE CARD DRAG
// Press and drag a card out of the hand to aim it:
//   1. Pointer down on a card records the card's box and the grab point.
//   2. Once the pointer moves past DRAG_START_PX it becomes a drag;
//      a shorter press stays a plain tap (handled by the card's click).
//      Any upward move lifts the tip onto the battlefield at once, so the
//      arrow locks onto the nearest target the moment the finger goes up.
//   3. While dragging, the CARD follows the finger at CARD_FOLLOW speed
//      (it stays low, near the hand) and the AIM TIP runs ahead of the
//      finger (AIM_GAIN times the drag). So the arrow aims on its own:
//      a short drag reaches the front row, a longer one the back row.
//   4. Dragging back DOWN cancels the aim at once: the lock goes and the
//      arrow shrinks and fades toward the card the further it is pulled,
//      so letting go returns the card to the hand. A glowing (self) card instead fades as it comes down,
//      since its glow and play follow height. Moving up again re-aims.
//   5. Pointer up reports the drop (card, heroes under the tip, and
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
  /** Every hero on the field, nearest to the tip first (for snapping). */
  nearHeroes: HeroAnchor[];
  /** True when the tip is over the battlefield. */
  isOverField: boolean;
  /** Portrait center only while the actual pointer is over it. */
  selfPoint: Point | null;
  /** How far (px) the finger has moved up from where it pressed. */
  lift: number;
  /**
   * 0 while aiming; above 0 once the finger pulls back down, growing to
   * 1 as it goes further (the arrow shrinks and fades by this much).
   */
  pullBack: number;
};

/** A hero and the point the arrow snaps to when aimed at it. */
export type HeroAnchor = { uid: number; point: Point };

/** Where a drag ended. */
export type CardDrop = Pick<
  CardDrag,
  'handIndex' | 'nearHeroes' | 'isOverField' | 'selfPoint' | 'lift' | 'pullBack'
>;

/** A press that has not moved far enough to count as a drag yet. */
type Press = {
  handIndex: number;
  /** The card's slot; it captures the pointer once the drag starts. */
  element: HTMLElement;
  card: CardBox;
  grab: Point;
  pointerId: number;
};

// --- CONSTANTS ---
/** How far (px) a press must move before it turns into a drag. */
const DRAG_START_PX = 4;
/** Pulling down this far (px) from the highest point cancels the aim. */
const PULL_BACK_PX = 8;
/** Pulling down this far (px) below the peak fully retracts the arrow. */
const PULL_FADE_PX = 60;
/** Moving up this far (px) after a pull-back re-aims. */
const REAIM_PX = 4;
/** The card travels this share of the finger's path (stays low). */
const CARD_FOLLOW = 0.5;
/** The aim tip travels this many times as far as the finger. */
const AIM_GAIN = 2.5;
/** Sideways the tip moves less, so it doesn't fly off the screen edge. */
const AIM_GAIN_SIDEWAYS = 1.6;
/** Where on a hero's drawing the arrow lands (share of its height). */
const ANCHOR_HEIGHT_SHARE = 0.5;
/** Keep the tip this far inside the battlefield's top edge (px). */
const TIP_INSET_PX = 6;
/** Data attributes that mark drop targets in the DOM. */
export const HERO_UID_ATTR = 'data-hero-uid';
export const MOVEMENT_SLOT = -1;
export const FIELD_ATTR = 'data-battlefield';
/** Marks the box around a hero's drawing (the arrow lands at its middle). */
export const HERO_ANCHOR_ATTR = 'data-hero-anchor';
/** Marks the raised (held) card in the hand. */
export const HELD_CARD_ATTR = 'data-held-card';
/** Marks each card's slot in the hand, valued by its hand index. */
export const HAND_SLOT_ATTR = 'data-hand-slot';
/** Marks the card being dragged (it follows the pointer). */
export const DRAGGED_CARD_ATTR = 'data-dragged-card';
/** Marks the villain's portrait (where hero shots fly to). */
export const VILLAIN_ANCHOR_ATTR = 'data-villain-anchor';
/** Marks a hero's row ('front' or 'back'), for hit-testing. */
export const HERO_ROW_ATTR = 'data-hero-row';

// --- GEOMETRY HELPERS ---
/** Point a + (b - a) scaled per axis. */
const extend = (a: Point, b: Point, scaleX: number, scaleY: number): Point => ({
  x: a.x + (b.x - a.x) * scaleX,
  y: a.y + (b.y - a.y) * scaleY,
});

/** The battlefield's box, if it is on screen. */
const fieldRect = (): DOMRect | undefined =>
  document.querySelector(`[${FIELD_ATTR}]`)?.getBoundingClientRect();

/** Keeps the tip inside the window and below the field's top edge. */
const clampTip = (tip: Point, field: DOMRect | undefined): Point => {
  const top = (field?.top ?? 0) + TIP_INSET_PX;
  return {
    x: Math.min(Math.max(tip.x, 0), window.innerWidth - 1),
    y: Math.min(Math.max(tip.y, top), window.innerHeight - 1),
  };
};

/**
 * Once the finger has moved up at all, the tip is at least on the
 * battlefield's bottom edge, so even a tiny flick upward counts as aiming
 * (and snaps to the nearest hero). Moving down leaves the tip alone.
 */
const liftTip = (
  tip: Point,
  isMovingUp: boolean,
  field: DOMRect | undefined
): Point => {
  if (!isMovingUp || !field) return tip;
  return { ...tip, y: Math.min(tip.y, field.bottom - TIP_INSET_PX) };
};

/** True when a point lies inside a box. */
const isInside = (point: Point, rect: DOMRect | undefined): boolean =>
  rect !== undefined &&
  point.x >= rect.left &&
  point.x <= rect.right &&
  point.y >= rect.top &&
  point.y <= rect.bottom;

// --- DOM PROBE ---
/** One hero as the probe sees it: its anchor, drawing box and row. */
type ProbedHero = HeroAnchor & { box: DOMRect; isFront: boolean };

/** Where the arrow lands on one hero: the middle of its drawing. */
const probeHero = (element: Element): ProbedHero => {
  const body = element.querySelector(`[${HERO_ANCHOR_ATTR}]`) ?? element;
  const box = body.getBoundingClientRect();
  return {
    uid: Number(element.getAttribute(HERO_UID_ATTR)),
    point: {
      x: box.left + box.width / 2,
      y: box.top + box.height * ANCHOR_HEIGHT_SHARE,
    },
    box,
    isFront: element.getAttribute(HERO_ROW_ATTR) === 'front',
  };
};

/** How much height counts against a hero within its row (vs width). */
const ROW_HEIGHT_WEIGHT = 0.35;

/**
 * Sorts heroes best aimed-at first. Height picks the ROW: with the tip
 * below the top of the front row's drawings (their heads) the front row
 * comes first, above it the back row does, so "aim higher to reach the
 * back" holds and both rows get a wide band. Within a row, sideways
 * distance picks the hero. (Plain nearest-anchor left the front hero a
 * thin band when a back hero stood right behind it.)
 */
const rankHeroes = (heroes: ProbedHero[], tip: Point): ProbedHero[] => {
  const frontTops = heroes.filter((hero) => hero.isFront).map((h) => h.box.top);
  const isAimingFront = tip.y >= Math.min(...frontTops, Infinity);
  /** Lower is better: wrong-row heroes after right-row ones. */
  const rank = (hero: ProbedHero): number => {
    const tier = hero.isFront === isAimingFront ? 0 : 1_000_000;
    const dx = Math.abs(hero.point.x - tip.x);
    const dy = Math.abs(hero.point.y - tip.y) * ROW_HEIGHT_WEIGHT;
    return tier + dx + dy;
  };
  return [...heroes].sort((a, b) => rank(a) - rank(b));
};

/** Every hero, best aimed-at first (see rankHeroes), for snapping. */
const probe = (
  tip: Point,
  field: DOMRect | undefined
): Pick<CardDrag, 'nearHeroes' | 'isOverField'> => {
  const heroes = [...document.querySelectorAll(`[${HERO_UID_ATTR}]`)].map(
    probeHero
  );
  const nearHeroes = rankHeroes(heroes, tip).map(({ uid, point }) => ({
    uid,
    point,
  }));
  return { nearHeroes, isOverField: isInside(tip, field) };
};

/** True once the pointer has travelled far enough to count as a drag. */
const isPastThreshold = (from: Point, to: Point): boolean =>
  Math.hypot(to.x - from.x, to.y - from.y) >= DRAG_START_PX;

/**
 * Tracks whether the finger is pulling the card back down. `turnY` is
 * the highest point while aiming, or the lowest point while pulled
 * back, so each direction change is measured from where it turned.
 */
type PullTracker = { isPulledBack: boolean; turnY: number; peakY: number };

/** Updates the pull-back state for a new pointer height. */
const trackPull = (pull: PullTracker, y: number): PullTracker => {
  if (!pull.isPulledBack) {
    const peak = Math.min(pull.turnY, y);
    return y - peak >= PULL_BACK_PX
      ? { isPulledBack: true, turnY: y, peakY: peak }
      : { isPulledBack: false, turnY: peak, peakY: peak };
  }
  const low = Math.max(pull.turnY, y);
  return low - y >= REAIM_PX
    ? { isPulledBack: false, turnY: y, peakY: y }
    : { ...pull, turnY: low };
};

/** How far the pull-back has gone, 0 (aiming) to 1 (fully retracted). */
const pullBackOf = (pull: PullTracker, y: number): number =>
  pull.isPulledBack ? Math.min(1, (y - pull.peakY) / PULL_FADE_PX) : 0;

/** The drag state for a pointer position. */
const dragAt = (
  press: Press,
  pointer: Point,
  pullBack: number,
  lastAim: Pick<CardDrag, 'nearHeroes' | 'isOverField'> | null
): CardDrag => {
  const shift = { x: pointer.x - press.grab.x, y: pointer.y - press.grab.y };
  const card = {
    ...press.card,
    center: {
      x: press.card.center.x + shift.x * CARD_FOLLOW,
      y: press.card.center.y + shift.y * CARD_FOLLOW,
    },
  };
  const isMovingUp = shift.y < 0;
  const field = fieldRect();
  const tip = clampTip(
    liftTip(
      extend(press.grab, pointer, AIM_GAIN_SIDEWAYS, AIM_GAIN),
      isMovingUp,
      field
    ),
    field
  );
  // The glow follows height both ways, so a pull-back fades it smoothly.
  const lift = Math.max(0, -shift.y);
  // Pulling back keeps the last aim, so the arrow can shrink toward the
  // card from where it pointed (the drop is cancelled meanwhile).
  // (Only the aim fields are copied: lastAim is the whole previous drag.)
  const aim =
    pullBack > 0
      ? {
          nearHeroes: lastAim?.nearHeroes ?? [],
          isOverField: lastAim?.isOverField ?? false,
        }
      : probe(tip, field);
  const portrait = press.element.closest('.dueling-table')
    ?.querySelector(`[${VILLAIN_ANCHOR_ATTR}]`)?.getBoundingClientRect();
  // Use the pointer, not the accelerated and clamped aim tip. A normal
  // upward flick toward an enemy should never lock onto your portrait.
  const selfPoint = portrait && isInside(pointer, portrait)
    ? { x: portrait.left + portrait.width / 2, y: portrait.top + portrait.height / 2 }
    : null;
  return { handIndex: press.handIndex, card, tip, lift, pullBack, selfPoint, ...aim };
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
    // False once the press has ended; late events are then ignored, so
    // nothing can redraw the arrow after the finger has lifted.
    let isActive = true;
    let pull: PullTracker = {
      isPulledBack: false,
      turnY: press.grab.y,
      peakY: press.grab.y,
    };

    let started = false;
    let frame: number | null = null;
    let pointer = press.grab;

    /** Measure live targets and draw the latest position once per frame. */
    const draw = () => {
      frame = null;
      current = dragAt(press, pointer, pullBackOf(pull, pointer.y), current);
      setDrag(current);
    };

    /** Follows the pointer, starting the drag once past the threshold. */
    const handleMove = (event: PointerEvent) => {
      if (!isActive || event.pointerId !== press.pointerId) return;
      pointer = { x: event.clientX, y: event.clientY };
      pull = trackPull(pull, pointer.y);
      if (!started && !isPastThreshold(press.grab, pointer)) return;
      if (!started) {
        started = true;
        didDragRef.current = true;
        // Capture only once it is a real drag, so a tap still clicks.
        // Capture keeps the moves coming even if a host page (Reddit's
        // app webview) would rather scroll.
        press.element.setPointerCapture(press.pointerId);
        callbacksRef.current.onDragStart(press.handIndex);
      }
      if (frame === null) frame = requestAnimationFrame(draw);
    };

    /** Ends the press without playing: clears the drag and the press. */
    const letGo = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      isActive = false;
      current = null;
      setDrag(null);
      setPress(null);
    };

    /**
     * Ends the press. Only a pointerup drops the card; a cancel or the
     * window losing focus just lets go, so the arrow is never left on
     * screen. (Not lostpointercapture: taking capture from the browser's
     * own touch capture fires it mid-drag.)
     */
    const handleEnd = (event: Event) => {
      if (!isActive) return;
      if (event instanceof PointerEvent && event.pointerId !== press.pointerId)
        return;
      if (
        started &&
        event instanceof PointerEvent &&
        event.type === 'pointerup'
      ) {
        pointer = { x: event.clientX, y: event.clientY };
        pull = trackPull(pull, pointer.y);
        current = dragAt(press, pointer, pullBackOf(pull, pointer.y), current);
        const { handIndex, nearHeroes, isOverField, selfPoint, lift, pullBack } = current;
        callbacksRef.current.onDrop({
          handIndex,
          nearHeroes,
          isOverField,
          selfPoint,
          lift,
          pullBack,
        });
      }
      letGo();
    };

    /** While a card is held, the finger must not scroll the page. */
    const blockScroll = (event: TouchEvent) => {
      if (started) event.preventDefault();
    };

    const endEvents = ['pointerup', 'pointercancel', 'blur'];
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('touchmove', blockScroll, { passive: false });
    endEvents.forEach((name) => window.addEventListener(name, handleEnd));
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('touchmove', blockScroll);
      endEvents.forEach((name) => window.removeEventListener(name, handleEnd));
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
      element: event.currentTarget,
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

  /**
   * A press that will never drag (the caller skipped pressCard): forget
   * the last drag, so this press's click counts as a tap.
   */
  const pressWithoutDrag = () => {
    didDragRef.current = false;
  };

  // A drag only exists while its press does (belt and braces).
  return {
    drag: press ? drag : null,
    pressCard,
    pressWithoutDrag,
    wasDrag,
  } as const;
};
