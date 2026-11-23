// ===================================================================
// INTRO VIEW
// The title screen, laid out like a mobile game's main menu and sized
// to the 512 px inline post (top to bottom):
//   KeyArt + logo   the scene fills the top, the logo sits over it
//   Badges          streak and today's best, top right
//   Badge rail      small stat badges down the left edge
//   Menu            stacked wide buttons: start, leaderboard, rules
//   Ranked note     whether the next run counts
// The rules and the leaderboard open as sheets over the menu.
// ===================================================================

import { useState } from 'react';
import { GAME_TITLE, LEADERBOARD_SIZE } from '../../../shared/constants/game';
import type { InitResponse, LeaderboardEntry } from '../../../shared/types/api';
import {
  HOW_TO_PLAY,
  LOGO_SUBTITLE,
  STORY_LINES,
  TAGLINE,
} from '../../content/lore';
import { ICON_AUTHORS } from '../../content/gameIcons';
import { LeaderboardList } from '../LeaderboardList';
import { Button } from '../ui/Button';
import { Glyph, type GlyphName } from '../ui/Glyph';
import { KeyArt } from './menu/KeyArt';
import { MenuPanel } from './menu/MenuPanel';

// --- TYPES ---
export type IntroViewProps = {
  data: InitResponse;
  entries: LeaderboardEntry[];
  canResume: boolean;
  isStarting: boolean;
  onStart: () => void;
};

/** Which sheet (if any) covers the menu. */
type Sheet = 'none' | 'rules' | 'board';

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
/** A round stat badge: an icon with a number, for the corners and rail. */
const StatBadge = ({
  glyph,
  value,
  label,
}: {
  glyph: GlyphName;
  value: string | number;
  label: string;
}) => (
  <div
    title={label}
    aria-label={`${label}: ${value}`}
    className="flex items-center gap-1 rounded-full bg-surface-sunken/85 py-1 pl-1.5 pr-2.5 text-xs font-bold text-ink ring-1 ring-accent/50"
  >
    <Glyph name={glyph} className="size-4 text-accent" />
    {value}
  </div>
);

/** The game's name over the art, with the tagline beneath. */
const Logo = () => (
  <div className="flex flex-col items-center px-6 text-center">
    <h1 className="font-display text-5xl font-black uppercase tracking-wide text-accent [text-shadow:0_3px_0_var(--color-surface-sunken),0_0_18px_rgb(0_0_0/0.7)]">
      {GAME_TITLE}
    </h1>
    <p className="mt-1 border-y border-accent/50 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink">
      {LOGO_SUBTITLE}
    </p>
  </div>
);

/** The scene, the logo over it and the corner badges. */
const Hero = ({ data }: { data: InitResponse }) => (
  <div className="relative min-h-0 flex-1">
    <div className="absolute inset-0">
      <KeyArt />
    </div>
    {/* FADE THE SCENE INTO THE MENU */}
    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-surface" />
    <p className="absolute left-3 top-2 text-[10px] text-ink-muted">
      {data.dailyKey}
    </p>
    <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
      <StatBadge glyph="flame" value={data.streak.current} label="Streak" />
      <StatBadge
        glyph="skull"
        value={data.bestScoreToday ?? '–'}
        label="Today's best"
      />
    </div>
    <div className="absolute inset-x-0 top-[30%]">
      <Logo />
    </div>
  </div>
);

/** The rules sheet: the story in two lines, then how to play. */
const RulesSheet = () => (
  <>
    <p className="text-center text-xs text-ink-muted">{TAGLINE}</p>
    <div className="flex flex-col gap-1 text-center font-display text-sm italic text-ink">
      {STORY_LINES.slice(0, 2).map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
    <ul className="flex flex-col gap-1.5 rounded-xl bg-surface-raised p-3 text-left text-xs text-ink-muted ring-1 ring-edge">
      {HOW_TO_PLAY.map((rule) => (
        <li key={rule}>• {rule}</li>
      ))}
    </ul>
    <p className="mt-auto text-center text-[9px] leading-tight text-ink-muted">
      Icons by {ICON_AUTHORS.join(', ')} from game-icons.net, CC BY 3.0.
    </p>
  </>
);

// --- COMPONENT ---
/** Renders the title screen and its two sheets. */
export const IntroView = ({
  data,
  entries,
  canResume,
  isStarting,
  onStart,
}: IntroViewProps) => {
  const [sheet, setSheet] = useState<Sheet>('none');
  const closeSheet = () => setSheet('none');

  return (
    <main className="relative flex h-full flex-col overflow-hidden bg-surface">
      <Hero data={data} />
      <div className="relative flex shrink-0 justify-center px-3 pb-3">
        {/* BADGE RAIL (LEFT EDGE) */}
        <div className="absolute bottom-3 left-2 flex flex-col gap-1.5">
          <StatBadge
            glyph="crown"
            value={data.streak.best}
            label="Best streak"
          />
        </div>
        {/* MENU */}
        <nav className="flex w-full max-w-60 flex-col items-center gap-2">
          <Button variant="menuPrimary" onClick={onStart} disabled={isStarting}>
            {canResume ? 'Resume the march' : 'Begin the conquest'}
          </Button>
          <Button variant="menu" onClick={() => setSheet('board')}>
            Today's tyrants
          </Button>
          <Button variant="menu" onClick={() => setSheet('rules')}>
            How to play
          </Button>
          <p className="text-center text-[10px] leading-tight text-ink-muted">
            {rankedNote(data, canResume)}
          </p>
        </nav>
      </div>
      {sheet === 'rules' && (
        <MenuPanel title="How to play" onClose={closeSheet}>
          <RulesSheet />
        </MenuPanel>
      )}
      {sheet === 'board' && (
        <MenuPanel title="Today's tyrants" onClose={closeSheet}>
          <LeaderboardList entries={entries} limit={LEADERBOARD_SIZE} />
        </MenuPanel>
      )}
    </main>
  );
};
