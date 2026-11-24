// ===================================================================
// POP DRIFT
// Which way a floating number drifts as it fades: up-left, straight up
// or up-right, picked from its id so it never changes on re-render.
// The hit-pop keyframes (index.css) read it as --pop-drift-x.
// ===================================================================

import type { CSSProperties } from 'react';
import { seeded } from './seeded';

// --- CONSTANTS ---
/** How far (px) sideways a drifting number has gone when it fades. */
const DRIFT_X_PX = 30;
/** Left, straight up, right. */
const DRIFT_WAYS = [-1, 0, 1] as const;

// --- HELPERS ---
/** A pop's sideways drift, as the --pop-drift-x style it needs. */
export const driftOf = (id: number): CSSProperties => {
  const way = DRIFT_WAYS[Math.floor(seeded(id, 4) * DRIFT_WAYS.length)] ?? 0;
  return { ['--pop-drift-x' as string]: `${way * DRIFT_X_PX}px` };
};
