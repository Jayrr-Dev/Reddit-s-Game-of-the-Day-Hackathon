// ===================================================================
// USE RUN JOURNEY
// Reports run milestones to Devvit Journeys: progress whenever the
// villain reaches a new stop, and the end when the villain falls.
// Events only fire while a run is actively played in this session.
// ===================================================================

import { useEffect } from 'react';
import { REGION_NAMES, STOPS_PER_REGION } from '../../shared/game/rules';
import { computeScore, type RunState } from '../../shared/game/run';
import { journeys } from '../lib/journeys';

// --- CONSTANTS ---
/** Taking the throne counts as 100% progress; the march continues past it. */
const STOPS_TO_THRONE = REGION_NAMES.length * STOPS_PER_REGION;

// --- HOOK ---
/** Sends progress and end events as the run advances. */
export const useRunJourney = (run: RunState, isActive: boolean): void => {
  const isFallen = run.phase.kind === 'fallen';

  // PROGRESS: ONE EVENT PER NEW STOP
  useEffect(() => {
    if (!isActive || run.stop <= 1) return;
    journeys.progress(
      Math.min(1, (run.stop - 1) / STOPS_TO_THRONE),
      `stop-${run.stop}`
    );
  }, [isActive, run.stop]);

  // END: WHEN THE HEROES STOP THE VILLAIN
  useEffect(() => {
    if (!isActive || !isFallen) return;
    journeys.end({
      complete: true,
      win: run.stats.regionsConquered >= REGION_NAMES.length,
      score: computeScore(run.stats),
    });
  }, [isActive, isFallen, run.stats]);
};
