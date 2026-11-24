import { activeRows, rowDepth } from '../../../../shared/game/battlefield';
import type { HeroRow } from '../../../../shared/game/types';

/** Project equally deep ground strips, with the far edge twice as distant as the near edge. */
const project = (t: number) => t / (2 - t);

/** The horizon row uses three broad slots across the middle two-thirds of the field. */
export const HORIZON_SLOT_SPAN = 2 / 3;

/** Ground coordinates measured downward from the horizon within the enemy area. */
export const rowPerspective = (row: HeroRow) => {
  const count = activeRows().length;
  const nearEdge = count - rowDepth(row);
  const feet = project((nearEdge - 0.08) / count);
  return { boundary: project(nearEdge / count), feet };
};
