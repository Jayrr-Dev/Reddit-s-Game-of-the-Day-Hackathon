// ===================================================================
// SCROLL FADE
// Scroll areas fade out at their top and bottom edges (a CSS mask), so
// content slides in and out of view softly instead of being cut off.
// One style for every scroll area (the pile dialog, menu sheets).
// ===================================================================

import type { CSSProperties } from 'react';

// --- CONSTANTS ---
/** The mask: opaque in the middle, transparent at both ends. */
const FADE_MASK =
  'linear-gradient(to bottom, transparent, black 1.25rem, black calc(100% - 1.25rem), transparent)';

/** Spread onto a scroll area's style to fade its edges. */
export const SCROLL_FADE_STYLE: CSSProperties = {
  maskImage: FADE_MASK,
  WebkitMaskImage: FADE_MASK,
};
