// ===================================================================
// MELEE SWEEP GEOMETRY
// Where a Melee swing sits and how wide it is, from the screen points of
// the heroes it hits. Kept apart from the MeleeSweep component so that
// file only exports a component (fast refresh).
// ===================================================================

import type { SweepStyleId } from '../content/meleeSweeps';
import type { Point } from '../hooks/useCardDrag';

// --- TYPES ---
/** One sweep on screen, in viewport pixels. */
export type SweepFlight = {
  id: number;
  /** The middle of the swing. */
  centre: Point;
  /** How wide the swing is (px). */
  width: number;
  /** Which cut it draws (see SWEEP_STYLES). */
  style: SweepStyleId;
};

// --- CONSTANTS ---
/** A single target still gets a swing this wide (px). */
const MIN_SWEEP_PX = 150;
/** How far the swing runs past the outermost targets, each side (px). */
const SWEEP_OVERHANG_PX = 60;

// --- HELPERS ---
/** The sweep across a set of target points, or null if there are none. */
export const sweepAcross = (
  id: number,
  points: readonly Point[],
  style: SweepStyleId
): SweepFlight | null => {
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  return {
    id,
    centre: { x: (left + right) / 2, y },
    width: Math.max(MIN_SWEEP_PX, right - left + SWEEP_OVERHANG_PX * 2),
    style,
  };
};
