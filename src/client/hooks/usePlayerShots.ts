// ===================================================================
// USE PLAYER SHOTS
// Your Range and Magic cards fire before they land: an arrow or a
// magic bolt zips from the card itself (where it was released: the
// dragged card, or the held one in the hand) to each hero it hits, one per hit,
// staggered like the hits themselves (HIT_STAGGER_MS), so each impact
// lands as its shot arrives. The view waits PLAYER_SHOT_FLIGHT_MS
// before playing the card, then the hits pop on arrival.
// ===================================================================

import { useCallback, useRef, useState } from 'react';
import { cardAreaTargets } from '../../shared/game/battlefield';
import { getCard } from '../../shared/game/cards';
import type { PlayCardAction } from '../../shared/game/run';
import type { CombatState } from '../../shared/game/types';
import type {
  ProjectileFlight,
  ProjectileKind,
} from '../components/game/combat/Projectile';
import {
  DRAGGED_CARD_ATTR,
  HELD_CARD_ATTR,
  VILLAIN_ANCHOR_ATTR,
  type Point,
} from './useCardDrag';
import { HIT_STAGGER_MS } from './useCardHits';
import { bodyPointOf } from './useHitPops';

// --- TYPES ---
/** What a played card fires: which shot, at whom, how many times. */
export type ShotPlan = {
  kind: ProjectileKind;
  targetUids: number[];
  hits: number;
};

// --- CONSTANTS ---
/** A shot's flight time (matches --animate-hero-shot). */
export const PLAYER_SHOT_FLIGHT_MS = 220;

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
  const { type, effects } = getCard(cardId);
  const damage = effects.find((effect) => effect.kind === 'damage');
  if (!damage || (type !== 'range' && type !== 'magic')) return null;
  const targetUids =
    damage.target === 'all'
      ? cardAreaTargets(combat.heroes, cardId).map((unit) => unit.uid)
      : (action.targetUids ?? [action.targetUid ?? -1]);
  return {
    kind: type === 'range' ? 'arrow' : 'bolt',
    targetUids,
    hits: damage.hits,
  };
};

/**
 * Where shots leave from, nearest first: the centre of the card being
 * dragged, else of the held card in the hand, else your portrait. Read
 * as the card is released, so it is still where you let go of it.
 */
const SHOT_ORIGINS = [
  DRAGGED_CARD_ATTR,
  HELD_CARD_ATTR,
  VILLAIN_ANCHOR_ATTR,
] as const;

/** The centre of the first shot origin on screen, or null. */
const launchPoint = (): Point | null => {
  const rect = SHOT_ORIGINS.map((attr) => document.querySelector(`[${attr}]`))
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
  const nextIdRef = useRef(0);

  /**
   * Looses a card's shots, hit by hit (each hit at every target), and
   * returns true if any flew (false when nothing could be placed).
   */
  const fire = useCallback((plan: ShotPlan): boolean => {
    const from = launchPoint();
    if (!from) return false;
    const aims = Array.from(
      { length: plan.hits },
      () => plan.targetUids
    ).flat();
    const flights = aims.flatMap((uid, index): ProjectileFlight[] => {
      const to = bodyPointOf(uid);
      if (!to) return [];
      const id = nextIdRef.current++;
      return [
        { id, kind: plan.kind, from, to, delayMs: index * HIT_STAGGER_MS },
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

  return { shots, fire } as const;
};
