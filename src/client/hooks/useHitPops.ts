// ===================================================================
// USE HIT POPS
// Watches HP and shroud and, whenever someone is hit, adds a "pop" that
// floats over them for a moment: the HP lost, and the part their shroud
// blocked. Two hooks share the same rules:
//   useHitPops     every hero, each pop placed over that hero's body
//   usePlayerHits  the villain (drawn over the portrait)
// Pops clear themselves after HIT_POP_MS.
// ===================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Combatant, HeroUnit } from '../../shared/game/types';
import { HERO_ANCHOR_ATTR, HERO_UID_ATTR, type Point } from './useCardDrag';

// --- TYPES ---
/** What one hit did: HP lost and damage the shroud soaked up. */
export type Hit = { amount: number; blocked: number };

/** A hit on screen (id keys it while it floats). */
export type PlayerHitPop = Hit & { id: number };

export type HitPop = PlayerHitPop & {
  uid: number;
  /** Where on screen (viewport px) the hero's body was when hit. */
  point: Point;
};

/** What we remember about a hero between looks. */
type HeroLook = { hp: number; shroud: number; point: Point | null };

// --- CONSTANTS ---
/** How long a damage number stays on screen (matches --animate-hit-pop). */
const HIT_POP_MS = 1400;
const UNHURT = { hp: 0, shroud: 0 };

// --- HELPERS ---
/**
 * The hit between two looks, or null if there was none. Lost HP is
 * plain; lost shroud counts as blocked only when `countsBlocked` (shroud
 * also fades on its own at turn changes, which is not a hit).
 */
const hitBetween = (
  before: { hp: number; shroud: number },
  after: { hp: number; shroud: number },
  countsBlocked: boolean
): Hit | null => {
  const amount = Math.max(0, before.hp - after.hp);
  const shroudLost = Math.max(0, before.shroud - after.shroud);
  const blocked = countsBlocked ? shroudLost : 0;
  return amount > 0 || blocked > 0 ? { amount, blocked } : null;
};

/** The middle of a hero's drawn body, or null if it is not on screen. */
const bodyPointOf = (uid: number): Point | null => {
  const body = document.querySelector(
    `[${HERO_UID_ATTR}="${uid}"] [${HERO_ANCHOR_ATTR}]`
  );
  if (!body) return null;
  const rect = body.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.4 };
};

/** Snapshots every hero, keeping the last known point of fallen ones. */
const lookAt = (
  heroes: readonly HeroUnit[],
  before: ReadonlyMap<number, HeroLook>
): Map<number, HeroLook> =>
  new Map(
    heroes.map((unit) => [
      unit.uid,
      {
        hp: unit.hp,
        shroud: unit.shroud,
        point: bodyPointOf(unit.uid) ?? before.get(unit.uid)?.point ?? null,
      },
    ])
  );

/** Hero hits since the last look (a fallen hero counts as 0 HP). */
const heroHitsSince = (
  before: ReadonlyMap<number, HeroLook>,
  heroes: readonly HeroUnit[],
  countsBlocked: boolean
): Omit<HitPop, 'id'>[] =>
  [...before].flatMap(([uid, old]) => {
    const now = heroes.find((unit) => unit.uid === uid) ?? UNHURT;
    const hit = hitBetween(old, now, countsBlocked);
    const point = bodyPointOf(uid) ?? old.point;
    return hit && point ? [{ ...hit, uid, point }] : [];
  });

// --- SHARED HOOK ---
/** A list of pops that each remove themselves after HIT_POP_MS. */
const usePopQueue = <T extends object>() => {
  const [pops, setPops] = useState<(T & { id: number })[]>([]);
  const nextIdRef = useRef(0);

  /** Shows new pops; each leaves on its own timer. */
  const add = useCallback((fresh: readonly T[]) => {
    const keyed = fresh.map((pop) => ({ ...pop, id: nextIdRef.current++ }));
    setPops((current) => [...current, ...keyed]);
    const ids = keyed.map((pop) => pop.id);
    // No cleanup on purpose: a newer hit must not cancel this removal.
    window.setTimeout(
      () =>
        setPops((current) => current.filter((pop) => !ids.includes(pop.id))),
      HIT_POP_MS
    );
  }, []);

  return [pops, add] as const;
};

// --- HOOKS ---
/**
 * The damage numbers to show over heroes right now. `isHeroTurn` is
 * true while the heroes' turn plays out: heroes can't be struck then,
 * and their shroud fading is not a block.
 */
export const useHitPops = (
  heroes: readonly HeroUnit[],
  turn: number,
  isHeroTurn: boolean
): HitPop[] => {
  const [pops, add] = usePopQueue<Omit<HitPop, 'id'>>();
  const lastLookRef = useRef(new Map<number, HeroLook>());
  const lastTurnRef = useRef(turn);

  // HERO CHANGES -> NEW POPS
  useEffect(() => {
    const countsBlocked = lastTurnRef.current === turn && !isHeroTurn;
    const hits = heroHitsSince(lastLookRef.current, heroes, countsBlocked);
    lastLookRef.current = lookAt(heroes, lastLookRef.current);
    lastTurnRef.current = turn;
    if (hits.length > 0) add(hits);
  }, [heroes, turn, isHeroTurn, add]);

  return pops;
};

/** The damage numbers to show over the villain right now. */
export const usePlayerHits = (
  player: Combatant,
  turn: number
): PlayerHitPop[] => {
  const [pops, add] = usePopQueue<Hit>();
  const lastRef = useRef({ hp: player.hp, shroud: player.shroud, turn });

  // VILLAIN CHANGES -> NEW POPS
  useEffect(() => {
    const last = lastRef.current;
    const hit = hitBetween(last, player, last.turn === turn);
    lastRef.current = { hp: player.hp, shroud: player.shroud, turn };
    if (hit) add([hit]);
  }, [player, turn, add]);

  return pops;
};
