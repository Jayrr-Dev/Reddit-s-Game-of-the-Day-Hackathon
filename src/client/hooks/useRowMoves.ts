// ===================================================================
// USE ROW MOVES
// Animates heroes that change rows. Each row is its own parallax layer,
// so a hero that changes rows is re-created in the other layer and
// would just blink there. This hook remembers where every hero's body
// was drawn and, when one turns up in a new row, plays it from its old
// spot to the new one (a FLIP animation):
//   ADVANCE  the front row fell and the back row steps up: the scene
//            lunges toward you and the heroes grow into the front row,
//            as if the villain marched closer.
//   PULL     one hero is dragged forward: a fast yank with a little
//            overshoot. (A push plays the same move in reverse.) Anime
//            style: the figure smears along its path, two fading
//            afterimages chase it, and motion lines streak out behind
//            it, all gone as it lands.
// ===================================================================

import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { HeroRow, HeroUnit } from '../../shared/game/types';
import { HERO_ANCHOR_ATTR, HERO_UID_ATTR } from './useCardDrag';

// --- TYPES ---
/** Where a hero's body was drawn: bottom-centre point and height. */
type BodySpot = { x: number; bottom: number; height: number };

type MoveKind = 'advance' | 'pull';

// --- CONSTANTS ---
/** Marks the row layers, so the advance lunge skips them. */
export const ROW_LAYER_ATTR = 'data-row-layer';

const MOVE_TIMING: Record<MoveKind, KeyframeAnimationOptions> = {
  advance: { duration: 750, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
  // The overshoot (1.35) makes the yank snap past and settle.
  pull: { duration: 420, easing: 'cubic-bezier(0.55, 0, 0.25, 1.35)' },
};

/**
 * The motion lines behind a pulled or pushed hero, each as [offset
 * across the travel (px), length (px), thickness (px)]: uneven, so
 * they read as hand-drawn speed streaks.
 */
const MOTION_LINES: readonly (readonly [number, number, number])[] = [
  [-42, 70, 4],
  [-22, 120, 5],
  [-2, 92, 4],
  [18, 140, 5],
  [38, 80, 4],
];
/** Space (px) between the hero's middle and the lines' near ends. */
const MOTION_LINE_GAP_PX = 30;
/** How long (ms) the lines outlast the move itself as they fade. */
const MOTION_LINE_LINGER_MS = 180;

/** How far the smeared figure stretches along / squashes across travel. */
const SMEAR_STRETCH = 1.22;
const SMEAR_SQUASH = 0.9;
/** The afterimages: how far (ms) each lags the hero, and how faint. */
const AFTERIMAGES: readonly { lagMs: number; opacity: number }[] = [
  { lagMs: 35, opacity: 0.45 },
  { lagMs: 70, opacity: 0.25 },
];

/** Wait (ms) after a death before the row steps up (most of the death). */
const MOVE_AFTER_DEATH_MS = 380;

/** How far the scenery swells while the villain advances. */
const ADVANCE_ZOOM = 1.12;

// --- HELPERS ---
/** The body (drawing) element of one hero, if it is on screen. */
const bodyOf = (field: HTMLElement, uid: number): HTMLElement | null =>
  field.querySelector<HTMLElement>(
    `[${HERO_UID_ATTR}="${uid}"] [${HERO_ANCHOR_ATTR}]`
  );

/** Measures a body's bottom-centre point and height. */
const spotOf = (body: HTMLElement): BodySpot => {
  const rect = body.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    bottom: rect.bottom,
    height: rect.height,
  };
};

/** Heroes now standing in a different row than last time. */
const movedHeroes = (
  heroes: readonly HeroUnit[],
  lastRows: ReadonlyMap<number, HeroRow>
): HeroUnit[] =>
  heroes.filter((unit) => {
    const lastRow = lastRows.get(unit.uid);
    return lastRow !== undefined && lastRow !== unit.row;
  });

/**
 * An advance is when nobody who stood in the front row is still there
 * and the back row has stepped up; anything else is a pull or push.
 */
const kindOfMove = (
  heroes: readonly HeroUnit[],
  lastRows: ReadonlyMap<number, HeroRow>
): MoveKind => {
  const lastFront = [...lastRows].filter(([, row]) => row === 'front');
  const isFrontGone = lastFront.every(
    ([uid]) => !heroes.some((unit) => unit.uid === uid && unit.row === 'front')
  );
  return isFrontGone ? 'advance' : 'pull';
};

/** Plays one body from its old spot to its new one (`to`, measured). */
const flyFrom = (
  body: HTMLElement,
  from: BodySpot,
  to: BodySpot,
  kind: MoveKind,
  delay: number
) => {
  if (to.height === 0) return;
  const dx = from.x - to.x;
  const dy = from.bottom - to.bottom;
  const scale = from.height / to.height;
  body.style.transformOrigin = 'bottom center';
  body.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      { transform: 'none' },
    ],
    // fill 'backwards' holds the old spot during the delay.
    { ...MOVE_TIMING[kind], delay, fill: 'backwards' }
  );
  if (kind !== 'pull') return;
  trailLines(body, dx, dy, delay);
  smearBody(body, dx, dy, delay);
  AFTERIMAGES.forEach((ghost) => afterimage(body, dx, dy, scale, delay, ghost));
};

/**
 * Anime smear: through the fast middle of a pull or push the figure
 * stretches along its line of travel and thins across it, then snaps
 * back as it lands. Runs on the body's first child, so it stacks on top
 * of the fly-in (which moves the body itself).
 */
const smearBody = (
  body: HTMLElement,
  dx: number,
  dy: number,
  delay: number
) => {
  const inner = body.firstElementChild;
  if (!(inner instanceof HTMLElement)) return;
  const angle = Math.atan2(dy, dx);
  const along = (stretch: number, squash: number) =>
    `rotate(${angle}rad) scale(${stretch}, ${squash}) rotate(${-angle}rad)`;
  inner.animate(
    [
      { transform: along(1, 1) },
      { transform: along(SMEAR_STRETCH, SMEAR_SQUASH), offset: 0.35 },
      { transform: along(1, 1), offset: 0.75 },
    ],
    { ...MOVE_TIMING.pull, delay }
  );
};

/**
 * One afterimage: a see-through copy of the figure that runs the same
 * flight a beat behind, so the hero leaves a fading trail of itself.
 * The copy is inert (no ids for hit-testing, no pointer events) and
 * removes itself when its flight ends.
 */
const afterimage = (
  body: HTMLElement,
  dx: number,
  dy: number,
  scale: number,
  delay: number,
  { lagMs, opacity }: { lagMs: number; opacity: number }
) => {
  const copy = body.cloneNode(true) as HTMLElement;
  copy.removeAttribute(HERO_ANCHOR_ATTR);
  copy.setAttribute('aria-hidden', 'true');
  copy.style.pointerEvents = 'none';
  copy.style.opacity = '0';
  body.before(copy);
  const flight = copy.animate(
    [
      {
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        opacity,
      },
      { transform: 'none', opacity: 0 },
    ],
    { ...MOVE_TIMING.pull, delay: delay + lagMs, easing: 'ease-out' }
  );
  flight.onfinish = () => copy.remove();
  flight.oncancel = () => copy.remove();
};

/**
 * Motion lines for a pull or push: streaks trailing behind the body,
 * opposite the way it travels (from its old spot, `dx`/`dy` back), that
 * shrink into the hero and fade as it lands. Drawn as a child of the
 * body, so they fly with it, and removed when done.
 * PERFORMANCE: a handful of divs animating transform and opacity.
 */
const trailLines = (
  body: HTMLElement,
  dx: number,
  dy: number,
  delay: number
) => {
  const angle = Math.atan2(-dy, -dx);
  const trail = document.createElement('div');
  trail.setAttribute('aria-hidden', 'true');
  trail.style.cssText = `position:absolute;left:50%;top:45%;width:0;height:0;pointer-events:none;rotate:${angle}rad`;
  const timing = MOVE_TIMING.pull;
  const duration = Number(timing.duration) + MOTION_LINE_LINGER_MS;
  MOTION_LINES.forEach(([offset, length, thickness], index) => {
    const line = document.createElement('span');
    line.style.cssText = `position:absolute;right:${MOTION_LINE_GAP_PX}px;top:${offset}px;width:${length}px;height:${thickness}px;border-radius:9999px;background:linear-gradient(to left, rgb(255 255 255 / 0.95), rgb(255 255 255 / 0));filter:drop-shadow(0 0 2px rgb(0 0 0 / 0.6));transform-origin:100% 50%;opacity:0`;
    trail.appendChild(line);
    line.animate(
      [
        { opacity: 0, transform: 'scaleX(0.3)' },
        { opacity: 0.95, transform: 'scaleX(1)', offset: 0.2 },
        { opacity: 0.7, transform: 'scaleX(0.8)', offset: 0.65 },
        { opacity: 0, transform: 'scaleX(0)' },
      ],
      { duration, delay: delay + index * 25, easing: 'ease-out' }
    );
  });
  body.appendChild(trail);
  window.setTimeout(() => trail.remove(), delay + duration + 200);
};

/** Swells the scenery (not the heroes) and settles it back. */
const lungeScenery = (field: HTMLElement, delay: number) => {
  const scenery = field.querySelectorAll<HTMLElement>(
    `:scope > :not([${ROW_LAYER_ATTR}])`
  );
  scenery.forEach((layer) =>
    layer.animate(
      [{ scale: '1' }, { scale: String(ADVANCE_ZOOM) }, { scale: '1' }],
      { ...MOVE_TIMING.advance, duration: 900, delay }
    )
  );
};

// --- HOOK ---
/** Animates row changes on the field (runs after every layout). */
export const useRowMoves = (
  fieldRef: RefObject<HTMLElement | null>,
  heroes: readonly HeroUnit[]
): void => {
  const lastRowsRef = useRef(new Map<number, HeroRow>());
  const spotsRef = useRef(new Map<number, BodySpot>());

  // Imperative on purpose: needs the laid-out positions before paint.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const lastRows = lastRowsRef.current;
    // 1. MEASURE WHERE EVERY BODY IS DRAWN NOW (BEFORE ANY NEW ANIMATION)
    const bodies = heroes.flatMap((unit) => {
      const body = bodyOf(field, unit.uid);
      return body ? [{ unit, body, spot: spotOf(body) }] : [];
    });
    // 2. PLAY ROW CHANGES FROM THE LAST SPOT TO THE NEW ONE
    const moved = movedHeroes(heroes, lastRows);
    const kind = kindOfMove(heroes, lastRows);
    // A hero just fell: let its death play before anyone moves up.
    const hasDeath = [...lastRows.keys()].some(
      (uid) => !heroes.some((unit) => unit.uid === uid)
    );
    const delay = hasDeath ? MOVE_AFTER_DEATH_MS : 0;
    if (moved.length > 0 && kind === 'advance') lungeScenery(field, delay);
    bodies
      .filter(({ unit }) => moved.includes(unit))
      .forEach(({ unit, body, spot }) => {
        const from = spotsRef.current.get(unit.uid);
        if (from) flyFrom(body, from, spot, kind, delay);
      });
    // 3. REMEMBER THIS LAYOUT FOR NEXT TIME
    lastRowsRef.current = new Map(heroes.map((unit) => [unit.uid, unit.row]));
    bodies.forEach(({ unit, spot }) => spotsRef.current.set(unit.uid, spot));
  }, [fieldRef, heroes]);
};
