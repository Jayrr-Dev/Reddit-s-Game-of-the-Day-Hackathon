import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import { createEndless, draftBorrowedOffers, ENDLESS_BATTLE_VERSION, endlessClearedWaves, endlessWaveNumber, isEndlessBattleVersion, reduceEndless, restoreEndlessProfile, withDraftBorrowedPowers, type EndlessBattleVersion, type EndlessProfile } from '../../../shared/game/endless';
import { progressionFromWins, type RingProgress } from '../../../shared/game/character';
import type { InitResponse } from '../../../shared/types/api';
import { apiClient } from '../../lib/apiClient';
import { localBuild } from '../../lib/playerBuild';
import { getVolume, subscribeVolume } from '../../lib/gameAudio';
import { STARTER_THEMES, useMapAudio } from '../../lib/mapAudio';
import { useGameSettings } from '../../hooks/useGameSettings';
import type { StarterName } from '../../../shared/game/starters';
import { endlessDraftSize, endlessDraftOffers, isSavedEndlessDraft, pendingDraftPower, refreshEndlessDraft, type DraftPowerStage, type EndlessDraft } from '../../../shared/game/endlessDraft';
import { isRunAction, isRunOver, type RunAction, type RunState } from '../../../shared/game/run';
import { MAX_RUN_ACTIONS } from '../../../shared/game/rules';
import { Button } from '../ui/Button';
import { MenuBackButton } from '../ui/MenuBackButton';
import { StatTile } from '../ui/StatTile';
import { VillainRunGame } from './VillainRunGame';
import { EndlessDraftView } from './EndlessDraftView';
import { BorrowedPowerChoices } from './BorrowedPowerView';
import { EndlessDraftTools } from './EndlessDraftTools';
import { ProfileView } from './ProfileView';

type Session = { day: string; run: RunState; actions: RunAction[]; best: number; started: boolean; draft: EndlessDraft | null;
  profile?: EndlessProfile; battleVersion?: EndlessBattleVersion };
type Event = { type: 'act'; action: RunAction } | { type: 'newDraft' } |
  { type: 'pick'; index: number; at: number } | { type: 'begin'; profile: EndlessProfile } |
  { type: 'refresh' } | { type: 'draftPower'; stage: DraftPowerStage; index: number };
type Page = 'menu' | 'draft' | 'profile' | 'battle';

/** Restore only this account's Endless log for the date. */
function restore(day: string, key: string): Session {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value && typeof value === 'object' && 'actions' in value && Array.isArray(value.actions) &&
        value.actions.length <= MAX_RUN_ACTIONS && value.actions.every(isRunAction)) {
      const actions = value.actions;
      const best = 'best' in value && typeof value.best === 'number' && Number.isSafeInteger(value.best) && value.best > 0 ? value.best : 0;
      const draft = 'draft' in value && isSavedEndlessDraft(value.draft) ? value.draft : null;
      const started = actions.length > 0 || ('started' in value && value.started === true);
      const deck = started && draft && draft.cards.length === endlessDraftSize(draft) ? draft.cards : undefined;
      const battleVersion = 'battleVersion' in value && isEndlessBattleVersion(value.battleVersion)
        ? value.battleVersion : undefined;
      const profile = 'profile' in value ? restoreEndlessProfile(value.profile) : undefined;
      const initial = createEndless(day, deck, battleVersion, profile, draft?.starter);
      const prepared = deck ? withDraftBorrowedPowers(initial, day, draft) : initial;
      return { day, run: actions.reduce(reduceEndless, prepared), actions, best, started, draft,
        ...(battleVersion && { battleVersion }), ...(profile && { profile }) };
    }
  } catch { /* A local save is optional. */ }
  return { day, run: createEndless(day), actions: [], best: 0, started: false, draft: null };
}

/** Keep score and saved actions together so returning to the title never spends a conquest. */
function update(session: Session, event: Event): Session {
  const { draft, started } = session;
  if (event.type === 'newDraft') {
    if (started && !isRunOver(session.run)) return session;
    return { ...session, actions: [], started: false, draft: { number: (draft?.number ?? 0) + 1, cards: [] } };
  }
  if (event.type === 'pick') {
    if (!draft || started || draft.cards.length !== event.at || pendingDraftPower(draft)) return session;
    const offer = endlessDraftOffers(session.day, draft)[event.index];
    return offer ? { ...session, draft: { ...draft, cards: [...draft.cards, ...offer.cards], roundRefresh: 0,
      ...(offer.name && { starter: offer.name }) } } : session;
  }
  if (event.type === 'refresh') {
    if (!draft || started) return session;
    const next = refreshEndlessDraft(session.day, draft);
    return next === draft ? session : { ...session, draft: next };
  }
  if (event.type === 'draftPower') {
    if (!draft || started || pendingDraftPower(draft) !== event.stage ||
        !draftBorrowedOffers(session.day, draft, event.stage)[event.index]) return session;
    return { ...session, draft: { ...draft, powerPicks: { ...draft.powerPicks, [event.stage]: event.index } } };
  }
  if (event.type === 'begin') {
    if (started || !draft || draft.cards.length !== endlessDraftSize(draft) || pendingDraftPower(draft)) return session;
    const run = createEndless(session.day, draft.cards, ENDLESS_BATTLE_VERSION, event.profile, draft.starter);
    return { ...session, run: withDraftBorrowedPowers(run, session.day, draft), actions: [], started: true,
      battleVersion: ENDLESS_BATTLE_VERSION, profile: event.profile };
  }
  if (!started) return session;
  const run = reduceEndless(session.run, event.action);
  if (run === session.run) return session;
  return { ...session, run, actions: [...session.actions, event.action],
    best: Math.max(session.best, endlessClearedWaves(run)) };
}

/** A completely separate daily-seeded run and local record. */
export function EndlessView({ data, rings, onBack }: { data: InitResponse; rings: RingProgress; onBack: () => void }) {
  const { dailyKey: day, accountId } = data;
  const key = 'villain-arc:endless:v1:' + (accountId ?? 'guest') + ':' + day;
  const [session, send] = useReducer(update, key, storageKey => restore(day, storageKey));
  const [page, setPage] = useState<Page>('menu');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [previewClass, setPreviewClass] = useState<StarterName>();
  const [profileLevel, setProfileLevel] = useState(() => progressionFromWins(data.lifetimeWins ?? 0, false, data.xpStartWins, data.bonusXp).level);
  const { run, actions, best, started, draft, battleVersion, profile } = session;
  const draftClass = page === 'draft' || page === 'profile' ? draft?.starter ?? previewClass : undefined;
  const musicVolume = useSyncExternalStore(subscribeVolume, () => getVolume('music'));
  const { introMusicUrl, introMusicMuted } = useGameSettings();
  useMapAudio({ mapId: draftClass ? STARTER_THEMES[draftClass] : 'Home',
    active: page !== 'battle' || isRunOver(run), bossActive: false,
    musicOverride: draftClass ? undefined : introMusicUrl,
    musicVolume: !draftClass && introMusicMuted ? 0 : musicVolume / 100, sfxVolume: 0 });
  useEffect(() => {
    if (page !== 'draft' || !accountId) return;
    let current = true;
    apiClient.profile().then(profile => {
      if (current) setProfileLevel(progressionFromWins(profile.wins, false, profile.xpStartWins, profile.bonusXp).level);
    }).catch(() => {});
    return () => { current = false; };
  }, [page, accountId]);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ actions, best, started, draft, battleVersion, profile })); } catch { /* Play on without saving. */ }
  }, [key, actions, best, started, draft, battleVersion, profile]);
  const act = useCallback((action: RunAction) => send({ type: 'act', action }), []);
  const openMenu = () => setPage('menu');
  const startDraft = () => { setPreviewClass(undefined); send({ type: 'newDraft' }); setPage('draft'); };
  /** Snapshots the same saved build used in Conquest before entering Wave 1. */
  async function begin() {
    if (loading) return;
    setLoading(true);
    setLoadError(false);
    try {
      const current = accountId ? await apiClient.profile() : undefined;
      const snapshot: EndlessProfile = { wins: current?.wins ?? 0, xpStartWins: current?.xpStartWins,
        bonusXp: current?.bonusXp, shopRings: current?.shopRings ?? [], rings,
        edits: current?.build.character ?? localBuild(accountId).character };
      send({ type: 'begin', profile: snapshot });
      setPage('battle');
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }
  const finished = isRunOver(run);
  const resumable = started && !finished;
  const hasDraft = !started && draft !== null;
  const milestone = draft && pendingDraftPower(draft);
  if (page === 'profile') return <ProfileView data={data} rings={rings} onClose={() => setPage('draft')} />;
  if (page === 'draft' && draft) return <div className="endless-draft-shell relative h-full">
    {milestone ? <BorrowedPowerChoices key={milestone}
      caption={'Draft checkpoint ' + milestone + '/20. This power is active from Wave 1.'}
      powers={draftBorrowedOffers(day, draft, milestone)}
      onPick={index => send({ type: 'draftPower', stage: milestone, index })} /> :
      <EndlessDraftView day={day} draft={draft} loading={loading} loadError={loadError}
        onPick={index => send({ type: 'pick', index, at: draft.cards.length })}
        onRefresh={() => send({ type: 'refresh' })}
        onPreviewClass={setPreviewClass}
        onBegin={() => void begin()} />}
    <EndlessDraftTools cards={draft.cards} level={profileLevel} busy={loading} onExit={openMenu} onProfile={() => setPage('profile')} />
  </div>;
  if (page !== 'battle') return <main className="run-results results-layout endless-menu relative" aria-labelledby="endless-title">
    <MenuBackButton onClick={onBack} />
    <header>
      <h1 id="endless-title">Endless</h1>
      <p className="mt-2 text-sm text-ink-muted">Draft a deck. Survive as many waves as you can.</p>
    </header>
    <div className="results-stats" style={{ gridTemplateColumns: resumable || hasDraft ? 'repeat(2, minmax(0, 1fr))' : '1fr' }}>
      <StatTile label="Best today" value={best + ' cleared'} />
      {resumable && <StatTile label="Current run" value={'Wave ' + endlessWaveNumber(run)} />}
      {hasDraft && <StatTile label="Draft" value={draft.cards.length + ' / ' + endlessDraftSize(draft)} />}
    </div>
    <div className="results-actions">
      <Button variant="menuPrimary" onClick={resumable ? () => setPage('battle') : hasDraft ? () => setPage('draft') : startDraft}>
        {resumable ? 'Resume run' : hasDraft ? 'Resume draft' : 'Draft deck'}
      </Button>
    </div>
  </main>;
  if (!finished) return <VillainRunGame run={run} onAction={act} onMainMenu={openMenu} endless />;
  return <main className="run-results results-layout">
    <header><h1>Endless results</h1><p className="results-score">{run.stats.wavesCleared.toLocaleString()} <span>waves cleared</span></p></header>
    <div className="results-stats">
      <StatTile label="Best today" value={best} />
      <StatTile label="Heroes slain" value={run.stats.heroesSlain} />
    </div>
    <div className="results-actions">
      <Button variant="menuPrimary" onClick={startDraft}>Draft again</Button>
      <Button variant="menu" onClick={openMenu}>Endless menu</Button>
    </div>
  </main>;
}
