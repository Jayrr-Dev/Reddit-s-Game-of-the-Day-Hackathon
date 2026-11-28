// ===================================================================
// STATUS VALUES
// What a stack of each damaging status is worth over its whole life,
// in damage points. Each one replays the real rule from combatant.ts
// or rules.ts, so a rules change moves the prices with it.
// ===================================================================

import {
  afterActionLeft,
  hexAfterGrowth,
  hexBurnAmount,
  poisonAfterTick,
} from '../game/combatant.ts';
import {
  BLEED_BITE_FACTOR,
  SHOCK_BURST_FACTOR,
  TIERED_CUT_BY_TIER,
  WEAKEN_DAMAGE_FACTOR,
} from '../game/rules.ts';
import type { CostCurveConfig } from './costCurveConfig.ts';

// --- HELPERS ---
/** Share of value left after `turns` turns of delay. */
const delayed = (config: CostCurveConfig, turns: number): number =>
  config.battle.delayKeptPerTurn ** turns;

// --- DAMAGE OVER TIME ---
/**
 * Value the application, follow-up Hex cards that raise this target by one,
 * and turn openings while the target survives.
 */
export const hexValue = (config: CostCurveConfig, stacks: number): number => {
  const { hexCardsPerTurn, afflictionTurnsLeft } = config.battle;
  let hex = stacks;
  // This turn's Hex plays include the application itself.
  let total = hexBurnAmount(hex);
  for (let action = 1; action < hexCardsPerTurn; action += 1) {
    hex = hexAfterGrowth(hex);
    total += hexBurnAmount(hex);
  }
  // Later turns: check the opening and each follow-up Hex card.
  for (let turn = 1; turn < afflictionTurnsLeft; turn += 1) {
    let turnDamage = hexBurnAmount(hex);
    for (let action = 0; action < hexCardsPerTurn; action += 1) {
      hex = hexAfterGrowth(hex);
      turnDamage += hexBurnAmount(hex);
    }
    total += turnDamage * delayed(config, turn);
  }
  return total * config.battle.hexLandsLate;
};

/** Stack value across action ticks, halving after each tick. */
export const halvingValue = (stacks: number): number => {
  let total = 0;
  for (let burn = stacks; burn > 0; burn = afterActionLeft(burn)) {
    total += burn;
  }
  return total;
};

/** Burn values its immediate damage separately from the full stacks it leaves. */
export const burnValue = (stacks: number): number => stacks + halvingValue(stacks);

/** Poison deals its value per tick and loses one stack until it expires. */
export const poisonValue = (
  config: CostCurveConfig,
  stacks: number
): number => {
  let total = 0;
  let poison = stacks;
  for (let turn = 0; poison > 0; turn += 1) {
    total += poison * delayed(config, turn);
    poison = poisonAfterTick(poison);
  }
  return total;
};

/** Bleed N: each later physical attack bites ⅓ (rounded up), then -1. */
export const bleedValue = (config: CostCurveConfig, stacks: number): number => {
  let total = 0;
  let bleed = stacks;
  for (let attack = 0; attack < config.battle.laterAttacksForBleed; attack += 1) {
    if (bleed <= 0) break;
    total += Math.ceil(bleed * BLEED_BITE_FACTOR);
    bleed -= 1;
  }
  return total;
};

/** Shock N: bursts for N × SHOCK_BURST_FACTOR when it goes off. */
export const shockValue = (config: CostCurveConfig, stacks: number): number =>
  stacks * SHOCK_BURST_FACTOR * config.battle.shockBurstChance;

// --- DAMAGE PREVENTED ---
/** Weaken N: the hero deals 25% less for N turns. */
export const weakenValue = (config: CostCurveConfig, turns: number): number =>
  turns * (1 - WEAKEN_DAMAGE_FACTOR) * config.battle.heroHitDamage;

/** Enfeeble ×times: a tier each (25% / 50% / 75% cut) for two hero turns. */
export const enfeebleValue = (
  config: CostCurveConfig,
  times: number,
  turns: number
): number => {
  const tier = Math.min(times, TIERED_CUT_BY_TIER.length - 1);
  return (TIERED_CUT_BY_TIER[tier] ?? 0) * config.battle.heroHitDamage * turns;
};
