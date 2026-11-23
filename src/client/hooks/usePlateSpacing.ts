// ===================================================================
// USE PLATE SPACING
// Keeps the heroes' HP plates from overlapping. A back-row hero often
// stands right behind a front-row one, so its plate lands on top of the
// front plate. After each layout this hook measures the plates and lifts
// every back-row plate just clear of any front-row plate it shares a
// column with. Front plates never move, so they stay tied to their hero.
// Columns (not pixels) decide who can collide: the parallax camera only
// slides rows sideways, so it can't change that, and heights are measured.
// ===================================================================

import { useLayoutEffect, type RefObject } from 'react';
import { sizeOf } from '../../shared/game/battlefield';
import type { HeroUnit } from '../../shared/game/types';

// --- CONSTANTS ---
/** Marks a plate in the DOM with its hero's uid. */
export const PLATE_UID_ATTR = 'data-plate-uid';
/** Space (px) kept between a lifted plate and the plate below it. */
const PLATE_GAP_PX = 3;

// --- HELPERS ---
/** True when two heroes stand in at least one shared column. */
const sharesColumn = (a: HeroUnit, b: HeroUnit): boolean =>
  a.col < b.col + sizeOf(b) && b.col < a.col + sizeOf(a);

/** How far (px) a back plate must rise to clear the front plates. */
const liftFor = (back: DOMRect, fronts: readonly DOMRect[]): number =>
  Math.max(0, ...fronts.map((front) => back.bottom - front.top + PLATE_GAP_PX));

/**
 * Lifts back-row plates clear of front-row plates. Imperative on
 * purpose: it needs the real, laid-out sizes of the plates.
 */
const spacePlates = (field: HTMLElement, heroes: readonly HeroUnit[]) => {
  const plateOf = (unit: HeroUnit) =>
    field.querySelector<HTMLElement>(`[${PLATE_UID_ATTR}="${unit.uid}"]`);
  const fronts = heroes.filter((unit) => unit.row === 'front');
  const backs = heroes.filter((unit) => unit.row === 'back');
  // Measure from the plates' natural spots, so lifts never pile up.
  backs.forEach((unit) => plateOf(unit)?.style.removeProperty('translate'));
  backs.forEach((unit) => {
    const plate = plateOf(unit);
    if (!plate) return;
    const frontRects = fronts
      .filter((front) => sharesColumn(unit, front))
      .map(plateOf)
      .flatMap((front) => (front ? [front.getBoundingClientRect()] : []));
    const lift = liftFor(plate.getBoundingClientRect(), frontRects);
    if (lift > 0) plate.style.translate = `0 -${lift}px`;
  });
};

// --- HOOK ---
/** Re-spaces the plates whenever the heroes or the field size change. */
export const usePlateSpacing = (
  fieldRef: RefObject<HTMLElement | null>,
  heroes: readonly HeroUnit[]
) => {
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    spacePlates(field, heroes);
    const observer = new ResizeObserver(() => spacePlates(field, heroes));
    observer.observe(field);
    return () => observer.disconnect();
  }, [fieldRef, heroes]);
};
