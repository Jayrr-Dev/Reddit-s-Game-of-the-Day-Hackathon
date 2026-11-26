// ===================================================================
// LEADERBOARD LIST
// Today's top scores as a gold-framed board: a podium of three medals
// (first in the centre and larger), then a RANK / NAME / POINTS table.
// The viewer's own row is picked out. Purely presentational: data
// comes in through props from useLeaderboard.
// ===================================================================

import type { LeaderboardEntry } from '../../shared/types/api';

// --- TYPES ---
export type LeaderboardListProps = {
  entries: LeaderboardEntry[];
  /** Show only the first N rows, so the list fits the inline post. */
  limit?: number;
  /** The viewer's Reddit name, so their row can be highlighted. */
  currentUsername?: string | null | undefined;
  /** Shows the medal podium above the table (off for compact previews). */
  showPodium?: boolean;
};

// --- CONSTANTS ---
/** Gold used for the frame, medals and ornaments. */
const GOLD_GRADIENT = 'linear-gradient(160deg,#ffe3a1 0%,#d9a04a 45%,#8a5a1f 100%)';
/** Dark ember panel behind the board, glowing warmer in the middle. */
const PANEL_BACKGROUND = 'radial-gradient(ellipse at 50% 35%,#4a2410 0%,#24120a 55%,#120805 100%)';
/** Grid columns shared by the header and every row, so they line up. */
const ROW_GRID = 'grid grid-cols-[2.5rem_1fr_auto] items-center gap-2';
/** Podium order left to right: second, first, third. */
const PODIUM_ORDER = [2, 1, 3] as const;

// --- HELPERS ---
/** Pads a rank to two digits, like 01, 02. */
const formatRank = (rank: number): string => String(rank).padStart(2, '0');

// --- SUBCOMPONENTS ---
/** A curled gold flourish for a bottom corner of the frame; `flip` mirrors it for the right side. */
const CornerOrnament = ({ flip = false }: { flip?: boolean }) => (
  <svg
    viewBox="0 0 60 40"
    aria-hidden
    className={`pointer-events-none absolute bottom-1 h-8 w-12 ${flip ? 'right-1 -scale-x-100' : 'left-1'}`}
  >
    <defs>
      <linearGradient id="lb-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffe3a1" />
        <stop offset="1" stopColor="#a8701f" />
      </linearGradient>
    </defs>
    <path
      d="M0 40V8c4 10 12 16 24 16 10 0 14-6 10-11-3-4-10-2-9 3 1 4 6 4 7 1M0 40h60c-10-2-18-8-22-16"
      fill="none"
      stroke="url(#lb-gold)"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

/** One podium medal: a gold ring with the rank, a ribbon, and the player's name below. */
const PodiumMedal = ({ rank, entry }: { rank: number; entry: LeaderboardEntry | undefined }) => {
  const isFirst = rank === 1;
  const ringSize = isFirst ? 'size-14 text-xl' : 'size-11 text-base';
  return (
    <div className={`flex w-20 flex-col items-center ${isFirst ? '' : 'mt-3'}`}>
      <div className="rounded-full p-[3px]" style={{ background: GOLD_GRADIENT }}>
        <div
          className={`grid ${ringSize} place-items-center rounded-full font-display font-black text-[#ffe3a1]`}
          style={{ background: 'radial-gradient(circle,#5a2a10,#1c0d06)' }}
        >
          {rank}
        </div>
      </div>
      {/* The ribbon tails: a gold strip with a V notch cut from the bottom. */}
      <div
        className="-mt-1 h-4 w-6 [clip-path:polygon(0_0,100%_0,100%_100%,50%_65%,0_100%)]"
        style={{ background: GOLD_GRADIENT }}
      />
      <span className="mt-0.5 w-full truncate text-center text-[10px] font-semibold text-ink">
        {entry ? `u/${entry.username}` : '—'}
      </span>
    </div>
  );
};

/** The three medals across the top of the board. */
const Podium = ({ entries }: { entries: LeaderboardEntry[] }) => (
  <div className="flex items-start justify-center gap-1">
    {PODIUM_ORDER.map((rank) => (
      <PodiumMedal key={rank} rank={rank} entry={entries.find((entry) => entry.rank === rank)} />
    ))}
  </div>
);

/** One table row: two-digit rank, name and points. */
const LeaderboardRow = ({ entry, isViewer }: { entry: LeaderboardEntry; isViewer: boolean }) => (
  <li
    className={`${ROW_GRID} rounded px-2 py-1.5 text-xs font-semibold uppercase ${
      isViewer ? 'bg-accent/20 text-accent-hover ring-1 ring-accent/70' : 'bg-white/[0.04] text-ink'
    }`}
  >
    <span className="tabular-nums">{formatRank(entry.rank)}</span>
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate normal-case">u/{entry.username}</span>
      {isViewer && (
        <span className="shrink-0 rounded-full bg-accent px-1.5 text-[9px] font-bold text-on-accent">
          YOU
        </span>
      )}
    </span>
    <span className="text-right tabular-nums">{entry.score.toLocaleString('en')}</span>
  </li>
);

/** RANK / NAME / POINTS column labels. */
const TableHeader = () => (
  <div className={`${ROW_GRID} px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted`}>
    <span>Rank</span>
    <span>Name</span>
    <span className="text-right">Points</span>
  </div>
);

// --- COMPONENT ---
/** Renders the framed board with podium and table, or an empty-state message inside the frame. */
export const LeaderboardList = ({
  entries,
  limit,
  currentUsername,
  showPodium = true,
}: LeaderboardListProps) => {
  const shownEntries = entries.slice(0, limit);
  return (
    <div className="w-full rounded-lg p-[3px] shadow-[0_6px_18px_rgb(0_0_0/0.6)]" style={{ background: GOLD_GRADIENT }}>
      <div
        className="relative flex flex-col gap-2 rounded-md px-3 pb-10 pt-3 ring-1 ring-black/60"
        style={{ background: PANEL_BACKGROUND }}
      >
        {showPodium && <Podium entries={entries} />}
        <TableHeader />
        {shownEntries.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-muted">No tyrants yet today. Be the first to claim the crown.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {shownEntries.map((entry) => (
              <LeaderboardRow key={entry.username} entry={entry} isViewer={entry.username === currentUsername} />
            ))}
          </ol>
        )}
        <CornerOrnament />
        <CornerOrnament flip />
      </div>
    </div>
  );
};
