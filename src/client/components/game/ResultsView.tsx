// ===================================================================
// RESULTS VIEW
// The end of a run: how far the villain got, the verified score, the
// player's rank, and a way to keep practising.
// ===================================================================

import { computeScore, type RunStats } from '../../../shared/game/run';
import type { LeaderboardEntry } from '../../../shared/types/api';
import { fallenLine } from '../../content/lore';
import type { RunSubmission } from '../../hooks/useRunSubmission';
import { LeaderboardList } from '../LeaderboardList';
import { Button } from '../ui/Button';
import { Glyph } from '../ui/Glyph';
import { StatTile } from '../ui/StatTile';

// --- TYPES ---
export type ResultsViewProps = {
  stats: RunStats;
  submission: RunSubmission;
  entries: LeaderboardEntry[];
  onPlayAgain: () => void;
};

// --- HELPERS ---
/** One line on what happened to the score. */
const submissionNote = (submission: RunSubmission): string => {
  switch (submission.status) {
    case 'idle':
    case 'saving':
      return 'Carving your deeds into the record…';
    case 'error':
      return `Could not save: ${submission.message}`;
    case 'saved': {
      const { result } = submission;
      if (!result.isRanked) return 'Practice run. Your ranked score stands.';
      return result.rank ? `Ranked #${result.rank} today.` : 'Score saved.';
    }
  }
};

// --- COMPONENT ---
/** Renders the end-of-run screen. */
export const ResultsView = ({
  stats,
  submission,
  entries,
  onPlayAgain,
}: ResultsViewProps) => (
  <main className="flex min-h-screen flex-col items-center gap-4 p-4 animate-rise">
    <Glyph name="skull" className="mt-4 size-12 text-blood" />
    <h1 className="font-display text-3xl font-black text-accent">
      The heroes prevail… for now
    </h1>
    <p className="text-center font-display italic">
      {fallenLine(stats.regionsConquered)}
    </p>
    <p className="font-display text-4xl font-black">{computeScore(stats)}</p>
    <div className="flex flex-wrap justify-center gap-2">
      <StatTile label="Waves" value={stats.wavesCleared} />
      <StatTile label="Heroes slain" value={stats.heroesSlain} />
      <StatTile label="Regions" value={stats.regionsConquered} />
    </div>
    <p className="text-sm text-ink-muted">{submissionNote(submission)}</p>
    <Button onClick={onPlayAgain}>March again (practice)</Button>
    <section className="flex w-full max-w-xs flex-col items-center gap-2">
      <h2 className="font-display text-sm font-bold text-ink-muted">
        Today's tyrants
      </h2>
      <LeaderboardList entries={entries} />
    </section>
    <p className="text-xs text-ink-muted">
      A new horde marches at midnight UTC.
    </p>
  </main>
);
