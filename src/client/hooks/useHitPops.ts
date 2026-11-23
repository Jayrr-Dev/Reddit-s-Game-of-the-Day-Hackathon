// ===================================================================
// USE HIT POPS
// Watches the heroes' HP and, whenever one drops, adds a "pop" (the
// damage dealt) that the screen shows as a big number for a moment.
// Pops clear themselves after HIT_POP_MS.
// ===================================================================

import { useEffect, useRef, useState } from 'react';
import type { HeroUnit } from '../../shared/game/types';

// --- TYPES ---
export type HitPop = { id: number; uid: number; amount: number };

// --- CONSTANTS ---
/** How long a damage number stays on screen (matches --animate-hit-pop). */
const HIT_POP_MS = 900;

// --- HELPERS ---
/** HP lost by each hero since the last look (fallen heroes count too). */
const damageSince = (
  before: ReadonlyMap<number, number>,
  heroes: readonly HeroUnit[]
): { uid: number; amount: number }[] =>
  [...before].flatMap(([uid, oldHp]) => {
    const newHp = heroes.find((unit) => unit.uid === uid)?.hp ?? 0;
    return newHp < oldHp ? [{ uid, amount: oldHp - newHp }] : [];
  });

// --- HOOK ---
/** Returns the damage numbers to show right now. */
export const useHitPops = (heroes: readonly HeroUnit[]): HitPop[] => {
  const [pops, setPops] = useState<HitPop[]>([]);
  const lastHpRef = useRef(new Map(heroes.map((unit) => [unit.uid, unit.hp])));
  const nextIdRef = useRef(0);

  // HP CHANGES -> NEW POPS (side effect: timers that remove them)
  useEffect(() => {
    const hits = damageSince(lastHpRef.current, heroes);
    lastHpRef.current = new Map(heroes.map((unit) => [unit.uid, unit.hp]));
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
  }, [heroes]);

  return pops;
};
