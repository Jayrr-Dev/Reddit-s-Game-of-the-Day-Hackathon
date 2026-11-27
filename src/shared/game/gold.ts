import type { StopKind } from './kingdom.ts';
import { hashSeed, nextInt } from './rng.ts';

export type GoldEncounter = Extract<StopKind, 'horde' | 'elite' | 'champion'>;
export type GoldVictory = { stop: number; encounter: GoldEncounter };

export const GOLD_RANGES = {
  horde: [10, 20],
  elite: [25, 35],
  champion: [95, 105],
} as const;

// Seeded per attempt and stop. Refreshing, rerolling cards or replaying the run cannot reroll Gold.
export function goldRewardFor(runId: string, stop: number, encounter: GoldEncounter): number {
  const [min, max] = GOLD_RANGES[encounter];
  const [roll] = nextInt(hashSeed(`villain-run:gold:${runId}:${stop}`), max - min + 1);
  return min + roll;
}

// Older victory records stored a nonnegative wave index and paid a flat 10 Gold.
export const goldFromVictoryScore = (score: number): number => score < 0 ? -score : 10;
