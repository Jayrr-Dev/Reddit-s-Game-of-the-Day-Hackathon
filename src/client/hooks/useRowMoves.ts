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
//            overshoot. (A push plays the same move in reverse.)
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
  kind: MoveKind
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
    MOVE_TIMING[kind]
  );
};

/** Swells the scenery (not the heroes) and settles it back. */
const lungeScenery = (field: HTMLElement) => {
  const scenery = field.querySelectorAll<HTMLElement>(
    `:scope > :not([${ROW_LAYER_ATTR}])`
  );
  scenery.forEach((layer) =>
    layer.animate(
      [{ scale: '1' }, { scale: String(ADVANCE_ZOOM) }, { scale: '1' }],
      { ...MOVE_TIMING.advance, duration: 900 }
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
    if (moved.length > 0 && kind === 'advance') lungeScenery(field);
    bodies
      .filter(({ unit }) => moved.includes(unit))
      .forEach(({ unit, body, spot }) => {
        const from = spotsRef.current.get(unit.uid);
        if (from) flyFrom(body, from, spot, kind);
      });
    // 3. REMEMBER THIS LAYOUT FOR NEXT TIME
    lastRowsRef.current = new Map(heroes.map((unit) => [unit.uid, unit.row]));
    bodies.forEach(({ unit, spot }) => spotsRef.current.set(unit.uid, spot));
  }, [fieldRef, heroes]);
};
