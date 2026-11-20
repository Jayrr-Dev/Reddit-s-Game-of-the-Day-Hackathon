// ===================================================================
// PLACEHOLDER GAME
// Stand-in for the real game. It exists only to exercise the full loop
// (start -> play -> score -> leaderboard -> streak -> Journeys) so the
// plumbing is proven before the real mechanic is chosen.
// Replace this component with the actual game; keep the onFinish contract.
// ===================================================================

import { useState } from 'react';
import { Button } from './ui/Button';
import { journeys } from '../lib/journeys';

// --- CONSTANTS ---
const TAPS_TO_FINISH = 10;

// --- TYPES ---
export type PlaceholderGameProps = {
  /** Called once with the final score when the run ends. */
  onFinish: (score: number) => void;
};

// --- COMPONENT ---
/** Tap the button TAPS_TO_FINISH times; score is taps per second x 100. */
export const PlaceholderGame = ({ onFinish }: PlaceholderGameProps) => {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [taps, setTaps] = useState(0);

  // HANDLERS
  const handleStart = () => {
    setStartedAt(Date.now());
    setTaps(0);
    journeys.start();
  };

  const handleTap = () => {
    if (startedAt === null) return;
    const nextTaps = taps + 1;
    setTaps(nextTaps);
    journeys.progress(nextTaps / TAPS_TO_FINISH, 'tap');

    if (nextTaps < TAPS_TO_FINISH) return;
    const seconds = (Date.now() - startedAt) / 1000;
    const score = Math.round((TAPS_TO_FINISH / Math.max(seconds, 0.1)) * 100);
    setStartedAt(null);
    journeys.end({ complete: true, win: true, score });
    onFinish(score);
  };

  // RENDER
  if (startedAt === null)
    return <Button onClick={handleStart}>Play today's challenge</Button>;
  return (
    <Button onClick={handleTap}>
      Tap! {taps}/{TAPS_TO_FINISH}
    </Button>
  );
};
