// ===================================================================
// GAME SCREEN (INLINE IN THE POST)
// Loads the day, then hands off to the session: title screen -> run ->
// results, or title screen -> target-dummy practice. Data loading and
// side effects live in hooks; this file only decides which screen is
// showing.
// ===================================================================

import { useCallback, useEffect, useState, useRef, type ReactNode } from 'react';
import { showToast } from '@devvit/web/client';
import { canChooseRegion, regionOfRun } from '../../shared/game/regionRoutes';
import { isRunOver, type RunAction } from '../../shared/game/run';
import type { FinishRunResponse, InitResponse, RingShopResponse, StartRunResponse } from '../../shared/types/api';
import { useDailyGame } from '../hooks/useDailyGame';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useRun } from '../hooks/useRun';
import { useRunJourney } from '../hooks/useRunJourney';
import { useRunSubmission } from '../hooks/useRunSubmission';
import { playSound } from '../lib/gameAudio';
import { apiClient } from '../lib/apiClient';
import { PlayerName } from '../lib/playerName';
import { AccountId } from '../lib/accountId';
import { IsAdmin } from '../lib/adminRole';
import { journeys } from '../lib/journeys';
import { MapExpansionScope, mapExpansionScope, readMapHandoff } from '../lib/mapExpansion';
import { MikhaelEnding } from './game/MikhaelEnding';
import { goldRewardFor } from '../../shared/game/gold';
import { optionsFor } from '../../shared/game/run';
import { ConquestPrelude, RegionCrossroads } from './game/ConquestPrelude';
import { StarterPicker } from './game/StarterPicker';
import type { PlayerBuild } from '../../shared/game/playerBuild';
import { IntroView } from './game/IntroView';
import { EndlessView } from './game/EndlessView';
import { ResultsView } from './game/ResultsView';
import { SandboxView } from './game/SandboxView';
import { StoryDefeat, VillainRunGame } from './game/VillainRunGame';
import { Screen } from './ui/Screen';

// --- TYPES ---
type SessionProps = {
  data: InitResponse;
  startRun: (testVisit?: string, bringCards?: string[], starter?: import('../../shared/game/starters').StarterName) => Promise<StartRunResponse>;
  finishRun: (actions: RunAction[], runId?: string) => Promise<FinishRunResponse>;
};

// --- SESSION ---
/** One visit to the post: title screen, any number of runs, results. */
const GameSession = ({ data, startRun, finishRun }: SessionProps) => {
  const { run, actions, hasProgress, act, restart, profile } = useRun(data.dailyKey, data.accountId);
  const { entries, refresh } = useLeaderboard();
  const mapScope = mapExpansionScope(data.accountId, data.dailyKey, run.attempt, profile?.id);
  const [isPlaying, setIsPlaying] = useState(() => hasProgress && !isRunOver(run) && !!readMapHandoff(mapScope));
  const withMapScope = (content: ReactNode) => <MapExpansionScope.Provider value={mapScope}>{content}</MapExpansionScope.Provider>;
  const onMainMenu = () => setIsPlaying(false);
  const [choosing, setChoosing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);
  const [endlessOpen, setEndlessOpen] = useState(false);
  const [viewedDefeat, setViewedDefeat] = useState(false);
  const isFallen = run.phase.kind === 'fallen';
  const isFinished = isRunOver(run);
  const canResume = hasProgress && !isFinished;
  const canBindOldPrep = !!data.accountId && canResume && !profile && run.stop === 1 &&
    run.phase.kind === 'route' && !actions.some(action => action.type === 'chooseStop');

  const visitKey = 'villain-arc:test-shop:' + (data.accountId ?? 'guest');
  const [initialShopVisit] = useState(() => {
    if (!data.isAdmin) return undefined;
    try { return sessionStorage.getItem(visitKey) ?? undefined; } catch { return undefined; }
  });
  const shopTestVisit = useRef<string>(initialShopVisit);
  const setShopTestVisit = useCallback((visit: string | undefined) => {
    shopTestVisit.current = visit;
    try {
      if (visit) sessionStorage.setItem(visitKey, visit);
      else sessionStorage.removeItem(visitKey);
    } catch { /* test shop still works without browser storage */ }
  }, [visitKey]);
  const loadTestShop = useCallback(async (): Promise<RingShopResponse> => {
    const existing = shopTestVisit.current;
    let result = await apiClient.ringShop(existing);
    if (existing && !result.testVisit) result = await apiClient.ringShop();
    if (result.testVisit && shopTestVisit.current === existing) setShopTestVisit(result.testVisit);
    return result;
  }, [setShopTestVisit]);
  const latest = useRef(actions);
  useEffect(() => { latest.current = actions; }, [actions]);
  const id = profile?.id;
  useEffect(() => {
    if (!id || !run.goldVictories.length) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const save = () => apiClient.progress({ runId: id, actions: latest.current }).catch(() => {
      if (active) timer = setTimeout(save, 5000);
    });
    void save();
    return () => { active = false; clearTimeout(timer); };
  }, [id, run.goldVictories.length]);
  const submit = useCallback((log: RunAction[]) => finishRun(log, id), [finishRun, id]);
  const onSaved = useCallback(() => void refresh(), [refresh]);
  const { submission, reset } = useRunSubmission({
    run,
    actions,
    isActive: isPlaying,
    finishRun: submit,
    onSaved,
  });
  useRunJourney(run, isPlaying);

  /** Claims the run with the server (ranked or practice), then plays. */
  const handleStart = async (build?: PlayerBuild, bringCards?: string[]) => {
    if (!canResume && !build) {
      playSound('conquestOpen', 1, .8);
      setChoosing(true);
      return;
    }
    setIsStarting(true);
    setViewedDefeat(false);
    try {
      if (!canResume || canBindOldPrep) {
        const started = await startRun(shopTestVisit.current, bringCards, build?.selected ?? run.rewardStarter);
        if (data.accountId && !started.profile) throw new Error('Could not load your saved character. Try again before starting.');
        restart(started.profile, build ?? started.build);
        playSound('conquestStart', 1, .7);
        reset();
      }
      setChoosing(false);
      journeys.start();
      setIsPlaying(true);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not start the run'
      );
    } finally {
      setIsStarting(false);
    }
  };

  if (endlessOpen) return <EndlessView key={data.dailyKey} day={data.dailyKey} accountId={data.accountId}
    rings={run.character.ringProgress} onBack={() => setEndlessOpen(false)} />;
  if (choosing) return <StarterPicker accountId={data.accountId} starting={isStarting} onBack={()=>setChoosing(false)} onConfirm={(build, bringCard) => void handleStart(build, bringCard)} {...(data.isAdmin && { loadTestShop })} />;
  if (isPracticing)
    return <SandboxView onExit={() => setIsPracticing(false)} />;
  if (!isPlaying) {
    return (
      <IntroView
        profileRings={run.character.ringProgress}
        data={data}
        entries={entries}
        canResume={canResume}
        activeRunLevel={canResume && !canBindOldPrep ? run.character.level : undefined}
        isStarting={isStarting}
        onStart={() => void handleStart()}
        onEndless={() => setEndlessOpen(true)}
        onPractice={() => setIsPracticing(true)}
        onShopTestVisit={setShopTestVisit}
        {...(data.isAdmin && { loadTestShop })}
      />
    );
  }
  if (run.phase.kind === 'route' && run.stop === 1) {
    const seed = id ?? [data.accountId ?? 'guest', run.dailyKey, run.attempt].join(':');
    return withMapScope(<ConquestPrelude key={seed} seed={seed} options={run.phase.options} worldSeed={run.dailyKey} atlasOptions={at => optionsFor(run, at)}
      runControls={{ run, onAction: act, onMainMenu }}
      onChoose={(option, hellArtifact) => act({ type: 'chooseStop', option, ...(hellArtifact && { hellArtifact }) })} />);
  }
  if (run.phase.kind === 'sealing') {
    const gold = id ? goldRewardFor(id, run.stop, 'champion', run.pandoraEffect, run.area?.battle, run.goldVictories.at(-1)?.waves, run.goldVictories.at(-1)?.pushes) : undefined;
    return <MikhaelEnding gold={gold}
      onContinue={() => act({ type: 'finishSealing' })} />;
  }
  if (run.phase.kind === 'fallen' && run.phase.battlefield && !viewedDefeat)
    return <StoryDefeat run={run} onContinue={() => setViewedDefeat(true)} />;
  if (isFinished) {
    return (
      <ResultsView
        stats={run.stats}
        conquered={!isFallen}
        ringDrops={run.ringDrops}
        submission={submission}
        entries={entries}
        onPlayAgain={() => void handleStart()}
        onBackToMenu={() => setIsPlaying(false)}
      />
    );
  }
  if (canChooseRegion(run))
    return <RegionCrossroads key={run.stop} stop={run.stop} campaign={!!run.conquestVersion}
      conquered={regionOfRun({ ...run, stop: run.stop - 1 })}
      onChoose={option => act({ type: 'chooseRegion', option })} />;
  return withMapScope(<VillainRunGame run={run} runId={id} onAction={act} onMainMenu={onMainMenu} />);
};

// --- COMPONENT ---
/** Renders loading, error, or the playable session. */
export const GameScreen = () => {
  const { state, startRun, finishRun } = useDailyGame();
  const isReady = state.status === 'ready';

  // TELL JOURNEYS THE GAME IS INTERACTIVE (ONCE, AFTER DATA LOADS)
  useEffect(() => {
    if (isReady) journeys.appReady();
  }, [isReady]);

  if (state.status === 'loading') return <Screen>Gathering the horde…</Screen>;
  if (state.status === 'error')
    return <Screen>Something went wrong: {state.message}</Screen>;
  return (
    <PlayerName.Provider value={state.data.username}><AccountId.Provider value={state.data.accountId}><IsAdmin.Provider value={state.data.isAdmin}><GameSession key={state.data.accountId} data={state.data} startRun={startRun} finishRun={finishRun} /></IsAdmin.Provider></AccountId.Provider></PlayerName.Provider>
  );
};
