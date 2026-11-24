// ===================================================================
// USE FALLEN HEROES
// The engine removes a hero the moment it dies, so it would just vanish.
// This hook keeps each fallen hero around as a "ghost" (its last known
// state, at 0 HP) while its death animation plays in its spot (longer
// for a boss). Ghosts are display only: no taps, no targeting.
// ===================================================================

import { useEffect, useState } from 'react';
import type { HeroUnit } from '../../shared/game/types';
import { isBoss } from '../content/heroLooks';

// --- CONSTANTS ---
/** How long a death plays (matches --animate-hero-death). */
export const HERO_DEATH_MS = 520;
/** How long a boss's death plays (matches --animate-boss-death). */
export const BOSS_DEATH_MS = 1800;

// --- TYPES ---
type Fallen = { lastHeroes: readonly HeroUnit[]; ghosts: HeroUnit[] };

// --- HELPERS ---
/** Heroes in `before` that are gone from `after`, at 0 HP. */
const newlyFallen = (
  before: readonly HeroUnit[],
  after: readonly HeroUnit[]
): HeroUnit[] =>
  before
    .filter((unit) => !after.some((alive) => alive.uid === unit.uid))
    .map((unit) => ({ ...unit, hp: 0, guard: 0 }));

/** How long one hero's death plays. */
const deathMsOf = (unit: HeroUnit): number =>
  isBoss(unit) ? BOSS_DEATH_MS : HERO_DEATH_MS;

// --- HOOK ---
/** Returns the heroes whose death animation is playing right now. */
export const useFallenHeroes = (heroes: readonly HeroUnit[]): HeroUnit[] => {
  const [fallen, setFallen] = useState<Fallen>({
    lastHeroes: heroes,
    ghosts: [],
  });

  // The horde changed: add ghosts now ("adjust state while rendering"),
  // so the hero never blinks out for a frame before its ghost appears.
  let current = fallen;
  if (fallen.lastHeroes !== heroes) {
    const dead = newlyFallen(fallen.lastHeroes, heroes);
    current = { lastHeroes: heroes, ghosts: [...fallen.ghosts, ...dead] };
    setFallen(current);
  }

  // EACH GHOST LEAVES WHEN ITS ANIMATION ENDS
  // (all at once, after the longest death among them)
  const ghostUids = current.ghosts.map((unit) => unit.uid).join(',');
  const longestDeathMs = Math.max(0, ...current.ghosts.map(deathMsOf));
  useEffect(() => {
    if (!ghostUids) return;
    const timer = window.setTimeout(
      () => setFallen((state) => ({ ...state, ghosts: [] })),
      longestDeathMs
    );
    return () => window.clearTimeout(timer);
  }, [ghostUids, longestDeathMs]);

  return current.ghosts;
};
