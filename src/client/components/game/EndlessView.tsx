import { useCallback, useEffect, useReducer, useState } from 'react';
import { createEndless, reduceEndless } from '../../../shared/game/endless';
import { isRunAction, isRunOver, type RunAction, type RunState } from '../../../shared/game/run';
import { MAX_RUN_ACTIONS } from '../../../shared/game/rules';
import { Button } from '../ui/Button';
import { StatTile } from '../ui/StatTile';
import { VillainRunGame } from './VillainRunGame';

type Session = { day: string; run: RunState; actions: RunAction[]; best: number; started: boolean };
type Event = { type: 'act'; action: RunAction } | { type: 'start' };

/** Restore only this account's Endless log for the date. */
function restore(day: string, key: string): Session {
  const run = createEndless(day);
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value && typeof value === 'object' && 'actions' in value && Array.isArray(value.actions) &&
        value.actions.length <= MAX_RUN_ACTIONS && value.actions.every(isRunAction)) {
      const actions = value.actions;
      const best = 'best' in value && typeof value.best === 'number' && Number.isSafeInteger(value.best) && value.best > 0 ? value.best : 0;
      return { day, run: actions.reduce(reduceEndless, run), actions, best,
        started: actions.length > 0 || ('started' in value && value.started === true) };
    }
  } catch { /* A local save is optional. */ }
  return { day, run, actions: [], best: 0, started: false };
}

/** Keep score and saved actions together so returning to the title never spends a conquest. */
function update(session: Session, event: Event): Session {
  if (event.type === 'start') return { ...session, run: createEndless(session.day), actions: [], started: true };
  const run = reduceEndless(session.run, event.action);
  if (run === session.run) return session;
  return { ...session, run, actions: [...session.actions, event.action],
    best: Math.max(session.best, run.stats.wavesCleared) };
}

/** A completely separate daily-seeded run and local record. */
export function EndlessView({ day, accountId, onBack }: { day: string; accountId?: string | undefined; onBack: () => void }) {
  const key = 'villain-arc:endless:v1:' + (accountId ?? 'guest') + ':' + day;
  const [session, send] = useReducer(update, key, storageKey => restore(day, storageKey));
  const [playing, setPlaying] = useState(false);
  const { run, actions, best, started } = session;
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ actions, best, started })); } catch { /* Play on without saving. */ }
  }, [key, actions, best, started]);
  const act = useCallback((action: RunAction) => send({ type: 'act', action }), []);
  const openMenu = () => setPlaying(false);
  const start = () => { send({ type: 'start' }); setPlaying(true); };
  const finished = isRunOver(run);
  const resumable = started && !finished;
  if (!playing) return <main className="run-results results-layout endless-menu" aria-labelledby="endless-title">
    <header>
      <h1 id="endless-title">Endless</h1>
      <p className="mt-2 text-sm text-ink-muted">Survive as many waves as you can.</p>
    </header>
    <div className="results-stats" style={{ gridTemplateColumns: resumable ? 'repeat(2, minmax(0, 1fr))' : '1fr' }}>
      <StatTile label="Best today" value={best + ' cleared'} />
      {resumable && <StatTile label="Current run" value={'Wave ' + run.stop} />}
    </div>
    <div className="results-actions">
      <Button variant="menuPrimary" onClick={resumable ? () => setPlaying(true) : start}>{resumable ? 'Resume' : 'Start Endless'}</Button>
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
      <Button variant="menuPrimary" onClick={start}>Try again</Button>
      <Button variant="menu" onClick={openMenu}>Endless menu</Button>
    </div>
  </main>;
}
