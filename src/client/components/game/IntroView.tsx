// ===================================================================
// INTRO VIEW
// The title screen, laid out like a mobile game's main menu and sized
// to the 512 px inline post (top to bottom):
//   KeyArt + logo   the scene fills the top, the logo sits over it
//   Badges          date and best streak top left; streak and
//                   today's best top right (kept off the menu so
//                   they never cover the ranked note on a narrow post)
//   Menu            stacked wide buttons: start, leaderboard, rules,
//                   target dummies (practice)
//   Ranked note     whether the next run counts
// The rules and the leaderboard open as sheets over the menu.
// ===================================================================

import { useCallback, useState, useSyncExternalStore } from 'react';
import { getVolume, subscribeVolume } from '../../lib/gameAudio';
import { useMapAudio } from '../../lib/mapAudio';
import { GAME_TITLE, LEADERBOARD_SIZE } from '../../../shared/constants/game';
import { formatDailyKey } from '../../../shared/utils/dailyKey';
import type { InitResponse, LeaderboardEntry } from '../../../shared/types/api';
import {
  LOGO_SUBTITLE,
} from '../../content/lore';
import { CombatRulesSlides } from './CombatRulesSlides';
import { LeaderboardList } from '../LeaderboardList';
import { Button } from '../ui/Button';
import { Glyph, type GlyphName } from '../ui/Glyph';
import { Tooltip } from '../ui/Tooltip';
import { KeyArt } from './menu/KeyArt';
import { useGameSettings } from '../../hooks/useGameSettings';
import { SettingsDialog } from './menu/SettingsDialog';
import { MenuPanel } from './menu/MenuPanel';
import type { CarryCard } from '../../../shared/game/carryCards';
import type { ShopRingId } from '../../../shared/game/ringShop';
import { MetatronShop } from './menu/MetatronShop';
import { DevPanel } from './menu/DevPanel';
import { ProfileView } from './ProfileView';
import type { RingProgress } from '../../../shared/game/character';
import { FirstFight } from './FirstFight';
import { useIsAdmin } from '../../lib/adminRole';

// --- TYPES ---
export type IntroViewProps = {
  profileRings?: RingProgress | undefined;
  data: InitResponse;
  entries: LeaderboardEntry[];
  canResume: boolean;
  isStarting: boolean;
  onStart: () => void;
  /** Opens the target-dummy practice fight (testing aid). */
  onPractice: () => void;
  onShopTestVisit?: (visit: string | undefined) => void;
};

// --- CONSTANTS ---
/** Shows the Illusion Training practice button (a testing aid; turn off for launch if wanted). */
const SHOW_PRACTICE = true;

/** Which sheet (if any) covers the menu. */
type Sheet = 'profile' | 'none' | 'tutorial' | 'rules' | 'board' | 'shop' | 'dev';

/**
 * HOME BADGE TOOLTIPS: what each corner counter means, in plain words,
 * shown on hover (or a long press on a phone).
 */
const STAT_BADGE_INFO = {
  bestStreak: {
    title: 'Best streak',
    description: 'Your longest run of days in a row with a finished run.',
  },
  streak: {
    title: 'Streak',
    description: 'Days in a row you have finished a run. Finish one tomorrow to keep it going.',
  },
  todaysBest: {
    title: "Today's best",
    description: 'Your best score today. You score for every wave cleared, hero slain and region conquered.',
  },
} as const satisfies Record<string, { title: string; description: string }>;

// --- HELPERS ---
/** Explains whether the next run counts for the leaderboard; null hides the note. */
const rankedNote = (data: InitResponse, canResume: boolean): string | null => {
  if (!data.username) return 'Log in to put your conquest on the board.';
  if (canResume)
    return 'Your march was interrupted. Pick up where you left off.';
  return data.hasStartedRankedRun
    ? null
    : 'Your first run today is ranked. Make it count.';
};

// --- SUBCOMPONENTS ---
/** A round stat badge: an icon with a number, explained on hover. */
const StatBadge = ({
  glyph,
  value,
  info,
}: {
  glyph: GlyphName;
  value: string | number;
  info: { title: string; description: string };
}) => (
  <Tooltip content={info}>
    <div
      aria-label={`${info.title}: ${value}`}
      className="flex items-center gap-1 rounded-full bg-surface-sunken/85 py-1 pl-1.5 pr-2.5 text-xs font-bold text-ink ring-1 ring-accent/50"
    >
      <Glyph name={glyph} className="size-4 text-accent" />
      {value}
    </div>
  </Tooltip>
);

/**
 * The game's name over the art, with the tagline beneath. Sizes follow
 * the hero box's width (cqw), clamped, so the name wraps to two lines on
 * a phone and stays on one line on desktop, and neither line can run
 * past the edges. The tagline never wraps. A soft dark halo keeps both
 * readable over the castle.
 */
const Logo = () => (
  <div className="flex max-w-full flex-col items-center px-4 text-center">
    <h1 className="text-balance font-display text-[clamp(2.25rem,12cqw,3.5rem)] font-black uppercase leading-[0.95] tracking-wide text-accent [text-shadow:0_3px_0_var(--color-surface-sunken),0_0_18px_rgb(0_0_0/0.8),0_0_36px_rgb(0_0_0/0.6)]">
      {GAME_TITLE}
    </h1>
    <p className="mt-2 whitespace-nowrap rounded-full bg-surface-sunken/70 px-3 py-0.5 text-[clamp(7px,2.6cqw,10px)] font-semibold uppercase tracking-[0.18em] text-ink">
      {LOGO_SUBTITLE}
    </p>
  </div>
);

/** The scene, the logo over it and the corner badges. */
const Hero = ({ data }: { data: InitResponse }) => (
  <div className="relative min-h-0 flex-1 [container-type:size]">
    <div className="absolute inset-0">
      <KeyArt />
    </div>
    {/* FADE THE SCENE INTO THE MENU */}
    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-surface" />
    {/* DATE AND BEST STREAK (TOP LEFT) */}
    <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
      <p className="pl-1 text-[10px] font-semibold text-ink-muted">
        {formatDailyKey(data.dailyKey)}
      </p>
      <StatBadge glyph="crown" value={data.streak.best} info={STAT_BADGE_INFO.bestStreak} />
    </div>
    <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
      <StatBadge glyph="flame" value={data.streak.current} info={STAT_BADGE_INFO.streak} />
      <StatBadge
        glyph="skull"
        value={data.bestScoreToday ?? '–'}
        info={STAT_BADGE_INFO.todaysBest}
      />
    </div>
    {/* LOGO: centred in the sky, above the villain on the ridge. A wide
        post crops the sky, which lifts the villain, so the logo rides
        higher there (@xl) to keep the tagline off his hood. The layer
        ignores the pointer: it spans the full width and used to sit over
        the corner badges, so their tooltips never opened. */}
    <div className="pointer-events-none absolute inset-x-0 top-[12%] bottom-[45%] flex @xl:top-[3%] @xl:bottom-[54%] items-center justify-center">
      <Logo />
    </div>
  </div>
);

// --- COMPONENT ---
/** Renders the title screen and its two sheets. */
export const IntroView = ({
  profileRings,
  data,
  entries,
  canResume,
  isStarting,
  onStart,
  onPractice,
  onShopTestVisit,
}: IntroViewProps) => {
  const [sheet, setSheet] = useState<Sheet>('none');
  const [testJewelry, setTestJewelry] = useState<ShopRingId[]>([]);
  const [testCarry, setTestCarry] = useState<CarryCard[]>([]);
  const receiveTestInventory = useCallback((items: ShopRingId[], visit: string, cards: CarryCard[]) => {
    setTestCarry(cards);
    setTestJewelry(items);
    onShopTestVisit?.(visit);
  }, [onShopTestVisit]);
  const musicVolume = useSyncExternalStore(subscribeVolume, () => getVolume('music'));
  useMapAudio({ mapId: 'Home', active: sheet !== 'tutorial' && sheet !== 'dev', bossActive: false, musicVolume: musicVolume / 100, sfxVolume: 0 });
  const isAdmin = useIsAdmin();
  const settings = useGameSettings();
  const closeSheet = () => setSheet('none');
  const note = rankedNote(data, canResume);
  if (sheet === 'profile') return <ProfileView data={data} rings={profileRings} onClose={closeSheet} testJewelry={isAdmin ? testJewelry : []} testCarry={isAdmin ? testCarry : []} />;
  if (sheet === 'tutorial') return <FirstFight accountId={data.accountId} onExit={closeSheet} onRules={() => setSheet('rules')} />;

  return (
    <main className="relative flex h-full flex-col overflow-hidden bg-surface">
      <div className="relative mt-2 flex min-h-0 flex-1">
        <Hero data={data} />
        <SettingsDialog className="absolute bottom-2 right-3 z-10">{settings.controls}</SettingsDialog>
      </div>
      <div className="relative flex shrink-0 justify-center px-3 pb-3">
        {/* MENU */}
        <nav className="flex w-full max-w-60 flex-col items-center gap-2">
          <Button variant="menuPrimary" onClick={onStart} disabled={isStarting} data-own-sound={!canResume ? true : undefined}>
            {canResume ? 'Resume the march' : 'Begin the conquest'}
          </Button>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="menu" onClick={() => setSheet('profile')}>Profile</Button>
            <Button variant="menu" onClick={() => { setTestJewelry([]); setTestCarry([]); onShopTestVisit?.(undefined); setSheet('shop'); }}>Shop</Button>
          </div>
          <Button variant="menu" onClick={() => setSheet('board')}>
            Today's tyrants
          </Button>
          <Button variant="menu" onClick={() => setSheet('tutorial')}>
            How to play
          </Button>
          {SHOW_PRACTICE && (
            <Button variant="menu" onClick={onPractice}>
              Illusion Training
            </Button>
          )}
          {/* DEV: admin-only reference tabs (sounds, assets) */}
          {isAdmin && (
            <Button variant="menu" onClick={() => setSheet('dev')}>
              Dev
            </Button>
          )}
          {note && (
            <p className="text-center text-[10px] leading-tight text-ink-muted">
              {note}
            </p>
          )}
        </nav>
      </div>
      {sheet === 'shop' && <MetatronShop onClose={closeSheet} onTestInventory={receiveTestInventory} />}
      {sheet === 'dev' && isAdmin && <DevPanel onClose={closeSheet} />}
      {sheet === 'rules' && (
        <MenuPanel title="Combat Rules" onClose={() => setSheet('tutorial')} wide>
          <CombatRulesSlides />
        </MenuPanel>
      )}
      {sheet === 'board' && (
        <MenuPanel title="Today's tyrants" onClose={closeSheet}>
          <LeaderboardList entries={entries} limit={LEADERBOARD_SIZE} currentUsername={data.username} />
        </MenuPanel>
      )}
    </main>
  );
};
