// ===================================================================
// USE BOSS ENTRANCE
// Notices a boss taking the field for the first time and plays its
// entrance for BOSS_ENTRANCE_MS (see BossEntrance and the boss's own
// arrival in HeroOnField). A tap skips it: the overlay goes, and the
// boss's arrival jumps to its end.
// ===================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HeroUnit } from '../../shared/game/types';
import { BOSS_ENTRANCE_MS } from '../content/bossEntrances';
import { isBoss } from '../content/heroLooks';

// --- HOOK ---
/** The boss making its entrance now (or null), whether it was skipped, and skip(). */
export const useBossEntrance = (heroes: readonly HeroUnit[]) => {
  const seenRef = useRef(new Set<number>());
  const [entering, setEntering] = useState<HeroUnit | null>(null);
  const [isSkipped, setIsSkipped] = useState(false);

  // A BOSS UID NEVER SEEN BEFORE -> ITS ENTRANCE STARTS
  useEffect(() => {
    const newcomer = heroes.find(
      (unit) => isBoss(unit) && !seenRef.current.has(unit.uid)
    );
    heroes.forEach((unit) => seenRef.current.add(unit.uid));
    if (!newcomer) return;
    setEntering(newcomer);
    setIsSkipped(false);
  }, [heroes]);

  // THE ENTRANCE ENDS ON ITS OWN AFTER BOSS_ENTRANCE_MS
  useEffect(() => {
    if (!entering) return;
    const timer = window.setTimeout(() => setEntering(null), BOSS_ENTRANCE_MS);
    return () => window.clearTimeout(timer);
  }, [entering]);

  /** Ends the entrance now (a tap on it). */
  const skip = useCallback(() => {
    setEntering(null);
    setIsSkipped(true);
  }, []);

  return { entering, isSkipped, skip } as const;
};
