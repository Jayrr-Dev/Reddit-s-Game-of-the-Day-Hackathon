// ===================================================================
// GAME SCREEN (EXPANDED VIEW)
// Composes the daily loop: stats header, the game, and the leaderboard.
// Data loading lives in hooks; this component only arranges the pieces.
// ===================================================================

import { useEffect } from 'react';
import { showToast } from '@devvit/web/client';
import { GAME_TITLE } from '../../shared/constants/game';
import type { InitResponse } from '../../shared/types/api';
import { useDailyGame } from '../hooks/useDailyGame';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { journeys } from '../lib/journeys';
import { LeaderboardList } from './LeaderboardList';
import { PlaceholderGame } from './PlaceholderGame';
import { Screen } from './ui/Screen';
import { StatTile } from './ui/StatTile';

// --- SUBCOMPONENTS ---

/** Day label plus the player's streak and best score. */
const DailyHeader = ({ data }: { data: InitResponse }) => (
  <header className="flex flex-col items-center gap-2">
    <h1 className="font-display text-2xl font-bold">{GAME_TITLE}</h1>
    <p className="text-sm text-ink-muted">{data.dailyKey}</p>
    <div className="flex gap-2">
      <StatTile label="Streak" value={data.streak.current} />
      <StatTile label="Best streak" value={data.streak.best} />
      <StatTile label="Today's best" value={data.bestScoreToday ?? '–'} />
    </div>
  </header>
);

// --- COMPONENT ---
/** Renders loading, error, or the playable daily screen. */
export const GameScreen = () => {
  const { state, submitScore } = useDailyGame();
  const { entries, refresh } = useLeaderboard();
  const isReady = state.status === 'ready';

  // TELL JOURNEYS THE GAME IS INTERACTIVE (ONCE, AFTER DATA LOADS)
  useEffect(() => {
    if (isReady) journeys.appReady();
  }, [isReady]);

  /** Saves the run, then refreshes the board and tells the player their rank. */
  const handleFinish = async (score: number) => {
    try {
      const result = await submitScore(score);
      await refresh();
      showToast(
        result.rank
          ? `Score ${score}! You're #${result.rank} today.`
          : `Score ${score}!`
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not save score'
      );
    }
  };

  if (state.status === 'loading') return <Screen>Loading…</Screen>;
  if (state.status === 'error')
    return <Screen>Something went wrong: {state.message}</Screen>;

  return (
    <Screen>
      <DailyHeader data={state.data} />
      <PlaceholderGame onFinish={(score) => void handleFinish(score)} />
      <LeaderboardList entries={entries} />
    </Screen>
  );
};
