// ===================================================================
// FLOATING PLACEMENT
// Where to put a floating panel (tooltip, popover) for a trigger: above
// it, centred, kept inside the screen; underneath when there isn't room
// above. Shared so every floating panel lines up the same way.
// ===================================================================

// --- TYPES ---
export type FloatingPlacement = {
  left: number;
  top: number;
  /** The trigger's centre, from the panel's left edge (for an arrow). */
  arrowLeft: number;
  isAbove: boolean;
};

// --- CONSTANTS ---
/** Space kept from the screen edges and from the trigger (px). */
const EDGE_GAP = 8;
const TRIGGER_GAP = 6;

// --- FUNCTIONS ---
/**
 * Places a panel `width` px wide for a trigger at `rect`, above it when
 * at least `minRoomAbove` px are free there.
 */
export const placeFloating = (
  rect: DOMRect,
  width: number,
  minRoomAbove: number
): FloatingPlacement => {
  const centre = rect.left + rect.width / 2;
  const maxLeft = window.innerWidth - width - EDGE_GAP;
  const left = Math.min(maxLeft, Math.max(EDGE_GAP, centre - width / 2));
  const isAbove = rect.top >= minRoomAbove;
  return {
    left,
    top: isAbove ? rect.top - TRIGGER_GAP : rect.bottom + TRIGGER_GAP,
    arrowLeft: centre - left,
    isAbove,
  };
};
