import { useCallback, useEffect, useReducer, useState } from 'react';
import { createEndless, ENDLESS_BATTLE_VERSION, endlessClearedWaves, endlessWaveNumber, reduceEndless, restoreEndlessProfile, type EndlessProfile } from '../../../shared/game/endless';
import type { RingProgress } from '../../../shared/game/character';
import { apiClient } from '../../lib/apiClient';
import { localBuild } from '../../lib/playerBuild';
import { endlessDraftSize, endlessDraftOffers, isSavedEndlessDraft, type EndlessDraft } from '../../../shared/game/endlessDraft';
import { isRunAction, isRunOver, type RunAction, type RunState } from '../../../shared/game/run';
import { MAX_RUN_ACTIONS } from '../../../shared/game/rules';
import { Button } from '../ui/Button';
import { StatTile } from '../ui/StatTile';
import { VillainRunGame } from './VillainRunGame';
import { EndlessDraftView } from './EndlessDraftView';

type Session = { day: string; run: RunState; actions: RunAction[]; best: number; started: boolean; draft: EndlessDraft | null;
  profile?: EndlessProfile; battleVersion?: typeof ENDLESS_BATTLE_VERSION };
type Event = { type: 'act'; action: RunAction } | { type: 'newDraft' } |
  { type: 'pick'; index: number; at: number } | { type: 'begin'; profile: EndlessProfile };
type Page = 'menu' | 'draft' | 'battle';

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
      const battleVersion = 'battleVersion' in value && value.battleVersion === ENDLESS_BATTLE_VERSION ? ENDLESS_BATTLE_VERSION : undefined;
      const profile = 'profile' in value ? restoreEndlessProfile(value.profile) : undefined;
      return { day, run: actions.reduce(reduceEndless, createEndless(day, deck, battleVersion, profile, draft?.starter)), actions, best, started, draft,
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
    if (!draft || started || draft.cards.length !== event.at) return session;
    const offer = endlessDraftOffers(session.day, draft)[event.index];
    return offer ? { ...session, draft: { ...draft, cards: [...draft.cards, ...offer.cards],
      ...(offer.name && { starter: offer.name }) } } : session;
  }
  if (event.type === 'begin') {
    if (started || !draft || draft.cards.length !== endlessDraftSize(draft)) return session;
    return { ...session, run: createEndless(session.day, draft.cards, ENDLESS_BATTLE_VERSION, event.profile, draft.starter), actions: [], started: true,
      battleVersion: ENDLESS_BATTLE_VERSION, profile: event.profile };
  }
  if (!started) return session;
  const run = reduceEndless(session.run, event.action);
  if (run === session.run) return session;
  return { ...session, run, actions: [...session.actions, event.action],
    best: Math.max(session.best, endlessClearedWaves(run)) };
}

/** A completely separate daily-seeded run and local record. */
export function EndlessView({ day, accountId, rings, onBack }: { day: string; accountId?: string | undefined; rings: RingProgress; onBack: () => void }) {
  const key = 'villain-arc:endless:v1:' + (accountId ?? 'guest') + ':' + day;
  const [session, send] = useReducer(update, key, storageKey => restore(day, storageKey));
  const [page, setPage] = useState<Page>('menu');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { run, actions, best, started, draft, battleVersion, profile } = session;
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ actions, best, started, draft, battleVersion, profile })); } catch { /* Play on without saving. */ }
  }, [key, actions, best, started, draft, battleVersion, profile]);
  const act = useCallback((action: RunAction) => send({ type: 'act', action }), []);
  const openMenu = () => setPage('menu');
  const startDraft = () => { send({ type: 'newDraft' }); setPage('draft'); };
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
  if (page === 'draft' && draft) return <EndlessDraftView day={day} draft={draft} onBack={openMenu} loading={loading} loadError={loadError}
    onPick={index => send({ type: 'pick', index, at: draft.cards.length })}
    onBegin={() => void begin()} />;
  if (page !== 'battle') return <main className="run-results results-layout endless-menu" aria-labelledby="endless-title">
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
      <Button variant="menu" onClick={onBack}>Main menu</Button>
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
