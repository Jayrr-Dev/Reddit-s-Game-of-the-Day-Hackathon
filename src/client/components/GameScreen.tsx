// ===================================================================
// GAME SCREEN (INLINE IN THE POST)
// Loads the day, then hands off to the session: title screen -> run ->
// results, or title screen -> target-dummy practice. Data loading and
// side effects live in hooks; this file only decides which screen is
// showing.
// ===================================================================

import { useCallback, useEffect, useState, useRef } from 'react';
import { showToast } from '@devvit/web/client';
import type { RunAction } from '../../shared/game/run';
import type { FinishRunResponse, InitResponse, StartRunResponse } from '../../shared/types/api';
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
import { StarterPicker } from './game/StarterPicker';
import type { PlayerBuild } from '../../shared/game/playerBuild';
import { IntroView } from './game/IntroView';
import { ResultsView } from './game/ResultsView';
import { SandboxView } from './game/SandboxView';
import { StoryDefeat, VillainRunGame } from './game/VillainRunGame';
import { Screen } from './ui/Screen';

// --- TYPES ---
type SessionProps = {
  data: InitResponse;
  startRun: (testVisit?: string, bringCard?: string) => Promise<StartRunResponse>;
  finishRun: (actions: RunAction[], runId?: string) => Promise<FinishRunResponse>;
};

// --- SESSION ---
/** One visit to the post: title screen, any number of runs, results. */
const GameSession = ({ data, startRun, finishRun }: SessionProps) => {
  const { run, actions, hasProgress, act, restart, profile } = useRun(data.dailyKey, data.accountId);
  const { entries, refresh } = useLeaderboard();
  const [isPlaying, setIsPlaying] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);
  const [viewedDefeat, setViewedDefeat] = useState(false);
  const isFallen = run.phase.kind === 'fallen';
  const canResume = hasProgress && !isFallen;

  const shopTestVisit = useRef<string>(undefined);
  const setShopTestVisit = useCallback((visit: string | undefined) => { shopTestVisit.current = visit; }, []);
  const latest = useRef(actions);
  useEffect(() => { latest.current = actions; }, [actions]);
  const id = profile?.id;
  useEffect(() => {
    if (!id || !run.stats.wavesCleared) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const save = () => apiClient.progress({ runId: id, actions: latest.current }).catch(() => {
      if (active) timer = setTimeout(save, 5000);
    });
    void save();
    return () => { active = false; clearTimeout(timer); };
  }, [id, run.stats.wavesCleared]);
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
  const handleStart = async (build?: PlayerBuild, bringCard?: string) => {
    if (!canResume && !build) {
      playSound('conquestOpen', 1, .8);
      setChoosing(true);
      return;
    }
    setIsStarting(true);
    setViewedDefeat(false);
    try {
      if (!canResume) {
        const started = await startRun(shopTestVisit.current, bringCard);
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

  if (choosing) return <StarterPicker accountId={data.accountId} starting={isStarting} onBack={()=>setChoosing(false)} onConfirm={(build, bringCard) => void handleStart(build, bringCard)} testVisit={shopTestVisit.current} />;
  if (isPracticing)
    return <SandboxView onExit={() => setIsPracticing(false)} />;
  if (!isPlaying) {
    return (
      <IntroView
        profileRings={run.character.ringProgress}
        data={data}
        entries={entries}
        canResume={canResume}
        isStarting={isStarting}
        onStart={() => void handleStart()}
        onPractice={() => setIsPracticing(true)}
        onShopTestVisit={setShopTestVisit}
      />
    );
  }
  if (run.phase.kind === 'fallen' && run.phase.battlefield && !viewedDefeat)
    return <StoryDefeat run={run} onContinue={() => setViewedDefeat(true)} />;
  if (isFallen) {
    return (
      <ResultsView
        stats={run.stats}
        ringDrops={run.ringDrops}
        submission={submission}
        entries={entries}
        onPlayAgain={() => void handleStart()}
        onBackToMenu={() => setIsPlaying(false)}
      />
    );
  }
  return <VillainRunGame run={run} runId={id} onAction={act} />;
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
