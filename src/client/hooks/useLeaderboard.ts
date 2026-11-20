// ===================================================================
// USE LEADERBOARD
// Fetches today's leaderboard and exposes a refresh for after a run.
// ===================================================================

import { useCallback, useEffect, useState } from 'react';
import type { LeaderboardEntry } from '../../shared/types/api';
import { apiClient } from '../lib/apiClient';

// --- HELPERS ---

/** Fetches the entries; on failure logs and resolves to null (keep old list). */
const fetchEntries = (): Promise<LeaderboardEntry[] | null> =>
  apiClient
    .leaderboard()
    .then((response) => response.entries)
    .catch((error: unknown) => {
      console.warn('leaderboard fetch failed', error);
      return null;
    });

// --- HOOK ---
/** Returns the top entries and a function to reload them. */
export const useLeaderboard = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  /** Applies a fetch result, ignoring failures so the old list stays visible. */
  const applyEntries = useCallback((next: LeaderboardEntry[] | null) => {
    if (next) setEntries(next);
  }, []);

  /** Reloads the leaderboard from the server. */
  const refresh = useCallback(
    async () => applyEntries(await fetchEntries()),
    [applyEntries]
  );

  // INITIAL LOAD
  useEffect(() => {
    void fetchEntries().then(applyEntries);
  }, [applyEntries]);

  return { entries, refresh } as const;
};
