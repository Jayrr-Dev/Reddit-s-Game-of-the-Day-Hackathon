// ===================================================================
// HERO FIGURE GEOMETRY
// Proportions of the hero drawings, shared by the drawing itself
// (HeroFigure) and the battlefield layout that fits and anchors it.
// ===================================================================

import type { HeroSize } from '../../shared/game/types';

// --- CONSTANTS ---
/** Body width in viewBox units per hero size (height stays BODY_HEIGHT). */
export const BODY_WIDTH: Record<HeroSize, number> = { 1: 60, 2: 110, 3: 150 };
/** Height of the drawing in viewBox units. */
export const BODY_HEIGHT = 100;

// --- HELPERS ---
/** Width / height of a hero's drawing, for laying it out. */
export const figureAspect = (size: HeroSize): number =>
  BODY_WIDTH[size] / BODY_HEIGHT;
