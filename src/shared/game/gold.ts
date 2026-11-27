import { REALM_APPLE, SHOP_APPLE, type ShopApple } from './items.ts';
import type { PandoraRunEffect } from './pandora.ts';
import type { StopKind } from './kingdom.ts';
import { hashSeed, nextInt } from './rng.ts';

export type GoldEncounter = Extract<StopKind, 'horde' | 'elite' | 'champion'>;
export type GoldVictory = { stop: number; encounter: GoldEncounter; battle?: number };

export const GOLD_RANGES = {
  horde: [10, 20],
  elite: [25, 35],
  champion: [95, 105],
} as const;

// Seeded per attempt and stop. Refreshing, rerolling cards or replaying the run cannot reroll Gold.
export function goldRewardFor(runId: string, stop: number, encounter: GoldEncounter, effect?: PandoraRunEffect, battle?: number): number {
  const [min, max] = GOLD_RANGES[encounter];
  const [roll] = nextInt(hashSeed(`villain-run:gold:${runId}:${stop}${battle ? ':' + battle : ''}`), max - min + 1);
  return (min + roll) * (effect === 'half-life-double-gold' ? 2 : 1);
}

/** A verified ordinary victory occasionally drops an Apple for Metatron. */
export function appleAtVictory(runId: string, stop: number, encounter: GoldEncounter, battle?: number): ShopApple | undefined {
  if (encounter === 'champion') return undefined;
  const [realm] = nextInt(hashSeed(`villain-run:realm-apple:${runId}:${stop}${battle ? ':' + battle : ''}`), 100);
  if (realm < 2) return REALM_APPLE;
  return nextInt(hashSeed(`villain-run:apple:${runId}:${stop}${battle ? ':' + battle : ''}`), 100)[0] < 10 ? SHOP_APPLE : undefined;
}

// Older victory records stored a nonnegative wave index and paid a flat 10 Gold.
export const goldFromVictoryScore = (score: number): number => score < 0 ? -score : 10;
