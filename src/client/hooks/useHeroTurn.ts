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
import {
  humanoidLookOf,
  MELEE_SWINGS,
  type HeroAction,
} from '../content/heroLooks';

// --- TYPES ---
/** One beat of playback: an engine step, or a signature's charge-up. */
type Beat = TurnStep & { isCharge?: boolean };
type Playback = { steps: Beat[]; index: number };

// --- CONSTANTS ---
/** Gap between one hero's attack starting and the next one's (ms). */
const HERO_STAGGER_MS = 200;
/** How long one attack animation runs (matches --animate-hero-lunge). */
export const HERO_ATTACK_MS = 560;
/**
 * A signature move first charges up for this long (nothing lands yet),
 * then fires like any other move. Matches the halo charge in index.css.
 */
export const SIGNATURE_CHARGE_MS = 900;
/** Upkeep at the start is a quick beat. */
const QUIET_BEAT_MS = 150;

// --- HELPERS ---
/**
 * How long to hold a beat before the next one. The last hero's beat
 * waits for its attack to finish before the new turn starts.
 */
const beatMs = (steps: readonly Beat[], index: number): number => {
  const step = steps[index];
  const next = steps[index + 1];
  if (!step || step.actorUid === null) return QUIET_BEAT_MS;
  if (step.isCharge) return SIGNATURE_CHARGE_MS;
  return next && next.actorUid !== null ? HERO_STAGGER_MS : HERO_ATTACK_MS;
};

/**
 * How one hero's move animates. The melee swing turns with the hero and
 * the turn number, so a hero never swings the same way twice in a row
 * and neighbours swinging together differ. An archer forced into Melee
 * (a Range attack made up close) still looks like it shoots point-blank.
 */
const actionOf = (step: TurnStep, uid: number): HeroAction => {
  const unit = step.state.heroes.find((hero) => hero.uid === uid);
  const isBowman = unit && humanoidLookOf(unit.heroId)?.prop === 'longbow';
  const style = step.attackType ?? 'support';
  return {
    style: isBowman && style === 'melee' ? 'range' : style,
    swing:
      MELEE_SWINGS[(uid + step.state.turn) % MELEE_SWINGS.length] ?? 'slash',
    isSignature: step.move?.isSignature ?? false,
  };
};

/**
 * Heroes whose move is still playing at beat `index` (they overlap),
 * each with how it animates: its attack type, or 'support' for a move
 * with no attack (Shroud, heal, Wrath, debuffs).
 */
const actingAt = (
  steps: readonly TurnStep[],
  index: number
): ReadonlyMap<number, HeroAction> => {
  const overlap = Math.ceil(HERO_ATTACK_MS / HERO_STAGGER_MS);
  return new Map(
    steps
      .slice(Math.max(0, index - overlap + 1), index + 1)
      .flatMap((step) =>
        step.actorUid === null
          ? []
          : [[step.actorUid, actionOf(step, step.actorUid)] as const]
      )
  );
};

/**
 * Puts a charge-up beat before every signature move: the hero is already
 * acting (its halo gathers light) but the field still shows the state
 * from before the move, so the damage lands when the move fires.
 */
const withSignatureCharges = (steps: readonly TurnStep[]): Beat[] =>
  steps.flatMap((step, index): Beat[] => {
    const before = steps[index - 1];
    if (!step.move?.isSignature || !before) return [step];
    const charge: Beat = {
      ...step,
      attackType: null,
      state: before.state,
      isCharge: true,
    };
    return [charge, step];
  });

/** Nobody acting (shared so the empty case keeps one identity). */
const NOBODY_ACTING: ReadonlyMap<number, HeroAction> = new Map();

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
    setPlayback({ steps: withSignatureCharges(steps), index: 0 });
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
