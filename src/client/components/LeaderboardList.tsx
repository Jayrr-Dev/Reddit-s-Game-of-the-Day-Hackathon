// ===================================================================
// LEADERBOARD LIST
// Displays today's top scores. Purely presentational: data comes in
// through props from useLeaderboard.
// ===================================================================

import type { LeaderboardEntry } from '../../shared/types/api';

export type LeaderboardListProps = {
  entries: LeaderboardEntry[];
};

/** Renders the ranked list, or an empty-state message. */
export const LeaderboardList = ({ entries }: LeaderboardListProps) => {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No scores yet. Be the first today.
      </p>
    );
  }

  return (
    <ol className="w-full max-w-xs divide-y divide-surface-raised">
      {entries.map((entry) => (
        <li key={entry.username} className="flex justify-between py-1 text-sm">
          <span>
            {entry.rank}. u/{entry.username}
          </span>
          <span className="font-semibold">{entry.score}</span>
        </li>
      ))}
    </ol>
  );
};
