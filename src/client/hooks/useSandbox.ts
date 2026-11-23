// ===================================================================
// USE SANDBOX
// Holds a target-dummy practice fight. Unlike useRun, nothing is saved
// or sent to the server: the fight lives only while the view is open.
// ===================================================================

import { useCallback, useReducer } from 'react';
import type { RunAction } from '../../shared/game/run';
import { createSandbox, sandboxReducer } from '../../shared/game/sandbox';
import type { CombatState } from '../../shared/game/types';

// --- TYPES ---
/** The fight plus a count of reshuffles (used as the view's key). */
type SandboxState = { combat: CombatState; round: number };

type SandboxEvent =
  { type: 'act'; action: RunAction } | { type: 'reshuffle'; seed: number };

// --- HELPERS ---
/** A fresh seed; practice fights don't need to be reproducible. */
const freshSeed = (): number => Math.floor(Math.random() * 2 ** 32);

// --- REDUCER ---
/** Routes combat inputs to the engine; other run actions are ignored. */
const reduce = (state: SandboxState, event: SandboxEvent): SandboxState => {
  if (event.type === 'reshuffle')
    return { combat: createSandbox(event.seed), round: state.round + 1 };
  const { action } = event;
  const isCombatInput =
    action.type === 'playCard' ||
    action.type === 'endTurn' ||
    action.type === 'charge';
  if (!isCombatInput) return state;
  return { ...state, combat: sandboxReducer(state.combat, action) };
};

// --- HOOK ---
/** Returns the practice fight and functions to act or reroll the dummies. */
export const useSandbox = () => {
  const [state, send] = useReducer(reduce, null, () => ({
    combat: createSandbox(freshSeed()),
    round: 0,
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

  return { ...state, act, reshuffle } as const;
};
