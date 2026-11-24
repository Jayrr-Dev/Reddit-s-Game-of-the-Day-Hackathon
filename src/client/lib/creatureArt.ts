// ===================================================================
// CREATURE ART COORDINATES
// Creature drawings are traced from 1536 x 1024 concept art, in art
// units, and scaled into the shared hero viewBox (BODY_WIDTH[3] wide)
// here, so the shapes stay easy to compare with the art. Symmetric
// creatures are traced on their left half and mirrored.
// ===================================================================

import type { CSSProperties } from 'react';
import { BODY_WIDTH } from './heroFigure';

// --- TYPES ---
export type Point = readonly [number, number];

// --- CONSTANTS ---
/** The concept art's width (creatures are mirrored across its middle). */
export const ART_WIDTH = 1536;
/** Concept-art units to viewBox units (one scale for both axes). */
export const ART_SCALE = BODY_WIDTH[3] / ART_WIDTH;

// --- HELPERS ---
/** One art point in viewBox units. */
export const art = ([x, y]: Point): Point => [x * ART_SCALE, y * ART_SCALE];

/** Points (in art units) as an SVG points string in viewBox units. */
export const pts = (points: readonly Point[]): string =>
  points
    .map(art)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

/** Mirrors art points across the art's centre line. */
export const mirrored = (points: readonly Point[]): Point[] =>
  points.map(([x, y]) => [ART_WIDTH - x, y] as const);

/** A CSS transform origin at an art point, in viewBox units. */
export const originAt = (point: Point): CSSProperties => {
  const [x, y] = art(point);
  return { transformOrigin: `${x}px ${y}px` };
};

/** A point `radius` units from `centre`, at `deg` (0 = right, y down). */
export const polar = ([x, y]: Point, radius: number, deg: number): Point => {
  const rad = (deg * Math.PI) / 180;
  return [x + radius * Math.cos(rad), y + radius * Math.sin(rad)];
};
