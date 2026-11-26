// ===================================================================
// LEADERBOARD LIST
// Displays today's top scores as a ranked board: medal badges for the
// top three, a crown on first place, and the viewer's own row picked
// out. Purely presentational: data comes in through props from
// useLeaderboard.
// ===================================================================

import type { LeaderboardEntry } from '../../shared/types/api';
import { Glyph } from './ui/Glyph';

// --- TYPES ---
export type LeaderboardListProps = {
  entries: LeaderboardEntry[];
  /** Show only the first N rows, so the list fits the inline post. */
  limit?: number;
  /** The viewer's Reddit name, so their row can be highlighted. */
  currentUsername?: string | null | undefined;
};

// --- CONSTANTS ---
/** Medal colours for ranks 1 to 3 (gold, silver, bronze); other ranks get a plain badge. */
const MEDAL_STYLES: Record<number, string> = {
  1: 'bg-gradient-to-b from-[#ffe08a] to-[#c8902c] text-on-accent ring-[#fff1c2]',
  2: 'bg-gradient-to-b from-[#eef1f4] to-[#9aa3ad] text-on-accent ring-[#ffffff]',
  3: 'bg-gradient-to-b from-[#e3a878] to-[#9a5a2e] text-on-accent ring-[#f4c9a4]',
};
const PLAIN_BADGE = 'bg-surface-sunken text-ink-muted ring-edge';

// --- SUBCOMPONENTS ---
/** The round rank number; gold, silver and bronze for the podium. */
const RankBadge = ({ rank }: { rank: number }) => (
  <span
    className={`grid size-7 shrink-0 place-items-center rounded-full font-display text-sm font-black ring-1 ${MEDAL_STYLES[rank] ?? PLAIN_BADGE}`}
  >
    {rank}
  </span>
);

/** One player's row: rank badge, name (crowned if first) and score. */
const LeaderboardRow = ({ entry, isViewer }: { entry: LeaderboardEntry; isViewer: boolean }) => {
  const isPodium = entry.rank <= 3;
  const rowTone = isViewer
    ? 'bg-accent/15 ring-accent'
    : isPodium
      ? 'bg-surface-raised/90 ring-accent/40'
      : 'bg-surface-raised/60 ring-edge';
  return (
    <li className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ring-1 ${rowTone}`}>
      <RankBadge rank={entry.rank} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {entry.rank === 1 && <Glyph name="crown" className="size-4 shrink-0 text-accent" />}
        <span className={`truncate text-sm ${isPodium ? 'font-bold text-ink' : 'text-ink'}`}>
          u/{entry.username}
        </span>
        {isViewer && (
          <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-bold uppercase text-on-accent">
            You
          </span>
        )}
      </span>
      <span className="shrink-0 font-display text-base font-black tabular-nums text-accent">
        {entry.score.toLocaleString('en')}
        <span className="ml-0.5 text-[10px] font-semibold text-ink-muted">pts</span>
      </span>
    </li>
  );
};

// --- COMPONENT ---
/** Renders the ranked board, or an empty-state message. */
export const LeaderboardList = ({ entries, limit, currentUsername }: LeaderboardListProps) => {
  if (entries.length === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-2 rounded-lg bg-surface-raised/60 px-4 py-6 text-center ring-1 ring-edge">
        <Glyph name="crown" className="size-8 text-accent/70" />
        <p className="text-sm text-ink-muted">No tyrants yet today. Be the first to claim the crown.</p>
      </div>
    );
  }

  return (
    <ol className="flex w-full flex-col gap-1.5">
      {entries.slice(0, limit).map((entry) => (
        <LeaderboardRow
          key={entry.username}
          entry={entry}
          isViewer={entry.username === currentUsername}
        />
      ))}
    </ol>
  );
};
