// ===================================================================
// USE HIT POPS
// Watches the heroes' HP and shroud and, whenever a hero is hit, adds a
// "pop" that floats over that hero for a moment: the HP it lost, and
// the part its shroud blocked. Pops clear themselves after HIT_POP_MS.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import type { HeroUnit } from '../../shared/game/types';
import { HERO_ANCHOR_ATTR, HERO_UID_ATTR, type Point } from './useCardDrag';

// --- TYPES ---
export type HitPop = {
  id: number;
  uid: number;
  /** HP lost. */
  amount: number;
  /** Damage the hero's shroud soaked up. */
  blocked: number;
  /** Where on screen (viewport px) the hero's body was when hit. */
  point: Point;
};

/** What we remember about a hero between looks. */
type HeroLook = { hp: number; shroud: number; point: Point | null };

// --- CONSTANTS ---
/** How long a damage number stays on screen (matches --animate-hit-pop). */
const HIT_POP_MS = 900;

// --- HELPERS ---
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

/**
 * Hits since the last look. Lost HP is plain; shroud that went down
 * counts as blocked only within the same turn, because a new turn
 * clears shroud by itself (that is not a hit). A fallen hero is gone
 * from `heroes`, so it counts as dropping to 0 HP and 0 shroud.
 */
const hitsSince = (
  before: ReadonlyMap<number, HeroLook>,
  heroes: readonly HeroUnit[],
  isSameTurn: boolean
): Omit<HitPop, 'id'>[] =>
  [...before].flatMap(([uid, old]) => {
    const now = heroes.find((unit) => unit.uid === uid);
    const amount = Math.max(0, old.hp - (now?.hp ?? 0));
    const shroudLost = Math.max(0, old.shroud - (now?.shroud ?? 0));
    const blocked = isSameTurn ? shroudLost : 0;
    const point = bodyPointOf(uid) ?? old.point;
    const isHit = amount > 0 || blocked > 0;
    return isHit && point ? [{ uid, amount, blocked, point }] : [];
  });

// --- HOOK ---
/** Returns the damage numbers to show right now. */
export const useHitPops = (
  heroes: readonly HeroUnit[],
  turn: number
): HitPop[] => {
  const [pops, setPops] = useState<HitPop[]>([]);
  const lastLookRef = useRef(new Map<number, HeroLook>());
  const lastTurnRef = useRef(turn);
  const nextIdRef = useRef(0);

  // HERO CHANGES -> NEW POPS (side effect: timers that remove them)
  useEffect(() => {
    const isSameTurn = lastTurnRef.current === turn;
    const hits = hitsSince(lastLookRef.current, heroes, isSameTurn);
    lastLookRef.current = lookAt(heroes, lastLookRef.current);
    lastTurnRef.current = turn;
    if (hits.length === 0) return;
    const fresh = hits.map((hit) => ({ ...hit, id: nextIdRef.current++ }));
    setPops((current) => [...current, ...fresh]);
    const freshIds = fresh.map((pop) => pop.id);
    // No cleanup on purpose: a newer hit must not cancel this removal.
    window.setTimeout(
      () =>
        setPops((current) =>
          current.filter((pop) => !freshIds.includes(pop.id))
        ),
      HIT_POP_MS
    );
  }, [heroes, turn]);

  return pops;
};
