// ===================================================================
// INTRO VIEW
// The title screen, laid out like a mobile game's main menu and sized
// to the 512 px inline post (top to bottom):
//   KeyArt + logo   the scene fills the top, the logo sits over it
//   Badges          date top left; streak and
//                   today's best top right (kept off the menu so
//                   they never cover the ranked note on a narrow post)
//   Menu            wide action buttons with separate utility icons
//   Ranked note     whether the next run counts
// The rules and the leaderboard open as sheets over the menu.
// ===================================================================

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getVolume, subscribeVolume } from '../../lib/gameAudio';
import { useMapAudio } from '../../lib/mapAudio';
import { GAME_TITLE, LEADERBOARD_SIZE } from '../../../shared/constants/game';
import { formatDailyKey, getDailyKey } from '../../../shared/utils/dailyKey';
import type { InitResponse, LeaderboardEntry, RingShopResponse } from '../../../shared/types/api';
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
import type { ShopRingId } from '../../../shared/game/ringShop';
import { MetatronShop } from './menu/MetatronShop';
import { DevPanel } from './menu/DevPanel';
import { ProfileView } from './ProfileView';
import { GoldCoins } from './profileParts';
import { apiClient } from '../../lib/apiClient';
import { progressionFromWins } from '../../../shared/game/character';
import type { RingProgress } from '../../../shared/game/character';
import { FirstFight } from './FirstFight';
import { useIsAdmin } from '../../lib/adminRole';

// --- TYPES ---
export type IntroViewProps = {
  profileRings?: RingProgress | undefined;
  data: InitResponse;
  entries: LeaderboardEntry[];
  canResume: boolean;
  activeRunLevel?: number | undefined;
  isStarting: boolean;
  onStart: () => void;
  onEndless?: () => void;
  /** Opens the target-dummy practice fight (testing aid). */
  onPractice: () => void;
  onShopTestVisit?: (visit: string | undefined) => void;
  loadTestShop?: () => Promise<RingShopResponse>;
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
    {/* DATE (TOP LEFT) */}
    <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
      <p className="pl-1 text-[10px] font-semibold text-white">
        {formatDailyKey(data.dailyKey)}
      </p>
      {data.appVersion && <p className="pl-1 text-[10px] font-semibold text-white" aria-label={'Build ' + data.appVersion}>v{data.appVersion}</p>}
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
  activeRunLevel,
  isStarting,
  onStart,
  onEndless,
  onPractice,
  onShopTestVisit,
  loadTestShop,
}: IntroViewProps) => {
  const [sheet, setSheet] = useState<Sheet>('none');
  const [playerTotals, setPlayerTotals] = useState({ wins: data.lifetimeWins ?? 0, xpStartWins: data.xpStartWins, bonusXp: data.bonusXp ?? 0, gold: data.gold ?? 0, pandoraFreeDay: data.pandoraFreeDay });
  const level = progressionFromWins(playerTotals.wins, false, playerTotals.xpStartWins, playerTotals.bonusXp).level;
  useEffect(() => {
    if (sheet !== 'none' || !data.accountId) return;
    let current = true;
    let request = 0;
    const refresh = async () => {
      const generation = ++request;
      try {
        const result = await apiClient.profile();
        if (current && request === generation) setPlayerTotals({
          wins: result.wins ?? data.lifetimeWins ?? 0, xpStartWins: result.xpStartWins ?? data.xpStartWins,
          bonusXp: result.bonusXp ?? data.bonusXp ?? 0, gold: result.gold ?? data.gold ?? 0,
          pandoraFreeDay: result.pandoraFreeDay,
        });
      } catch { /* Keep the last known totals if refresh fails. */ }
    };
    void refresh();
    const dayMs = 24 * 60 * 60 * 1000;
    const midnight = window.setTimeout(refresh, dayMs - Date.now() % dayMs + 1000);
    window.addEventListener('focus', refresh);
    return () => { current = false; window.clearTimeout(midnight); window.removeEventListener('focus', refresh); };
  }, [data.accountId, data.lifetimeWins, data.xpStartWins, data.bonusXp, data.gold, sheet]);
  const [testJewelry, setTestJewelry] = useState<ShopRingId[]>([]);
  const receiveTestInventory = useCallback((items: ShopRingId[], visit: string) => {
    setTestJewelry(items);
    onShopTestVisit?.(visit);
  }, [onShopTestVisit]);
  useEffect(() => {
    if (sheet !== 'profile' || !loadTestShop) return;
    let active = true;
    loadTestShop().then(result => {
      if (active && result.testVisit) receiveTestInventory(result.owned, result.testVisit);
    }).catch(() => {});
    return () => { active = false; };
  }, [sheet, loadTestShop, receiveTestInventory]);
  const musicVolume = useSyncExternalStore(subscribeVolume, () => getVolume('music'));
  const sfxVolume = useSyncExternalStore(subscribeVolume, () => getVolume('sfx'));
  const settings = useGameSettings(true);
  const inShop = sheet === 'shop';
  useMapAudio({
    mapId: inShop ? 'Gateway of Souls' : 'Home', active: sheet !== 'tutorial' && sheet !== 'dev', bossActive: false,
    musicOverride: inShop ? undefined : settings.introMusicUrl,
    musicVolume: !inShop && settings.introMusicMuted ? 0 : musicVolume / 100,
    sfxVolume: inShop ? sfxVolume / 100 : 0,
  });
  const isAdmin = useIsAdmin();
  const closeSheet = () => setSheet('none');
  const freePandora = playerTotals.pandoraFreeDay === getDailyKey();
  const note = activeRunLevel !== undefined && activeRunLevel !== level
    ? 'Saved run: Lv ' + activeRunLevel + ' · Profile: Lv ' + level
    : rankedNote(data, canResume);
  if (sheet === 'profile') return <ProfileView data={data} rings={profileRings} onClose={closeSheet} testJewelry={isAdmin ? testJewelry : []} />;
  if (sheet === 'tutorial') return <FirstFight accountId={data.accountId} onExit={closeSheet} onRules={() => setSheet('rules')} />;

  return (
    <main className="home-menu relative flex h-full flex-col overflow-hidden bg-surface">
      <div className="relative mt-2 flex min-h-0 flex-1">
        <Hero data={data} />
      </div>
      <div className="home-menu-actions relative flex shrink-0 justify-center px-14 pb-3">
        {/* MENU */}
        <nav className="flex w-full max-w-60 flex-col items-center gap-2">
          {note && <p className="text-center text-[10px] leading-tight text-ink-muted">{note}</p>}
          <Button variant="menuPrimary" onClick={onStart} disabled={isStarting} data-own-sound={!canResume ? true : undefined}>
            {canResume ? 'Resume the march' : 'Begin the conquest'}
          </Button>
          {onEndless && <Button variant="menu" onClick={onEndless}>Endless</Button>}
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="menu" onClick={() => setSheet('profile')}>Profile</Button>
            <Button variant="menu" className="home-shop-button" aria-label={freePandora ? "Shop, free Pandora's Box" : undefined}
              onClick={() => { setTestJewelry([]); onShopTestVisit?.(undefined); setSheet('shop'); }}>
              Shop{freePandora && <span className="pandora-free-ribbon" aria-hidden="true">Free</span>}
            </Button>
          </div>
          {SHOW_PRACTICE && (
            <Button variant="menu" onClick={onPractice}>
              Illusion Training
            </Button>
          )}
        </nav>
      </div>
      <aside aria-label="Menu shortcuts" className="absolute bottom-2 right-2 z-10 flex flex-col gap-1">
        <button type="button" className="home-utility-icon" aria-label="Leaderboard" title="Leaderboard" onClick={() => setSheet('board')}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 3v5m-4 2h8m-6-2h4"/>
          </svg>
        </button>
        <button type="button" className="home-utility-icon" aria-label="How to play" title="How to play" onClick={() => setSheet('tutorial')}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3h12a1 1 0 0 1 1 1v15H7a2 2 0 0 0-2 2V5a2 2 0 0 1 2-2Zm13 16v2H7a2 2 0 0 1 0-4h12M10 8a2 2 0 1 1 3 1.73c-.68.4-1 .82-1 1.52m0 2h.01"/>
          </svg>
        </button>
        <SettingsDialog>{settings.controls}</SettingsDialog>
        {isAdmin && <button type="button" className="home-utility-icon" aria-label="Developer tools" title="Developer tools" onClick={() => setSheet('dev')}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.5 4.8 17 8.3l-1.5-1.5L19 3.3a5.2 5.2 0 0 0-6.7 6.7l-8.2 8.2a1.7 1.7 0 0 0 2.4 2.4l8.2-8.2a5.2 5.2 0 0 0 5.8-7.6Z"/>
          </svg>
        </button>}
      </aside>
      {sheet === 'none' && <aside className="home-player-badge" aria-label="Player summary">
        <strong>{data.username ? 'u/' + data.username : 'Local player'}</strong>
        <span>Level {level}</span>
        <span className="home-player-gold"><GoldCoins /> <span>{playerTotals.gold.toLocaleString()} Gold</span></span>
      </aside>}
      {sheet === 'shop' && <MetatronShop onClose={closeSheet} onTestInventory={receiveTestInventory} />}
      {sheet === 'dev' && isAdmin && <DevPanel onClose={closeSheet} />}
      {sheet === 'rules' && (
        <MenuPanel title="Combat Rules" backLabel="Back to How to Play" onClose={() => setSheet('tutorial')} wide>
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
