// ===================================================================
// USE COMBAT CONTROLS
// Controls for a fight. Two ways to play a card, both safe in the feed:
//   TAP   Tap a card. Cards with no target play at once; others are
//         held. Tap a glowing hero to play the held card at it.
//   DRAG  Press a card and drag. An arrow follows the finger; drop on a
//         glowing hero (or anywhere on the field for untargeted cards).
// While a card is held, legal heroes glow and illegal ones dim. Tapping
// or dropping on a hero focuses it (top HUD + camera lean).
// ===================================================================

import { useState } from 'react';
import { useCardDrag, type CardDrop } from './useCardDrag';
import { targetRuleOf } from '../../shared/game/battlefield';
import { canPlayCard, targetsFor } from '../../shared/game/combat';
import type { RunAction } from '../../shared/game/run';
import type { CombatState } from '../../shared/game/types';

// --- TYPES ---
/** How a hero should look given the card the player is holding. */
export type AimState = 'idle' | 'legal' | 'locked' | 'illegal';

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

  /** Plays an untargeted card (aimed at the focus) or a targeted one. */
  const playAt = (handIndex: number, targetUid: number | null) =>
    onAction({ type: 'playCard', handIndex, targetUid: targetUid ?? 0 });

  /** Drop: play at a legal hero (or the field, if untargeted), else cancel. */
  const dropCard = ({ handIndex, overUid, isOverField }: CardDrop) => {
    setHeldIndex(null);
    const cardId = combat.hand[handIndex];
    if (cardId === undefined || !canPlayCard(combat, handIndex)) return;
    if (targetRuleOf(cardId) === 'none') {
      if (isOverField) playAt(handIndex, focusUid);
      return;
    }
    const legal = targetsFor(combat, cardId).map((unit) => unit.uid);
    if (overUid !== null && legal.includes(overUid)) {
      setChosenUid(overUid);
      playAt(handIndex, overUid);
    }
  };

  /** Drag start: hold the card so legal heroes light up. */
  const startDrag = (handIndex: number) =>
    setHeldIndex(canPlayCard(combat, handIndex) ? handIndex : null);

  const { drag, pressCard, wasDrag } = useCardDrag(startDrag, dropCard);
  const hoverUid = drag?.overUid ?? null;
  const isHoverLegal = hoverUid !== null && legalUids.includes(hoverUid);
  // Would letting go play the card? Untargeted cards: anywhere on the
  // field. Targeted cards: over a legal hero.
  const dragCard = drag ? combat.hand[drag.handIndex] : undefined;
  const isDropLive =
    drag !== null &&
    dragCard !== undefined &&
    (targetRuleOf(dragCard) === 'none' ? drag.isOverField : isHoverLegal);

  /** How a hero should look given the held card and the drag. */
  const aimOf = (uid: number): AimState => {
    if (!isHolding) return 'idle';
    if (!legalUids.includes(uid)) return 'illegal';
    return uid === hoverUid ? 'locked' : 'legal';
  };

  /** Plays a hand slot at a hero, then lets go of the card. */
  const play = (handIndex: number, targetUid: number) => {
    playAt(handIndex, targetUid);
    setHeldIndex(null);
  };

  /** Card tap: play untargeted cards, otherwise hold or let go. */
  const tapCard = (handIndex: number) => {
    if (wasDrag()) return; // the click a browser fires after a drag
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
    // Focus stays put while dragging, so the camera never slides a hero
    // out from under the finger; the drop focuses the target.
    focusUid,
    heldIndex: isHolding ? heldIndex : null,
    drag,
    isDropLive,
    aimOf,
    pressCard,
    tapCard,
    tapHero,
    endTurn,
  } as const;
};
