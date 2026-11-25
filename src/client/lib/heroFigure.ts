// ===================================================================
// HERO FIGURE GEOMETRY
// Proportions of the hero drawings, shared by the drawing itself
// (HeroFigure) and the battlefield layout that fits and anchors it.
// ===================================================================

import type { HeroSize } from '../../shared/game/types';

// --- CONSTANTS ---
/** Body width in viewBox units per hero size (height stays BODY_HEIGHT). */
export const BODY_WIDTH: Record<HeroSize, number> = { 1: 60, 1.5: 85, 2: 110, 3: 150 };
/** Height of the drawing in viewBox units. */
export const BODY_HEIGHT = 100;

// --- HELPERS ---
/** Width / height of a hero's drawing, for laying it out. */
export const figureAspect = (size: HeroSize): number =>
  BODY_WIDTH[size] / BODY_HEIGHT;

/**
 * Helmet radius in viewBox units (bigger heroes, bigger heads). Kept a
 * little small for the body, so heroes stand tall like armoured
 * knights, but not so small that the headgear stops reading.
 */
export const headRadiusOf = (size: HeroSize): number => 8.5 + size * 1.7;

/** Helmet centre height in viewBox units. */
export const headCentreOf = (size: HeroSize): number =>
  30 - headRadiusOf(size) * 0.6;

/** How far down the drawing (0..1) the top of the helmet sits. */
export const headTopShare = (size: HeroSize): number =>
  (headCentreOf(size) - headRadiusOf(size)) / BODY_HEIGHT;
