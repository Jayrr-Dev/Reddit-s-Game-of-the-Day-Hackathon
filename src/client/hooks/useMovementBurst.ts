// ===================================================================
// USE MOVEMENT BURST
// The speed-lines burst for each villain movement. It fires when the
// shown fight records a new movement, so a move made by hand and one an
// keyword (Rampage on kill, Distance on hit) makes on its own, once the card's
// hits have played out, get the same burst.
// ===================================================================

import { useState } from 'react';
import type { CombatState, MovementId } from '../../shared/game/types';

// --- TYPES ---
/** The last movement, with a running count so each one replays. */
export type MovementBurst = { move: MovementId; count: number; label?: string };

// --- HOOK ---
/** The speed-lines burst to draw now, if any. */
export const useMovementBurst = (shown: CombatState) => {
  // A paid move (lastMovement) or a free keyword one (freeMove): each
  // is a fresh object, so a new one means a new move.
  const { lastMovement, freeMove } = shown;
  const forced = shown.forcedMovement;
  const forcedCount = forced?.count ?? 0;
  const [seen, setSeen] = useState({ lastMovement, freeMove, forcedCount });
  const [burst, setBurst] = useState<MovementBurst>();

  // A NEW MOVEMENT ON THE FIELD: burst once, the way that move goes.
  // Adjusted while rendering (React's pattern for state that follows a
  // changed input), so no effect re-renders twice.
  const isNewPaid = lastMovement !== seen.lastMovement;
  const isNewFree = freeMove !== seen.freeMove;
  if (isNewPaid || isNewFree || forcedCount !== seen.forcedCount) {
    setSeen({ lastMovement, freeMove, forcedCount });
    const made = (isNewFree ? freeMove : null) ?? lastMovement;
    if (forced && forcedCount > seen.forcedCount) {
      const pull = forced.move === 'charge';
      const label = forced.distance ? (pull ? 'Pulled forward' : 'Knocked back') : (pull ? 'Pull blocked' : 'Knockback blocked');
      setBurst(last => ({ move: forced.move, count: (last?.count ?? 0) + 1, label }));
    } else if (made && (isNewPaid || isNewFree)) {
      const { move } = made;
      setBurst((last) => ({ move, count: (last?.count ?? 0) + 1 }));
    }
  }

  return burst;
};
