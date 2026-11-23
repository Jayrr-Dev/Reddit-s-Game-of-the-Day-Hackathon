// ===================================================================
// CSS VARIABLES
// Typed helpers for inline styles that set CSS custom properties, used
// by the parallax layers (--depth) and the stage camera (--cam).
// ===================================================================

import type { CSSProperties } from 'react';

/** Inline style that sets CSS custom properties, e.g. { '--depth': 1 }. */
export const cssVars = (vars: Record<`--${string}`, number>): CSSProperties =>
  vars;

/** Inline style for a parallax layer at `depth` (0 = far, 1 = front row). */
export const depthStyle = (depth: number): CSSProperties =>
  cssVars({ '--depth': depth });
