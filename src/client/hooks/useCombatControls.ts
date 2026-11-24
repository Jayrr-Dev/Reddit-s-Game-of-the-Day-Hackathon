// ===================================================================
// USE COMBAT CONTROLS
// Controls for a fight. Two ways to play a card, both safe in the feed:
//   TAP   Tap a card. Cards with no target play at once; others are
//         held. Tap a glowing hero to play the held card at it.
//         Tap the held card again to let the game aim it: it plays at
//         the toughest hero it would kill, else the weakest (for a
//         Target N card, the best N; see autoTargets). So a double tap
//         plays a card in one go.
//   DRAG  Press a card and drag up. How it aims depends on who it hits:
//         ONE HERO  an arrow appears and snaps to a legal hero; drop to
//                   play. (With a self effect too, the card also glows.)
//         AREA      no arrow; every hero it would hit turns red, the
//                   card glows brighter the higher it is pulled, and it
//                   plays once pulled PULL_TO_PLAY_PX up.
//         SELF      no arrow; the card glows the same way.
// While a card is held, legal heroes glow and illegal ones dim. Tapping
// or dropping on a hero focuses it (top HUD + camera lean).
// TARGET N cards take N picks before they fire: each drop on a hero (or
// tap on one while the card is held) adds a pick and keeps the card
// held, and the last pick plays it after LAST_PICK_HOLD_MS, so its mark
// is seen before the card fires. The same hero may be picked again.
// Dropping the card anywhere else (or tapping another card) cancels;
// nothing is spent until the card fires.
// IMBUE cards aim at another card in hand instead (see useImbuePick).
// ===================================================================

import { useEffect, useRef, useState } from 'react';
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
  heroesBehind,
  targetRuleOf,
} from '../../shared/game/battlefield';
import { getCard, type CardId } from '../../shared/game/cards';
import {
  autoTargets,
  canPlayCard,
  playDamageFactor,
  targetsFor,
  wouldFell,
} from '../../shared/game/combat';
import {
  cardHasKeyword,
  imbueEffectOf,
  imbuesAt,
} from '../../shared/game/imbue';
import type { RunAction } from '../../shared/game/run';
import { useImbuePick } from './useImbuePick';
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

/** The heroes picked so far for a held Target N card, in order. */
type Picks = { handIndex: number; cardId: CardId; uids: number[] };

/**
 * A hero picked by a held Target N card: Melee marks it with slashes,
 * every other type with a crosshair; `count` is how often it was picked.
 */
export type PickMarker = { kind: 'crosshair' | 'slash'; count: number };

// --- CONSTANTS ---
/** How far (px) the finger must pull an arrowless card up to play it. */
const PULL_TO_PLAY_PX = 56;
/**
 * How long (ms) a Target N card holds after its last pick, so every
 * mark (the last one too) shows before it fires. Input waits meanwhile.
 */
const LAST_PICK_HOLD_MS = 1000;

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
  const [picks, setPicks] = useState<Picks | null>(null);
  // Set while a Target N card waits to fire after its last pick.
  const [isFiring, setIsFiring] = useState(false);
  const fireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (fireTimer.current) clearTimeout(fireTimer.current);
    },
    []
  );
  const focusUid = resolveFocus(combat, chosenUid);
  const imbue = useImbuePick(combat, onAction);

  // A held card is only valid while it is still in hand and playable.
  const heldCard = heldIndex === null ? undefined : combat.hand[heldIndex];
  const isHolding =
    heldCard !== undefined &&
    heldIndex !== null &&
    canPlayCard(combat, heldIndex);
  const legalUids = isHolding
    ? targetsFor(combat, heldCard).map((unit) => unit.uid)
    : [];
  // Picks only count while their card is still the one held.
  const pickedUids =
    picks &&
    isHolding &&
    picks.handIndex === heldIndex &&
    picks.cardId === heldCard
      ? picks.uids
      : [];

  /** Plays an untargeted card (aimed at the focus) or a targeted one. */
  const playAt = (handIndex: number, targetUid: number | null) =>
    onAction({ type: 'playCard', handIndex, targetUid: targetUid ?? 0 });

  /** Lets go of the held card and forgets its picks. */
  const release = () => {
    setHeldIndex(null);
    setPicks(null);
  };

  /**
   * Fires a Target N card at every picked hero in order, after holding
   * LAST_PICK_HOLD_MS with all its marks showing.
   */
  const fireAfterHold = (handIndex: number, cardId: CardId, uids: number[]) => {
    setPicks({ handIndex, cardId, uids });
    setHeldIndex(handIndex);
    setIsFiring(true);
    fireTimer.current = setTimeout(() => {
      fireTimer.current = null;
      setIsFiring(false);
      release();
      onAction({
        type: 'playCard',
        handIndex,
        targetUid: uids[0] ?? 0,
        targetUids: uids,
      });
    }, LAST_PICK_HOLD_MS);
  };

  /**
   * Adds a pick for the card in `handIndex`. Until the last pick the
   * card stays held; a one-target card then plays at once, a Target N
   * card holds a moment first (see fireAfterHold).
   */
  const addPick = (handIndex: number, uid: number) => {
    const cardId = combat.hand[handIndex];
    if (cardId === undefined) return;
    const isSameCard =
      picks?.handIndex === handIndex && picks.cardId === cardId;
    const uids = [...(isSameCard ? picks.uids : []), uid];
    const { targets } = getCard(cardId);
    if (uids.length < targets) {
      setPicks({ handIndex, cardId, uids });
      setHeldIndex(handIndex);
      return;
    }
    if (targets > 1) return fireAfterHold(handIndex, cardId, uids);
    release();
    playAt(handIndex, uid);
  };

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
    if (isFiring) return;
    const cardId = combat.hand[handIndex];
    if (cardId === undefined || !canPlayCard(combat, handIndex))
      return release();
    // A dragged Imbue card imbues the glowing card it is let go over.
    if (imbueEffectOf(cardId)) {
      release();
      return imbue.drop();
    }
    const legal = targetsFor(combat, cardId).map((unit) => unit.uid);
    const { isLive, target } = resolveDrop(cardId, drop, legal);
    if (!isLive) return release();
    if (!target) {
      release();
      return playAt(handIndex, focusUid);
    }
    setChosenUid(target.uid);
    addPick(handIndex, target.uid);
  };

  /** Drag start: hold the card so legal heroes light up. */
  const startDrag = (handIndex: number) => {
    if (isFiring) return;
    if (picks && picks.handIndex !== handIndex) setPicks(null);
    setHeldIndex(canPlayCard(combat, handIndex) ? handIndex : null);
  };

  const drags = useCardDrag(startDrag, dropCard);
  const { drag, wasDrag } = drags;
  /**
   * Pointer down on a card: no drag while an Imbue card is choosing, but
   * the press still clears the last drag (the Imbue card's own drag), or
   * its click would be thrown away as a post-drag click.
   */
  const pressCard: typeof drags.pressCard = (handIndex, event) => {
    if (imbue.isImbuing) return drags.pressWithoutDrag();
    drags.pressCard(handIndex, event);
  };
  // SNAPPING AND GLOW: worked out fresh from the live drag each render.
  const dragCard = drag ? combat.hand[drag.handIndex] : undefined;
  const dragStyle = dragCard === undefined ? null : aimStyleOf(dragCard);
  // IMBUE DRAG: an Imbue card being dragged aims at cards in hand.
  const imbueDragIndex =
    drag && dragCard !== undefined && imbueEffectOf(dragCard)
      ? drag.handIndex
      : null;
  const { followDrag } = imbue;
  useEffect(() => followDrag(imbueDragIndex), [followDrag, imbueDragIndex]);
  const dropState =
    drag && dragCard !== undefined
      ? resolveDrop(dragCard, drag, legalUids)
      : { isLive: false, isAimed: false, target: null };
  const isDropLive = dropState.isLive;
  // The lock lets go as soon as a pull-back starts.
  const hoverUid = isDropLive ? (dropState.target?.uid ?? null) : null;
  /**
   * True when letting go here would kill the locked hero: the picks
   * already made for this card plus this one, run through the engine.
   */
  const priorPicks = drag?.handIndex === heldIndex ? pickedUids : [];
  const isLethal =
    drag !== null &&
    hoverUid !== null &&
    wouldFell(combat, drag.handIndex, [...priorPicks, hoverUid], hoverUid);
  /** Every damage multiplier on this play at the locked hero (1 = none). */
  const hoverUnit = combat.heroes.find((unit) => unit.uid === hoverUid);
  const aimFactor =
    hoverUnit && dragCard !== undefined
      ? playDamageFactor(combat.player, hoverUnit, getCard(dragCard))
      : 1;
  /**
   * PREVIEW: while a card is raised (tapped, not dragged), the heroes a
   * second tap would hit (see autoTargets), each once, and which of
   * them it would kill. Picks already made are left out: they show
   * their own marks.
   */
  const autoAimUids =
    isHolding && heldIndex !== null && !drag && !isFiring
      ? [...new Set(autoTargets(combat, heldIndex, pickedUids))].filter(
          (uid) => !pickedUids.includes(uid)
        )
      : [];
  /** True when the raised card's previewed hit on `uid` would kill. */
  const isAutoAimLethal = (uid: number): boolean =>
    heldIndex !== null && wouldFell(combat, heldIndex, [uid], uid);
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

  // PIERCING: a Piercing card locked on a front hero also hits the
  // heroes right behind it, so each gets its own arrow and lock.
  const isPiercingDrag =
    drag !== null &&
    dragCard !== undefined &&
    cardHasKeyword(dragCard, imbuesAt(combat, drag.handIndex), 'piercing');
  const pierceUids =
    isPiercingDrag && hoverUnit
      ? heroesBehind(combat.heroes, hoverUnit).map((unit) => unit.uid)
      : [];
  /** Where each pierced hero's arrow lands. */
  const pierceAimPoints: Point[] = (drag?.nearHeroes ?? [])
    .filter((hero: HeroAnchor) => pierceUids.includes(hero.uid))
    .map((hero) => hero.point);

  // AREA CARDS: the heroes in the blast, shown red while it is held.
  const blastUids =
    isHolding && targetRuleOf(heldCard) === 'none'
      ? cardAreaTargets(combat.heroes, heldCard).map((unit) => unit.uid)
      : [];
  const isArea = blastUids.length > 0;

  /** How a hero should look given the held card and the drag. */
  const aimOf = (uid: number): AimState => {
    // Self-only cards (guard, draw ...) leave every hero alone.
    const isAimingHeroes = isHolding && affectsHeroes(heldCard);
    if (!isAimingHeroes) return 'idle';
    if (isArea) {
      if (!blastUids.includes(uid)) return 'illegal';
      return isDropLive ? 'struck' : 'marked';
    }
    if (pierceUids.includes(uid)) return 'locked';
    if (!legalUids.includes(uid)) return 'illegal';
    return uid === hoverUid ? 'locked' : 'legal';
  };

  /** Plays the card at the heroes the game picks (see autoTargets). */
  const autoPlay = (handIndex: number, cardId: CardId) => {
    const uids = autoTargets(combat, handIndex, pickedUids);
    if (uids.length === 0) return release();
    if (uids.length > 1) return fireAfterHold(handIndex, cardId, uids);
    release();
    playAt(handIndex, uids[0] ?? null);
  };

  /**
   * Card tap: play untargeted cards, otherwise hold it; tapping the held
   * card again plays it at the best target (autoPlay).
   */
  const tapCard = (handIndex: number) => {
    if (wasDrag() || isFiring) return; // a post-drag click, or mid-fire
    if (imbue.isImbuing) {
      if (handIndex === imbue.imbuingIndex) return imbue.cancel();
      return imbue.pick(handIndex);
    }
    const cardId = combat.hand[handIndex];
    if (cardId === undefined || !canPlayCard(combat, handIndex)) return;
    if (imbueEffectOf(cardId)) {
      release();
      return imbue.begin(handIndex);
    }
    if (targetRuleOf(cardId) === 'none') {
      release();
      return playAt(handIndex, focusUid);
    }
    if (heldIndex === handIndex) return autoPlay(handIndex, cardId);
    release();
    setHeldIndex(handIndex);
  };

  /** Hero tap: focus it, and pick it for the held card if it may hit it. */
  const tapHero = (uid: number) => {
    if (isFiring) return;
    setChosenUid(uid);
    if (isHolding && heldIndex !== null && legalUids.includes(uid))
      addPick(heldIndex, uid);
  };

  /** Ends the turn and drops any held card. */
  const endTurn = () => {
    if (isFiring) return;
    release();
    imbue.cancel();
    onAction({ type: 'endTurn' });
  };

  /** The pick marker on a hero for the held card, or null if unpicked. */
  const pickMarkerOf = (uid: number): PickMarker | null => {
    const count = pickedUids.filter((picked) => picked === uid).length;
    if (count === 0 || heldCard === undefined) return null;
    const kind = getCard(heldCard).type === 'melee' ? 'slash' : 'crosshair';
    return { kind, count };
  };

  return {
    // Focus stays put while dragging, so the camera never slides a hero
    // out from under the finger; the drop focuses the target.
    focusUid,
    /** The hero the drag has locked onto, if any (for the top plate). */
    hoverUid,
    heldIndex: imbue.isImbuing
      ? imbue.imbuingIndex
      : isHolding
        ? heldIndex
        : null,
    /** Hand slots the raised Imbue card may imbue (empty otherwise). */
    imbueSlots: imbue.slots,
    imbueArrow: imbue.arrow,
    /** The slot the live imbue arrow points at (it pulses), or null. */
    imbueAimedSlot: imbue.arrow?.isLive ? imbue.arrow.slot : null,
    drag,
    aimPoint,
    /** Arrows to the heroes a locked Piercing card also hits. */
    pierceAimPoints,
    isDropLive,
    isLethal,
    aimFactor,
    autoAimUids,
    isAutoAimLethal,
    arrowRetract,
    selfGlow,
    aimOf,
    pickMarkerOf,
    pressCard,
    tapCard,
    tapHero,
    endTurn,
  } as const;
};
