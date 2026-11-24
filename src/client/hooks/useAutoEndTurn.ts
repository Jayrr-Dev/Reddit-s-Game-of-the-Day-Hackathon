// ===================================================================
// USE AUTO END TURN
// Ends the villain's turn on its own once nothing is left to do: no
// card in hand can be played and no movement can be made (see
// hasPlayLeft). It waits a short beat first, so the last card's hits
// land and the player sees the turn is spent before the heroes move.
// Any change (a new state, an animation starting) resets the wait.
// ===================================================================

import { useEffect, useRef } from 'react';
import { combatOutcome } from '../../shared/game/combat';
import { hasPlayLeft } from '../../shared/game/movement';
import type { CombatState } from '../../shared/game/types';

// --- CONSTANTS ---
/** The beat (ms) between running out of plays and the turn ending. */
export const AUTO_END_TURN_DELAY_MS = 900;

// --- HOOK ---
/**
 * Calls `endTurn` once `combat` has no play left and the view is idle
 * (`isBusy` false: no hits, shots or hero turn playing, not paused).
 */
export const useAutoEndTurn = (
  combat: CombatState,
  isBusy: boolean,
  endTurn: () => void
) => {
  // The latest endTurn, so a new callback each render never resets the wait.
  const endTurnRef = useRef(endTurn);
  useEffect(() => {
    endTurnRef.current = endTurn;
  }, [endTurn]);
  // A won or lost fight has no turn to end.
  const isSpent =
    !isBusy && combatOutcome(combat) === 'ongoing' && !hasPlayLeft(combat);

  // SPENT AND IDLE -> END THE TURN AFTER A BEAT (timing: an effect)
  useEffect(() => {
    if (!isSpent) return;
    const timer = window.setTimeout(
      () => endTurnRef.current(),
      AUTO_END_TURN_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [isSpent, combat]);
};
