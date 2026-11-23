// ===================================================================
// INTRO VIEW
// The title screen: story, how to play, the player's daily stats, the
// start button and today's leaderboard.
// ===================================================================

import { GAME_TITLE } from '../../../shared/constants/game';
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
/** The story and the four rules, short enough to read in ten seconds. */
const Prologue = () => (
  <section className="flex max-w-sm flex-col gap-3 text-center">
    <div className="flex flex-col gap-1 font-display italic text-ink">
      {STORY_LINES.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
    <ul className="flex flex-col gap-1 rounded-xl bg-surface-raised p-3 text-left text-xs text-ink-muted ring-1 ring-edge">
      {HOW_TO_PLAY.map((rule) => (
        <li key={rule}>• {rule}</li>
      ))}
    </ul>
  </section>
);

// --- COMPONENT ---
/** Renders the title screen. */
export const IntroView = ({
  data,
  entries,
  canResume,
  isStarting,
  onStart,
}: IntroViewProps) => (
  <main className="flex min-h-screen flex-col items-center gap-4 p-4">
    <header className="flex flex-col items-center gap-1 pt-2">
      <h1 className="font-display text-4xl font-black tracking-wide text-accent">
        {GAME_TITLE}
      </h1>
      <p className="text-center text-xs text-ink-muted">{TAGLINE}</p>
      <p className="text-xs text-ink-muted">{data.dailyKey}</p>
    </header>
    <Prologue />
    <div className="flex gap-2">
      <StatTile label="Streak" value={data.streak.current} />
      <StatTile label="Best streak" value={data.streak.best} />
      <StatTile label="Today's best" value={data.bestScoreToday ?? '–'} />
    </div>
    <p className="text-center text-xs text-ink-muted">
      {rankedNote(data, canResume)}
    </p>
    <Button onClick={onStart} disabled={isStarting}>
      {canResume ? 'Resume the march' : 'Begin the conquest'}
    </Button>
    <section className="flex w-full max-w-xs flex-col items-center gap-2">
      <h2 className="font-display text-sm font-bold text-ink-muted">
        Today's tyrants
      </h2>
      <LeaderboardList entries={entries} />
    </section>
  </main>
);
