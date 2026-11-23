// ===================================================================
// USE COMBAT CONTROLS
// Controls for a fight. Two ways to play a card, both safe in the feed:
//   TAP   Tap a card. Cards with no target play at once; others are
//         held. Tap a glowing hero to play the held card at it.
//   DRAG  Press a card and drag up. How it aims depends on who it hits:
//         ONE HERO  an arrow appears and snaps to a legal hero; drop to
//                   play. (With a self effect too, the card also glows.)
//         AREA      no arrow; every hero it would hit turns red, the
//                   card glows brighter the higher it is pulled, and it
//                   plays once pulled PULL_TO_PLAY_PX up.
//         SELF      no arrow; the card glows the same way.
// While a card is held, legal heroes glow and illegal ones dim. Tapping
// or dropping on a hero focuses it (top HUD + camera lean).
// ===================================================================

import { useState } from 'react';
import {
  useCardDrag,
  type CardDrag,
  type CardDrop,
  type HeroAnchor,
  type Point,
} from './useCardDrag';
import {
  affectsHeroes,
  affectsSelf,
  cardAreaTargets,
  targetRuleOf,
} from '../../shared/game/battlefield';
import type { CardId } from '../../shared/game/cards';
import { canPlayCard, targetsFor } from '../../shared/game/combat';
import type { RunAction } from '../../shared/game/run';
import type { CombatState } from '../../shared/game/types';

// --- TYPES ---
/** How a hero should look given the card the player is holding. */
export type AimState =
  | 'idle'
  | 'legal'
  | 'locked'
  | 'illegal'
  /** In an area card's blast (red); `struck` once letting go plays it. */
  | 'marked'
  | 'struck';

/** How a dragged card aims (see the header). */
type AimStyle = { hasArrow: boolean; hasGlow: boolean; isTargeted: boolean };

// --- CONSTANTS ---
/** How far (px) the finger must pull an arrowless card up to play it. */
const PULL_TO_PLAY_PX = 56;

// --- HELPERS ---
/** Works out whether a card shows an arrow, a glow, or both. */
const aimStyleOf = (cardId: CardId): AimStyle => {
  const isTargeted = targetRuleOf(cardId) !== 'none';
  const isArea = !isTargeted && affectsHeroes(cardId);
  return {
    hasArrow: isTargeted,
    hasGlow: affectsSelf(cardId) || isArea,
    isTargeted,
  };
};

/** How brightly a card glows: 0 at rest, 1 once it would play. */
const glowOf = (style: AimStyle, lift: number): number =>
  style.hasGlow ? Math.min(1, lift / PULL_TO_PLAY_PX) : 0;
/** The focused hero if alive, else the first front-row hero. */
const resolveFocus = (combat: CombatState, chosenUid: number | null) => {
  const isAlive = combat.heroes.some((unit) => unit.uid === chosenUid);
  if (isAlive) return chosenUid;
  const front = combat.heroes.find((unit) => unit.row === 'front');
  return front?.uid ?? combat.heroes[0]?.uid ?? null;
};

/**
 * The hero a drag snaps to: the nearest legal hero to the tip, but only
 * while the tip is over the battlefield (back in the hand = no target).
 */
const snapTarget = (
  drag: Pick<CardDrag, 'nearHeroes' | 'isOverField'>,
  legalUids: number[]
): HeroAnchor | null =>
  drag.isOverField
    ? (drag.nearHeroes.find((hero) => legalUids.includes(hero.uid)) ?? null)
    : null;

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

  /**
   * Would letting go play the card, and at whom? Targeted cards need a
   * snapped hero; area and self cards need a pull of PULL_TO_PLAY_PX. `isAimed` says the
   * arrow has a target; a pull-back keeps that aim (for the shrinking
   * arrow) but cancels the drop.
   */
  const resolveDrop = (
    cardId: CardId,
    drop: Omit<CardDrop, 'handIndex'>,
    legal: number[]
  ): { isLive: boolean; isAimed: boolean; target: HeroAnchor | null } => {
    const style = aimStyleOf(cardId);
    if (!style.hasArrow) {
      const isLive = drop.lift >= PULL_TO_PLAY_PX;
      return { isLive, isAimed: false, target: null };
    }
    const target = snapTarget(drop, legal);
    const isAimed = target !== null;
    return { isLive: isAimed && drop.pullBack === 0, isAimed, target };
  };

  /** Drop: play the card if the drop is live, else put it back. */
  const dropCard = ({ handIndex, ...drop }: CardDrop) => {
    setHeldIndex(null);
    const cardId = combat.hand[handIndex];
    if (cardId === undefined || !canPlayCard(combat, handIndex)) return;
    const legal = targetsFor(combat, cardId).map((unit) => unit.uid);
    const { isLive, target } = resolveDrop(cardId, drop, legal);
    if (!isLive) return;
    if (target) setChosenUid(target.uid);
    playAt(handIndex, target?.uid ?? focusUid);
  };

  /** Drag start: hold the card so legal heroes light up. */
  const startDrag = (handIndex: number) =>
    setHeldIndex(canPlayCard(combat, handIndex) ? handIndex : null);

  const { drag, pressCard, wasDrag } = useCardDrag(startDrag, dropCard);
  // SNAPPING AND GLOW: worked out fresh from the live drag each render.
  const dragCard = drag ? combat.hand[drag.handIndex] : undefined;
  const dragStyle = dragCard === undefined ? null : aimStyleOf(dragCard);
  const dropState =
    drag && dragCard !== undefined
      ? resolveDrop(dragCard, drag, legalUids)
      : { isLive: false, isAimed: false, target: null };
  const isDropLive = dropState.isLive;
  // The lock lets go as soon as a pull-back starts.
  const hoverUid = isDropLive ? (dropState.target?.uid ?? null) : null;
  /** How far the arrow has shrunk back toward the card (0..1). */
  const arrowRetract = drag?.pullBack ?? 0;
  /** How brightly the dragged card glows (self cards only). */
  const selfGlow = drag && dragStyle ? glowOf(dragStyle, drag.lift) : 0;
  /**
   * Where the arrow points: the snapped hero (or the tip, for untargeted
   * cards). Null while nothing is aimed at, or for self-only cards, so
   * the arrow stays hidden until it has somewhere to fly to.
   */
  const aimPoint: Point | null = dropState.isAimed
    ? (dropState.target?.point ?? drag?.tip ?? null)
    : null;

  // AREA CARDS: the heroes in the blast, shown red while it is held.
  const blastUids =
    isHolding && targetRuleOf(heldCard) === 'none'
      ? cardAreaTargets(combat.heroes, heldCard).map((unit) => unit.uid)
      : [];
  const isArea = blastUids.length > 0;

  /** How a hero should look given the held card and the drag. */
  const aimOf = (uid: number): AimState => {
    // Self-only cards (shroud, draw ...) leave every hero alone.
    const isAimingHeroes = isHolding && affectsHeroes(heldCard);
    if (!isAimingHeroes) return 'idle';
    if (isArea) {
      if (!blastUids.includes(uid)) return 'illegal';
      return isDropLive ? 'struck' : 'marked';
    }
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
    /** The hero the drag has locked onto, if any (for the top plate). */
    hoverUid,
    heldIndex: isHolding ? heldIndex : null,
    drag,
    aimPoint,
    isDropLive,
    arrowRetract,
    selfGlow,
    aimOf,
    pressCard,
    tapCard,
    tapHero,
    endTurn,
  } as const;
};
