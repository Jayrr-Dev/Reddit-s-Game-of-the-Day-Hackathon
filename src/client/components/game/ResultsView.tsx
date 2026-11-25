// ===================================================================
// RESULTS VIEW
// The end of a run: how far the villain got, the verified score, the
// player's rank, and a way to keep practising.
// ===================================================================

import { LEADERBOARD_PREVIEW_ROWS } from '../../../shared/constants/game';
import { computeScore, type RunStats } from '../../../shared/game/run';
import type { LeaderboardEntry } from '../../../shared/types/api';
import type { RunSubmission } from '../../hooks/useRunSubmission';
import { LeaderboardList } from '../LeaderboardList';
import { Button } from '../ui/Button';
import { StatTile } from '../ui/StatTile';
import { RingUnlockNotice } from './RingUnlockNotice';

// --- TYPES ---
export type ResultsViewProps = {
  stats: RunStats;
  ringDrops?: readonly number[] | undefined;
  submission: RunSubmission;
  entries: LeaderboardEntry[];
  onPlayAgain: () => void;
  /** Returns to the title screen. */
  onBackToMenu: () => void;
};

// --- HELPERS ---
/** One line on what happened to the score. */
const submissionNote = (submission: RunSubmission): string => {
  switch (submission.status) {
    case 'idle': return '';
    case 'saving':
      return 'Carving your deeds into the record…';
    case 'error':
      return `Could not save: ${submission.message}`;
    case 'saved': {
      const { result } = submission;
      if (!result.isRanked) return '';
      return result.rank ? `Ranked #${result.rank} today.` : 'Score saved.';
    }
  }
};

// --- COMPONENT ---
/** Renders the end-of-run screen; everything fits the 512 px inline post. */
export const ResultsView = ({
  stats,
  ringDrops = [],
  submission,
  entries,
  onPlayAgain,
  onBackToMenu,
}: ResultsViewProps) => {
  const note = submissionNote(submission);

  return (
    <main className="run-results results-layout">
      <header>
        <h1>Conquest results</h1>
        <p className="results-score">{computeScore(stats).toLocaleString('en')} <span>pts</span></p>
        {note && <p role="status" className="text-xs text-ink-muted">{note}</p>}
      </header>
      <div className="results-stats">
        <StatTile label="Waves" value={stats.wavesCleared} />
        <StatTile label="Heroes slain" value={stats.heroesSlain} />
        <StatTile label="Regions" value={stats.regionsConquered} />
      </div>
      <RingUnlockNotice slots={ringDrops} />
      <div className="results-actions">
        <Button variant="menuPrimary" onClick={onPlayAgain}>Start new conquest</Button>
        <Button variant="menu" onClick={onBackToMenu}>Main menu</Button>
      </div>
      {entries.length > 0 && (
        <details className="results-board">
          <summary>Today's leaderboard</summary>
          <LeaderboardList entries={entries} limit={LEADERBOARD_PREVIEW_ROWS} />
        </details>
      )}
    </main>
  );
};