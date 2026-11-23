// ===================================================================
// LEADERBOARD LIST
// Displays today's top scores. Purely presentational: data comes in
// through props from useLeaderboard.
// ===================================================================

import type { LeaderboardEntry } from '../../shared/types/api';

export type LeaderboardListProps = {
  entries: LeaderboardEntry[];
  /** Show only the first N rows, so the list fits the inline post. */
  limit?: number;
};

/** Renders the ranked list, or an empty-state message. */
export const LeaderboardList = ({ entries, limit }: LeaderboardListProps) => {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-ink-muted">
        No scores yet. Be the first today.
      </p>
    );
  }

  return (
    <ol className="w-full max-w-xs divide-y divide-surface-raised">
      {entries.slice(0, limit).map((entry) => (
        <li
          key={entry.username}
          className="flex justify-between py-0.5 text-xs"
        >
          <span>
            {entry.rank}. u/{entry.username}
          </span>
          <span className="font-semibold">{entry.score}</span>
        </li>
      ))}
    </ol>
  );
};
