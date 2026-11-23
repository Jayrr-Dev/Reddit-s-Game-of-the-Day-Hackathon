// ===================================================================
// INTRO VIEW
// The title screen: story, how to play, the player's daily stats, the
// start button and today's leaderboard.
// ===================================================================

import {
  GAME_TITLE,
  LEADERBOARD_PREVIEW_ROWS,
} from '../../../shared/constants/game';
import type { InitResponse, LeaderboardEntry } from '../../../shared/types/api';
import { HOW_TO_PLAY, STORY_LINES, TAGLINE } from '../../content/lore';
import { LeaderboardList } from '../LeaderboardList';
import { Button } from '../ui/Button';
import { StatTile } from '../ui/StatTile';

// --- TYPES ---
export type IntroViewProps = {
  data: InitResponse;
  entries: LeaderboardEntry[];
  canResume: boolean;
  isStarting: boolean;
  onStart: () => void;
};

// --- HELPERS ---
/** Explains whether the next run counts for the leaderboard. */
const rankedNote = (data: InitResponse, canResume: boolean): string => {
  if (!data.username) return 'Log in to put your conquest on the board.';
  if (canResume)
    return 'Your march was interrupted. Pick up where you left off.';
  return data.hasStartedRankedRun
    ? "Today's ranked run is spent. Further marches are practice."
    : 'Your first run today is ranked. Make it count.';
};

// --- SUBCOMPONENTS ---
/** The story and the rules, short enough to read in ten seconds. */
const Prologue = () => (
  <section className="flex max-w-sm flex-col gap-2 text-center">
    <p className="font-display text-sm italic text-ink">{STORY_LINES[0]}</p>
    <ul className="flex flex-col gap-0.5 rounded-xl bg-surface-raised px-3 py-2 text-left text-xs text-ink-muted ring-1 ring-edge">
      {HOW_TO_PLAY.map((rule) => (
        <li key={rule}>• {rule}</li>
      ))}
    </ul>
  </section>
);

/** Streak, best streak and today's best in one compact line. */
const DailyStats = ({ data }: { data: InitResponse }) => (
  <div className="flex gap-2">
    <StatTile label="Streak" value={data.streak.current} />
    <StatTile label="Best streak" value={data.streak.best} />
    <StatTile label="Today's best" value={data.bestScoreToday ?? '–'} />
  </div>
);

// --- COMPONENT ---
/** Renders the title screen; everything fits the 512 px inline post. */
export const IntroView = ({
  data,
  entries,
  canResume,
  isStarting,
  onStart,
}: IntroViewProps) => (
  <main className="flex h-full flex-col items-center justify-center gap-2 overflow-hidden p-3">
    <header className="flex flex-col items-center">
      <h1 className="font-display text-3xl font-black tracking-wide text-accent">
        {GAME_TITLE}
      </h1>
      <p className="text-center text-xs text-ink-muted">
        {TAGLINE} · {data.dailyKey}
      </p>
    </header>
    <Prologue />
    <DailyStats data={data} />
    <p className="text-center text-xs text-ink-muted">
      {rankedNote(data, canResume)}
    </p>
    <Button onClick={onStart} disabled={isStarting}>
      {canResume ? 'Resume the march' : 'Begin the conquest'}
    </Button>
    <section className="flex w-full max-w-xs flex-col items-center gap-1">
      <h2 className="font-display text-xs font-bold text-ink-muted">
        Today's tyrants
      </h2>
      <LeaderboardList entries={entries} limit={LEADERBOARD_PREVIEW_ROWS} />
    </section>
  </main>
);
