// ===================================================================
// USE PLATE SPACING
// Keeps the heroes' HP plates from overlapping. A farther hero often
// stands right behind a nearer one, so its plate lands on top of the
// nearer plate. After each layout this hook measures the plates and,
// row by row from the Backline out to the Horizon, lifts each plate
// just clear of any nearer-row plate it actually overlaps sideways.
// Front plates never move, so they stay tied to their hero. Measured overlap (not columns) decides, so a wide boss's plate
// doesn't lift the plates of heroes standing clear of it.
// ===================================================================

import { useLayoutEffect, type RefObject } from 'react';
import { activeRows, rowDepth } from '../../shared/game/battlefield';
import type { HeroUnit } from '../../shared/game/types';

// --- CONSTANTS ---
/** Marks a plate in the DOM with its hero's uid. */
export const PLATE_UID_ATTR = 'data-plate-uid';
/** Space (px) kept between a lifted plate and the plate below it. */
const PLATE_GAP_PX = 3;

// --- HELPERS ---
/** True when two plates overlap sideways (by more than the gap). */
const overlapsSideways = (a: DOMRect, b: DOMRect): boolean =>
  a.left + PLATE_GAP_PX < b.right && b.left + PLATE_GAP_PX < a.right;

/** How far (px) a far plate must rise to clear the nearer plates. */
const liftFor = (far: DOMRect, nearer: readonly DOMRect[]): number =>
  Math.max(0, ...nearer.map((near) => far.bottom - near.top + PLATE_GAP_PX));

/**
 * Lifts each far-row plate clear of the nearer rows' plates, nearest
 * far row first (so a Horizon plate clears an already lifted Backline
 * plate). Imperative on purpose: it needs the real, laid-out sizes.
 */
const spacePlates = (field: HTMLElement, heroes: readonly HeroUnit[]) => {
  const plateOf = (unit: HeroUnit) =>
    field.querySelector<HTMLElement>(`[${PLATE_UID_ATTR}="${unit.uid}"]`);
  const farHeroes = heroes.filter((unit) => rowDepth(unit.row) > 0);
  // Measure from the plates' natural spots, so lifts never pile up.
  farHeroes.forEach((unit) => plateOf(unit)?.style.removeProperty('translate'));
  for (const row of activeRows().slice(1)) {
    const nearer = heroes.filter((unit) => rowDepth(unit.row) < rowDepth(row));
    for (const unit of heroes.filter((hero) => hero.row === row)) {
      const plate = plateOf(unit);
      if (!plate) continue;
      const rect = plate.getBoundingClientRect();
      const nearerRects = nearer
        .map(plateOf)
        .flatMap((near) => (near ? [near.getBoundingClientRect()] : []))
        .filter((near) => overlapsSideways(rect, near));
      const lift = liftFor(rect, nearerRects);
      if (lift > 0) plate.style.translate = `0 -${lift}px`;
    }
  }
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
    const settle = () => spacePlates(field, heroes);
    field.addEventListener('transitionend', settle);
    return () => {
      observer.disconnect();
      field.removeEventListener('transitionend', settle);
    };
  }, [fieldRef, heroes]);
};
