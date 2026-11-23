// ===================================================================
// USE RUN
// Holds the run in progress. The run state itself is derived by the
// shared pure reducer; this hook only keeps the action log next to it
// (the server needs the log) and saves the log locally so closing the
// post mid-run doesn't lose the ranked attempt.
// ===================================================================

import { useCallback, useEffect, useReducer } from 'react';
import {
  createRun,
  isRunAction,
  replayRun,
  runReducer,
  type RunAction,
  type RunState,
} from '../../shared/game/run';

// --- TYPES ---
type LoggedRun = { run: RunState; actions: RunAction[] };

type LoggedRunEvent =
  { type: 'act'; action: RunAction } | { type: 'restart'; dailyKey: string };

// --- REDUCER ---
/** Applies an action and logs it, skipping actions the engine ignores. */
const loggedRunReducer = (
  state: LoggedRun,
  event: LoggedRunEvent
): LoggedRun => {
  if (event.type === 'restart')
    return { run: createRun(event.dailyKey), actions: [] };
  const run = runReducer(state.run, event.action);
  // An ignored action returns the same object; keep it out of the log.
  return run === state.run
    ? state
    : { run, actions: [...state.actions, event.action] };
};

// --- LOCAL SAVE ---
const saveKey = (dailyKey: string) => `villain-arc:run:${dailyKey}`;

/** Reads a saved action log; any storage problem just means "no save". */
const loadSavedActions = (dailyKey: string): RunAction[] => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(saveKey(dailyKey)) ?? '[]'
    );
    return Array.isArray(parsed) ? parsed.filter(isRunAction) : [];
  } catch {
    return [];
  }
};

/** Writes the action log; storage can be unavailable in some webviews. */
const saveActions = (dailyKey: string, actions: RunAction[]): void => {
  try {
    localStorage.setItem(saveKey(dailyKey), JSON.stringify(actions));
  } catch {
    // Saving is a convenience; the run continues without it.
  }
};

/** Rebuilds a run from the local save, if any. */
const restoreRun = (dailyKey: string): LoggedRun => {
  const actions = loadSavedActions(dailyKey);
  return { run: replayRun(dailyKey, actions), actions };
};

// --- HOOK ---
/** Returns the current run, its action log, and functions to act or restart. */
export const useRun = (dailyKey: string) => {
  const [state, send] = useReducer(loggedRunReducer, dailyKey, restoreRun);

  // KEEP THE LOCAL SAVE IN STEP WITH THE LOG
  useEffect(
    () => saveActions(dailyKey, state.actions),
    [dailyKey, state.actions]
  );

  /** Sends one player action to the engine. */
  const act = useCallback(
    (action: RunAction) => send({ type: 'act', action }),
    []
  );

  /** Throws away the current run and starts the day over. */
  const restart = useCallback(
    () => send({ type: 'restart', dailyKey }),
    [dailyKey]
  );

  return {
    run: state.run,
    actions: state.actions,
    hasProgress: state.actions.length > 0,
    act,
    restart,
  } as const;
};
