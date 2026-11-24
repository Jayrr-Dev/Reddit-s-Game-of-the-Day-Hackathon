// ===================================================================
// USE HERO TURN
// Plays the heroes' turn out one hero at a time. The engine resolves a
// whole turn at once; endTurnSteps() also returns every beat in
// between, so when you press End Turn this hook shows those beats in
// order, staggered: each hero starts its attack a moment after the one
// before, so attacks overlap but the speed order still reads. Only then
// does it send the real endTurn action. The final beat is exactly the
// state the engine (and the server's replay) ends on.
// ===================================================================

import { useCallback, useEffect, useState } from 'react';
import { endTurnSteps, type TurnStep } from '../../shared/game/combat';
import type { RunAction } from '../../shared/game/run';
import type { CombatState } from '../../shared/game/types';
import type { HeroActionStyle } from '../content/heroLooks';

// --- TYPES ---
type Playback = { steps: TurnStep[]; index: number };

// --- CONSTANTS ---
/** Gap between one hero's attack starting and the next one's (ms). */
const HERO_STAGGER_MS = 200;
/** How long one attack animation runs (matches --animate-hero-lunge). */
export const HERO_ATTACK_MS = 420;
/** Upkeep at the start is a quick beat. */
const QUIET_BEAT_MS = 150;

// --- HELPERS ---
/**
 * How long to hold a beat before the next one. The last hero's beat
 * waits for its attack to finish before the new turn starts.
 */
const beatMs = (steps: readonly TurnStep[], index: number): number => {
  const step = steps[index];
  const next = steps[index + 1];
  if (!step || step.actorUid === null) return QUIET_BEAT_MS;
  return next && next.actorUid !== null ? HERO_STAGGER_MS : HERO_ATTACK_MS;
};

/**
 * Heroes whose move is still playing at beat `index` (they overlap),
 * each with how it animates: its attack type, or 'support' for a move
 * with no attack (Shroud, heal, Wrath, debuffs).
 */
const actingAt = (
  steps: readonly TurnStep[],
  index: number
): ReadonlyMap<number, HeroActionStyle> => {
  const overlap = Math.ceil(HERO_ATTACK_MS / HERO_STAGGER_MS);
  return new Map(
    steps
      .slice(Math.max(0, index - overlap + 1), index + 1)
      .flatMap(({ actorUid, attackType }) =>
        actorUid === null ? [] : [[actorUid, attackType ?? 'support'] as const]
      )
  );
};

/** Nobody acting (shared so the empty case keeps one identity). */
const NOBODY_ACTING: ReadonlyMap<number, HeroActionStyle> = new Map();

// --- HOOK ---
/**
 * Returns the combat state to draw (a beat of the hero turn while one
 * plays, otherwise the real state), the heroes attacking now, whether
 * a turn is playing, and endTurn() to start one.
 */
export const useHeroTurn = (
  combat: CombatState,
  onAction: (action: RunAction) => void
) => {
  const [playback, setPlayback] = useState<Playback | null>(null);
  const step = playback?.steps[playback.index];

  // NEXT BEAT AFTER A PAUSE; AFTER THE LAST ONE, COMMIT THE REAL ACTION
  useEffect(() => {
    if (!playback || !step) return;
    const isLast = playback.index >= playback.steps.length - 1;
    const timer = window.setTimeout(
      () => {
        if (isLast) {
          onAction({ type: 'endTurn' });
          setPlayback(null);
          return;
        }
        setPlayback({ ...playback, index: playback.index + 1 });
      },
      beatMs(playback.steps, playback.index)
    );
    return () => window.clearTimeout(timer);
  }, [playback, step, onAction]);

  /** Starts playing the heroes' turn (ignored while one is playing). */
  const endTurn = useCallback(() => {
    if (playback) return;
    const steps = endTurnSteps(combat);
    if (steps.length === 0) return;
    setPlayback({ steps, index: 0 });
  }, [combat, playback]);

  return {
    shown: step?.state ?? combat,
    /** Heroes moving right now, each with its animation style. */
    acting: playback ? actingAt(playback.steps, playback.index) : NOBODY_ACTING,
    /** How the attack on screen right now lands (it colours your hits). */
    attackType: step?.attackType ?? null,
    isPlaying: playback !== null,
    endTurn,
  } as const;
};
