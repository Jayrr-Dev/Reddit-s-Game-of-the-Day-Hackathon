// ===================================================================
// USE DAILY GAME
// Loads the player's state for this post (day, best score, streak) and
// exposes the two run calls: start (claims the ranked run) and finish
// (sends the action log for the server to replay and score).
// ===================================================================

import { useCallback, useEffect, useState } from 'react';
import type { RunAction } from '../../shared/game/run';
import type { FinishRunResponse, InitResponse } from '../../shared/types/api';
import { setUnitOverrides } from '../../shared/game/unitOverrides';
import { apiClient } from '../lib/apiClient';

// --- TYPES ---
type DailyGameState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: InitResponse };

// --- HELPERS ---

/** Merges a finished run's results into the loaded player data. */
const mergeFinish = (
  data: InitResponse,
  result: FinishRunResponse
): InitResponse => ({
  ...data,
  bestScoreToday: result.bestScoreToday,
  streak: result.streak,
});

// --- HOOK ---
/** Returns the current game state plus actions to start and finish a run. */
export const useDailyGame = () => {
  const [state, setState] = useState<DailyGameState>({ status: 'loading' });

  // LOAD INITIAL STATE ONCE PER MOUNT
  useEffect(() => {
    apiClient
      .init()
      .then((data) => {
        // Before the run screen mounts, so a resumed run replays with them.
        setUnitOverrides(data.unitOverrides);
        setState({ status: 'ready', data });
      })
      .catch((error: unknown) =>
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to load',
        })
      );
  }, []);

  /** Claims a run with the server; returns true when it is the ranked run. */
  const startRun = useCallback(async (testVisit?: string) => {
    const response = await apiClient.startRun(testVisit);
    setState((previous) =>
      previous.status === 'ready' && response.isRanked
        ? {
            status: 'ready',
            data: { ...previous.data, hasStartedRankedRun: true },
          }
        : previous
    );
    return response;
  }, []);

  /** Sends the finished run's log and merges the server's answer. */
  const finishRun = useCallback(
    async (actions: RunAction[], runId?: string): Promise<FinishRunResponse> => {
      const result = await apiClient.finishRun({ actions, ...(runId && {runId}) });
      setState((previous) =>
        previous.status === 'ready'
          ? { status: 'ready', data: mergeFinish(previous.data, result) }
          : previous
      );
      return result;
    },
    []
  );

  return { state, startRun, finishRun } as const;
};
