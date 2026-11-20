// ===================================================================
// USE DAILY GAME
// Loads the player's state for this post (day, best score, streak) and
// exposes submitScore. All server calls go through apiClient.
// ===================================================================

import { useCallback, useEffect, useState } from 'react';
import type { InitResponse, SubmitScoreResponse } from '../../shared/types/api';
import { apiClient } from '../lib/apiClient';

// --- TYPES ---
type DailyGameState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: InitResponse };

// --- HOOK ---
/** Returns the current game state and an action to save a finished run. */
export const useDailyGame = () => {
  const [state, setState] = useState<DailyGameState>({ status: 'loading' });

  // LOAD INITIAL STATE ONCE PER MOUNT
  useEffect(() => {
    apiClient
      .init()
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) =>
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to load',
        })
      );
  }, []);

  /** Saves a score and merges the server's answer into local state. */
  const submitScore = useCallback(
    async (score: number): Promise<SubmitScoreResponse> => {
      const result = await apiClient.submitScore({ score });
      setState((previous) =>
        previous.status === 'ready'
          ? {
              status: 'ready',
              data: {
                ...previous.data,
                bestScoreToday: result.bestScoreToday,
                streak: result.streak,
              },
            }
          : previous
      );
      return result;
    },
    []
  );

  return { state, submitScore } as const;
};
