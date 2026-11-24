// ===================================================================
// USE PLAYER SHOTS
// Your Range and Magic cards fire before they land: an arrow or a
// magic bolt zips from the card itself (where it was released: the
// dragged card, or its slot in the hand) to each hero it hits, one per hit,
// staggered like the hits themselves (HIT_STAGGER_MS), so each impact
// lands as its shot arrives. The view waits PLAYER_SHOT_FLIGHT_MS
// before playing the card, then the hits pop on arrival.
// Melee cards swing instead: a silver cut crosses every hero the card
// hits, one per hit, each a different cut (see MeleeSweep and
// content/meleeSweeps.ts), MELEE_SWEEP_MS before the red slices land.
// ===================================================================

import { useCallback, useRef, useState } from 'react';
import { cardAreaTargets } from '../../shared/game/battlefield';
import { getCard, type CardId } from '../../shared/game/cards';
import type { PlayCardAction } from '../../shared/game/run';
import type { CombatState, MagicElement } from '../../shared/game/types';
import { sweepStyleFor, type SweepStyleId } from '../content/meleeSweeps';
import { sweepAcross, type SweepFlight } from '../lib/meleeSweep';
import { seeded } from '../lib/seeded';
import type {
  ProjectileFlight,
  ProjectileKind,
} from '../components/game/combat/Projectile';
import {
  DRAGGED_CARD_ATTR,
  HAND_SLOT_ATTR,
  VILLAIN_ANCHOR_ATTR,
  type Point,
} from './useCardDrag';
import { HIT_STAGGER_MS } from './useCardHits';
import { bodyPointOf } from './useHitPops';

// --- TYPES ---
/** What a played Melee card swings: at whom, how many times. */
export type SweepPlan = {
  cardId: CardId;
  targetUids: number[];
  hits: number;
};

/** What a played card fires: which shot, at whom, how many times. */
export type ShotPlan = {
  kind: ProjectileKind;
  /** The played card's place in the hand (where its shots launch). */
  handIndex: number;
  targetUids: number[];
  hits: number;
  /** A Magic card's element (its bolts' colours). */
  element?: MagicElement | undefined;
};

// --- CONSTANTS ---
/** A shot's flight time (matches --animate-hero-shot). */
export const PLAYER_SHOT_FLIGHT_MS = 220;
/** A melee swing crosses its targets in this long, then the hits land. */
export const MELEE_SWEEP_MS = 200;
/**
 * How long a sweep stays mounted: .melee-sweep (340 ms, index.css) plus
 * the latest stroke delay in SWEEP_STYLES (the cross's 90 ms).
 */
const SWEEP_LIFETIME_MS = 460;

// --- HELPERS ---
/**
 * What a card fires when played this way, or null for a card that
 * fires nothing (Melee, curses, buffs, or no damage at all).
 */
export const shotPlanOf = (
  combat: CombatState,
  action: PlayCardAction
): ShotPlan | null => {
  const cardId = combat.hand[action.handIndex];
  if (cardId === undefined) return null;
  const { type, effects, element } = getCard(cardId);
  const damage = effects.find((effect) => effect.kind === 'damage');
  if (!damage || (type !== 'range' && type !== 'magic')) return null;
  const targetUids =
    damage.target === 'all'
      ? cardAreaTargets(combat.heroes, cardId).map((unit) => unit.uid)
      : (action.targetUids ?? [action.targetUid ?? -1]);
  return {
    kind: type === 'range' ? 'arrow' : 'bolt',
    handIndex: action.handIndex,
    targetUids,
    hits: damage.hits,
    element,
  };
};

/**
 * What a Melee card's swing crosses when played this way (every hero it
 * hits, once per hit), or null for any other card or one with no damage.
 */
export const sweepPlanOf = (
  combat: CombatState,
  action: PlayCardAction
): SweepPlan | null => {
  const cardId = combat.hand[action.handIndex];
  if (cardId === undefined) return null;
  const { type, effects } = getCard(cardId);
  const damage = effects.find((effect) => effect.kind === 'damage');
  if (!damage || type !== 'melee') return null;
  const targetUids =
    damage.target === 'all'
      ? cardAreaTargets(combat.heroes, cardId).map((unit) => unit.uid)
      : (action.targetUids ?? [action.targetUid ?? -1]);
  return { cardId, targetUids, hits: damage.hits };
};

/**
 * Where a card's shots leave from, nearest first: the card being
 * dragged, else that card's own slot in the hand (held or not: an area
 * card plays on a single tap, never held), else your portrait as a last
 * resort. Read as the card is released, so it is still where you let go.
 */
const shotOriginSelectors = (handIndex: number): readonly string[] => [
  `[${DRAGGED_CARD_ATTR}]`,
  `[${HAND_SLOT_ATTR}="${handIndex}"]`,
  `[${VILLAIN_ANCHOR_ATTR}]`,
];

/** The centre of the first shot origin on screen, or null. */
const launchPoint = (handIndex: number): Point | null => {
  const rect = shotOriginSelectors(handIndex)
    .map((selector) => document.querySelector(selector))
    .find((element) => element !== null)
    ?.getBoundingClientRect();
  return rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : null;
};

// --- HOOK ---
/** Your shots in flight, and fire() to loose a card's shots. */
export const usePlayerShots = () => {
  const [shots, setShots] = useState<ProjectileFlight[]>([]);
  const [sweeps, setSweeps] = useState<SweepFlight[]>([]);
  const nextIdRef = useRef(0);
  // The last cut drawn, so the next swing never repeats it.
  const lastStyleRef = useRef<SweepStyleId | null>(null);

  /** Mounts one sweep, and unmounts it when it has played. */
  const showSweep = useCallback((sweep: SweepFlight) => {
    setSweeps((current) => [...current, sweep]);
    window.setTimeout(
      () => setSweeps((current) => current.filter((s) => s.id !== sweep.id)),
      SWEEP_LIFETIME_MS
    );
  }, []);

  /**
   * Swings a Melee card across its targets, one cut per hit (staggered
   * like the hits), each a different cut from the last; returns true if
   * the swing could be placed (false when no target is on screen).
   */
  const swing = useCallback(
    (plan: SweepPlan): boolean => {
      let placed = false;
      Array.from({ length: plan.hits }, (_, hitIndex) => {
        const points = plan.targetUids.map(uid => bodyPointOf(uid, hitIndex)).filter((point): point is Point => point !== null);
        const id = nextIdRef.current++;
        const style = sweepStyleFor(
          plan.cardId,
          hitIndex,
          lastStyleRef.current,
          seeded(id, hitIndex)
        );
        lastStyleRef.current = style;
        const sweep = sweepAcross(id, points, style);
        if (!sweep) return;
        placed = true;
        if (hitIndex === 0) return showSweep(sweep);
        window.setTimeout(() => showSweep(sweep), hitIndex * HIT_STAGGER_MS);
      });
      return placed;
    },
    [showSweep]
  );

  /**
   * Looses a card's shots, hit by hit (each hit at every target), and
   * returns true if any flew (false when nothing could be placed).
   */
  const fire = useCallback((plan: ShotPlan): boolean => {
    const from = launchPoint(plan.handIndex);
    if (!from) return false;
    const aims = Array.from(
      { length: plan.hits },
      () => plan.targetUids
    ).flat();
    const flights = aims.flatMap((uid, index): ProjectileFlight[] => {
      const to = bodyPointOf(uid, index);
      if (!to) return [];
      const id = nextIdRef.current++;
      return [
        {
          id,
          kind: plan.kind,
          from,
          to,
          delayMs: index * HIT_STAGGER_MS,
          element: plan.element,
        },
      ];
    });
    if (flights.length === 0) return false;
    setShots((current) => [...current, ...flights]);
    const ids = new Set(flights.map((flight) => flight.id));
    const lastLandsMs =
      (flights.at(-1)?.delayMs ?? 0) + PLAYER_SHOT_FLIGHT_MS + 50;
    window.setTimeout(
      () => setShots((current) => current.filter((s) => !ids.has(s.id))),
      lastLandsMs
    );
    return true;
  }, []);

  return { shots, sweeps, fire, swing } as const;
};
