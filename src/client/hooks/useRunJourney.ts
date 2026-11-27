// ===================================================================
// USE RUN JOURNEY
// Reports run milestones to Devvit Journeys: progress whenever the
// villain reaches a new stop, and the end when the villain falls.
// Events only fire while a run is actively played in this session.
// ===================================================================

import { useEffect } from 'react';
import { REGION_NAMES, STOPS_PER_REGION } from '../../shared/game/rules';
import { CAMPAIGN_LENGTH } from '../../shared/game/conquestAreas';
import { computeScore, isRunOver, type RunState } from '../../shared/game/run';
import { journeys } from '../lib/journeys';

// --- CONSTANTS ---
/** Taking the throne counts as 100% progress; the march continues past it. */
const STOPS_TO_THRONE = REGION_NAMES.length * STOPS_PER_REGION;

// --- HOOK ---
/** Sends progress and end events as the run advances. */
export const useRunJourney = (run: RunState, isActive: boolean): void => {
  const isFinished = isRunOver(run);
  const wonCampaign = run.phase.kind === 'conquered';
  const conquest = !!run.conquestVersion;

  // PROGRESS: ONE EVENT PER NEW STOP
  useEffect(() => {
    if (!isActive || run.stop <= 1) return;
    journeys.progress(
      Math.min(1, (run.stop - 1) / (conquest ? CAMPAIGN_LENGTH * STOPS_PER_REGION : STOPS_TO_THRONE)),
      `stop-${run.stop}`
    );
  }, [isActive, run.stop, conquest]);

  // END: WHEN THE HEROES STOP THE VILLAIN
  useEffect(() => {
    if (!isActive || !isFinished) return;
    journeys.end({
      complete: true,
      win: conquest ? wonCampaign : run.stats.regionsConquered >= REGION_NAMES.length,
      score: computeScore(run.stats),
    });
  }, [isActive, isFinished, conquest, wonCampaign, run.stats]);
};
