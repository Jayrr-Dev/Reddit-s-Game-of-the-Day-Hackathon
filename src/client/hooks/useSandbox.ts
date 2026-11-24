// ===================================================================
// USE SANDBOX
// Holds a target-dummy practice fight. Unlike useRun, nothing is saved
// or sent to the server: the fight lives only while the view is open.
// ===================================================================

import { useCallback, useReducer } from 'react';
import type { RunAction } from '../../shared/game/run';
import type { HeroId } from '../../shared/game/heroes';
import {
  createSandbox,
  createSandboxWith,
  sandboxReducer,
} from '../../shared/game/sandbox';
import type { SandboxDeckId } from '../../shared/game/sandboxDecks';
import type { CombatState } from '../../shared/game/types';

// --- TYPES ---
/**
 * The fight, a count of reshuffles (used as the view's key), and the
 * test deck every new fight is dealt from.
 */
type SandboxState = {
  combat: CombatState;
  round: number;
  deckId: SandboxDeckId;
};

type SandboxEvent =
  | { type: 'act'; action: RunAction }
  | { type: 'reshuffle'; seed: number }
  | {
      type: 'summon';
      seed: number;
      heroIds: readonly HeroId[];
      startsInPlace: boolean;
    }
  | { type: 'deck'; seed: number; deckId: SandboxDeckId };

// --- HELPERS ---
/** A fresh seed; practice fights don't need to be reproducible. */
const freshSeed = (): number => Math.floor(Math.random() * 2 ** 32);

// --- REDUCER ---
/** Routes combat inputs to the engine; other run actions are ignored. */
const reduce = (state: SandboxState, event: SandboxEvent): SandboxState => {
  const { deckId, round } = state;
  if (event.type === 'reshuffle')
    return {
      combat: createSandbox(event.seed, deckId),
      round: round + 1,
      deckId,
    };
  if (event.type === 'summon')
    return {
      combat: createSandboxWith(
        event.seed,
        event.heroIds,
        event.startsInPlace,
        deckId
      ),
      round: round + 1,
      deckId,
    };
  if (event.type === 'deck') {
    // Same dummies, fresh fight dealt from the new deck.
    const heroIds = state.combat.heroes.map((unit) => unit.heroId);
    return {
      combat: createSandboxWith(event.seed, heroIds, false, event.deckId),
      round: round + 1,
      deckId: event.deckId,
    };
  }
  const { action } = event;
  const isCombatInput =
    action.type === 'playCard' ||
    action.type === 'endTurn' ||
    action.type === 'move';
  if (!isCombatInput) return state;
  return { ...state, combat: sandboxReducer(state.combat, action) };
};

// --- HOOK ---
/** Returns the practice fight and functions to act or reroll the dummies. */
export const useSandbox = () => {
  const [state, send] = useReducer(reduce, null, () => ({
    combat: createSandbox(freshSeed()),
    round: 0,
    deckId: 'all' as SandboxDeckId,
  }));

  /** Sends one combat input to the sandbox engine. */
  const act = useCallback(
    (action: RunAction) => send({ type: 'act', action }),
    []
  );

  /** Rolls a brand-new set of dummies and a fresh hand. */
  const reshuffle = useCallback(
    () => send({ type: 'reshuffle', seed: freshSeed() }),
    []
  );

  /**
   * Starts a fight against chosen heroes (e.g. a test creature), marched
   * in as usual or (startsInPlace) already in their home lines.
   */
  const summon = useCallback(
    (heroIds: readonly HeroId[], startsInPlace = false) =>
      send({ type: 'summon', seed: freshSeed(), heroIds, startsInPlace }),
    []
  );

  /** Deals a new fight from a themed test deck, against the same dummies. */
  const pickDeck = useCallback(
    (deckId: SandboxDeckId) =>
      send({ type: 'deck', seed: freshSeed(), deckId }),
    []
  );

  return { ...state, act, reshuffle, summon, pickDeck } as const;
};
