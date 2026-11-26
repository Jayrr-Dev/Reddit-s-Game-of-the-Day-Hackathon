// ===================================================================
// USE CARD HITS
// Lets a multi-hit card land one hit at a time. The engine resolves a
// card in one go; playCardSteps() also returns the state after each
// hit, so this hook shows those beats a moment apart (each one pops its
// own number) and only then sends the real playCard action. A single
// hit that fells nobody goes straight through with no delay; one that
// fells a hero shows its beat first, so the full blow (overkill and
// all) pops before the hero leaves the field.
// ===================================================================

import { useCallback, useEffect, useState } from 'react';
import { playCardSteps } from '../../shared/game/combat';
import { didShockBurst, isDefeated } from '../../shared/game/combatant';
import type { PlayCardAction, RunAction } from '../../shared/game/run';
import type { CombatState } from '../../shared/game/types';

// --- TYPES ---
type Playback = {
  action: PlayCardAction;
  /** The beats before the real result (that one comes from the commit). */
  beats: CombatState[];
  index: number;
};

// --- CONSTANTS ---
/** Gap between one hit landing and the next (ms). Quick, so it stays snappy. */
export const HIT_STAGGER_MS = 180;
/** Gap before a Shock goes off (ms): longer, so a Shock chain reads bolt by bolt. */
const SHOCK_STAGGER_MS = 360;

/** Leave the final damage number visible before the victory screen replaces combat. */
const isLastLethalBeat = ({ beats, index }: Playback): boolean => {
  const heroes = beats[index]?.heroes;
  return index === beats.length - 1 && !!heroes?.length && heroes.every(isDefeated);
};

/** True when the beat after this one sets off a hero's Shock (a chain link). */
const isShockNext = ({ beats, index }: Playback): boolean => {
  const now = beats[index];
  const next = beats[index + 1];
  if (!now || !next) return false;
  return next.heroes.some((unit) => {
    const old = now.heroes.find((hero) => hero.uid === unit.uid);
    return old !== undefined && didShockBurst(old, unit);
  });
};

/** How long this beat holds before the next one (or the commit). */
const holdMsOf = (playback: Playback): number => {
  if (isLastLethalBeat(playback)) return 1400;
  return isShockNext(playback) ? SHOCK_STAGGER_MS : HIT_STAGGER_MS;
};

// --- HOOK ---
/**
 * Returns the state to draw (a hit beat while one plays, else the real
 * state), whether hits are playing, and playCard() to start one.
 */
export const useCardHits = (
  combat: CombatState,
  onAction: (action: RunAction) => void
) => {
  const [playback, setPlayback] = useState<Playback | null>(null);
  const beat = playback?.beats[playback.index];

  // NEXT HIT AFTER A BEAT; AFTER THE LAST ONE, COMMIT THE REAL PLAY
  useEffect(() => {
    if (!playback) return;
    const timer = window.setTimeout(() => {
      const isLast = playback.index >= playback.beats.length - 1;
      if (isLast) {
        onAction(playback.action);
        setPlayback(null);
        return;
      }
      setPlayback({ ...playback, index: playback.index + 1 });
    }, holdMsOf(playback));
    return () => window.clearTimeout(timer);
  }, [playback, onAction]);

  /** Plays a card: hit by hit when it has several, otherwise at once. */
  const playCard = useCallback(
    (action: PlayCardAction) => {
      if (playback) return;
      const steps = playCardSteps(
        combat,
        action.handIndex,
        action.targetUid,
        action.targetUids,
        action.imbueIndex
      );
      const beats = steps.slice(0, -1);
      const fellsSomeone = beats.some((beat) =>
        beat.heroes.some((unit) => isDefeated(unit))
      );
      if (beats.length <= 1 && !fellsSomeone) {
        onAction(action);
        return;
      }
      setPlayback({ action, beats, index: 0 });
    },
    [combat, playback, onAction]
  );

  return {
    shown: beat ?? combat,
    strikeIndex: playback?.index ?? 0,
    isPlaying: playback !== null,
    playCard,
  } as const;
};
