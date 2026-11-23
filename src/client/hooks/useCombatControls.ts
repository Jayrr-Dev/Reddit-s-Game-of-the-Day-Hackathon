// ===================================================================
// USE COMBAT CONTROLS
// Tap-only controls for a fight, safe inside the Reddit feed:
//   1. Tap a card. Cards with no target play at once; others are held.
//   2. While a card is held, legal heroes glow and illegal ones dim.
//   3. Tap a glowing hero to play the held card at it.
// Tapping any hero also focuses it (top HUD + camera lean).
// ===================================================================

import { useState } from 'react';
import { targetRuleOf } from '../../shared/game/battlefield';
import { canPlayCard, targetsFor } from '../../shared/game/combat';
import type { RunAction } from '../../shared/game/run';
import type { CombatState } from '../../shared/game/types';

// --- TYPES ---
/** How a hero should look given the card the player is holding. */
export type AimState = 'idle' | 'legal' | 'illegal';

// --- HELPERS ---
/** The focused hero if alive, else the first front-row hero. */
const resolveFocus = (combat: CombatState, chosenUid: number | null) => {
  const isAlive = combat.heroes.some((unit) => unit.uid === chosenUid);
  if (isAlive) return chosenUid;
  const front = combat.heroes.find((unit) => unit.row === 'front');
  return front?.uid ?? combat.heroes[0]?.uid ?? null;
};

// --- HOOK ---
/** Selection, focus and tap handlers for one fight. */
export const useCombatControls = (
  combat: CombatState,
  onAction: (action: RunAction) => void
) => {
  const [chosenUid, setChosenUid] = useState<number | null>(null);
  const [heldIndex, setHeldIndex] = useState<number | null>(null);
  const focusUid = resolveFocus(combat, chosenUid);

  // A held card is only valid while it is still in hand and playable.
  const heldCard = heldIndex === null ? undefined : combat.hand[heldIndex];
  const isHolding =
    heldCard !== undefined &&
    heldIndex !== null &&
    canPlayCard(combat, heldIndex);
  const legalUids = isHolding
    ? targetsFor(combat, heldCard).map((unit) => unit.uid)
    : [];

  /** How a hero should look given the held card. */
  const aimOf = (uid: number): AimState => {
    if (!isHolding) return 'idle';
    return legalUids.includes(uid) ? 'legal' : 'illegal';
  };

  /** Plays a hand slot at a hero, then lets go of the card. */
  const play = (handIndex: number, targetUid: number) => {
    onAction({ type: 'playCard', handIndex, targetUid });
    setHeldIndex(null);
  };

  /** Card tap: play untargeted cards, otherwise hold or let go. */
  const tapCard = (handIndex: number) => {
    const cardId = combat.hand[handIndex];
    if (cardId === undefined || !canPlayCard(combat, handIndex)) return;
    if (targetRuleOf(cardId) === 'none') return play(handIndex, focusUid ?? 0);
    setHeldIndex(heldIndex === handIndex ? null : handIndex);
  };

  /** Hero tap: focus it, and fire the held card if it may hit this hero. */
  const tapHero = (uid: number) => {
    setChosenUid(uid);
    if (isHolding && heldIndex !== null && legalUids.includes(uid))
      play(heldIndex, uid);
  };

  /** Ends the turn and drops any held card. */
  const endTurn = () => {
    setHeldIndex(null);
    onAction({ type: 'endTurn' });
  };

  return {
    focusUid,
    heldIndex: isHolding ? heldIndex : null,
    aimOf,
    tapCard,
    tapHero,
    endTurn,
  } as const;
};
