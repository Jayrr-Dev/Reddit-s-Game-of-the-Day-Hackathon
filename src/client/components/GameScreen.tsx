// ===================================================================
// GAME SCREEN (INLINE IN THE POST)
// Loads the day, then hands off to the session: title screen -> run ->
// results, or title screen -> target-dummy practice. Data loading and
// side effects live in hooks; this file only decides which screen is
// showing.
// ===================================================================

import { useCallback, useEffect, useState } from 'react';
import { showToast } from '@devvit/web/client';
import type { RunAction } from '../../shared/game/run';
import type { FinishRunResponse, InitResponse } from '../../shared/types/api';
import { useDailyGame } from '../hooks/useDailyGame';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useRun } from '../hooks/useRun';
import { useRunJourney } from '../hooks/useRunJourney';
import { useRunSubmission } from '../hooks/useRunSubmission';
import { journeys } from '../lib/journeys';
import { IntroView } from './game/IntroView';
import { ResultsView } from './game/ResultsView';
import { SandboxView } from './game/SandboxView';
import { VillainArcGame } from './game/VillainArcGame';
import { Screen } from './ui/Screen';

// --- TYPES ---
type SessionProps = {
  data: InitResponse;
  startRun: () => Promise<boolean>;
  finishRun: (actions: RunAction[]) => Promise<FinishRunResponse>;
};

// --- SESSION ---
/** One visit to the post: title screen, any number of runs, results. */
const GameSession = ({ data, startRun, finishRun }: SessionProps) => {
  const { run, actions, hasProgress, act, restart } = useRun(data.dailyKey);
  const { entries, refresh } = useLeaderboard();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);
  const isFallen = run.phase.kind === 'fallen';
  const canResume = hasProgress && !isFallen;

  const onSaved = useCallback(() => void refresh(), [refresh]);
  const { submission, reset } = useRunSubmission({
    run,
    actions,
    isActive: isPlaying,
    finishRun,
    onSaved,
  });
  useRunJourney(run, isPlaying);

  /** Claims the run with the server (ranked or practice), then plays. */
  const handleStart = async () => {
    setIsStarting(true);
    try {
      if (!canResume) {
        restart();
        reset();
        await startRun();
      }
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

  if (isPracticing)
    return <SandboxView onExit={() => setIsPracticing(false)} />;
  if (!isPlaying) {
    return (
      <IntroView
        data={data}
        entries={entries}
        canResume={canResume}
        isStarting={isStarting}
        onStart={() => void handleStart()}
        onPractice={() => setIsPracticing(true)}
      />
    );
  }
  if (isFallen) {
    return (
      <ResultsView
        stats={run.stats}
        submission={submission}
        entries={entries}
        onPlayAgain={() => void handleStart()}
        onBackToMenu={() => setIsPlaying(false)}
      />
    );
  }
  return <VillainArcGame run={run} onAction={act} />;
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
    <GameSession data={state.data} startRun={startRun} finishRun={finishRun} />
  );
};
