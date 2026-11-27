import type { ConquestVersion } from './conquestAreas.ts';
import type { CardId } from './cards.ts';
import type { PandoraRunEffect } from './pandora.ts';
import type { ShopRingId } from './ringShop.ts';
import { trainingRingProgress } from './character.ts';
import { createRun, replayRun, type RunAction } from './run.ts';
import { replayWithUnlocks } from './unlocks.ts';

/**
 * A ranked log may move the starter Iron Ring to a slot unlocked on this device.
 * Its single physical copy has the same effect in every slot. Allow its placement
 * during verification so equipment and turn resources match the recorded battle.
 * The server uses this transient state only to calculate the final score.
 */
export const replayForScore = (day: string, actions: readonly RunAction[], wins = 0) =>
  replayRun(day, actions, trainingRingProgress(), 0, wins);

/** The same verified replay as replayForScore, plus what the run unlocked. */
export const replayForScoreAndUnlocks = (day: string, actions: readonly RunAction[], wins = 0, shopRings: readonly ShopRingId[] = [], effect?: PandoraRunEffect, cardRules?: 1, carried?: CardId | readonly CardId[], legacyProgression = false, conquestVersion?: ConquestVersion, xpStartWins?: number) =>
  replayWithUnlocks(createRun(day, trainingRingProgress(), 0, wins, shopRings, effect, cardRules, carried, legacyProgression, conquestVersion, xpStartWins), actions);
