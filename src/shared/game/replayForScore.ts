import { trainingRingProgress } from './character.ts';
import { replayRun, type RunAction } from './run.ts';

/**
 * A ranked log may move the starter Iron Ring to a slot unlocked on this device.
 * Its single physical copy has the same effect in every slot. Allow its placement
 * during verification so equipment and turn resources match the recorded battle.
 * The server uses this transient state only to calculate the final score.
 */
export const replayForScore = (day: string, actions: readonly RunAction[], wins = 0) =>
  replayRun(day, actions, trainingRingProgress(), 0, wins);
