export const BATTLE_WAVES = { skirmish: 5, regimental: 10, grand: 15 } as const;
export const KEEP_FIGHTING_GOLD_RATE = 0.25;
export const EXPLORE_RESUPPLY_FRACTION = 0.12;

/** Older fights still show their wave count without a new tier name. */
export function battleTierName(waves: number): string | undefined {
  if (waves >= BATTLE_WAVES.grand) return 'Grand Battle';
  if (waves >= BATTLE_WAVES.regimental) return 'Regimental';
  if (waves >= BATTLE_WAVES.skirmish) return 'Skirmish';
}

/** Both Gold and XP are multiplied after the whole battle is won. */
export function battleRewardMultiplier(waves = 0): number {
  return waves >= BATTLE_WAVES.grand ? 3 : waves >= BATTLE_WAVES.regimental ? 2 : 1;
}
