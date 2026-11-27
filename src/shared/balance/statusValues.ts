// ===================================================================
// STATUS VALUES
// What a stack of each damaging status is worth over its whole life,
// in damage points. Each one replays the real rule from combatant.ts
// or rules.ts, so a rules change moves the prices with it.
// ===================================================================

import {
  afterActionLeft,
  hexAfterCountdown,
  hexBurnAmount,
} from '../game/combatant.ts';
import {
  BLEED_BITE_FACTOR,
  SHOCK_BURST_FACTOR,
  TIERED_CUT_BY_TIER,
  WEAKEN_DAMAGE_FACTOR,
} from '../game/rules.ts';
import type { CostCurveConfig } from './costCurveConfig.ts';

// --- CONSTANTS ---
/** Bound long-lived status simulations to a ten-turn valuation window. */
const MAX_SIMULATED_TURNS = 10;

// --- HELPERS ---
/** Share of value left after `turns` turns of delay. */
const delayed = (config: CostCurveConfig, turns: number): number =>
  config.battle.delayKeptPerTurn ** turns;

// --- DAMAGE OVER TIME ---
/**
 * Hex bursts when applied, after actions, and at turn start. Assume one
 * later action just after each opening, with the usual delay discount.
 */
export const hexValue = (config: CostCurveConfig, stacks: number): number => {
  let total = hexBurnAmount(stacks);
  let hex = stacks;
  for (let turn = 0; hex > 0 && turn < MAX_SIMULATED_TURNS; turn += 1) {
    const weight = delayed(config, turn + 1);
    total += hexBurnAmount(hex) * weight; // Turn opening.
    hex = hexAfterCountdown(hex);
    total += hexBurnAmount(hex) * weight; // The next action.
  }
  return total * config.battle.hexLandsLate;
};

/** Burn N: deals N after an action, then halves (see burnTick). */
export const burnValue = (stacks: number): number => {
  let total = 0;
  for (let burn = stacks; burn > 0; burn = afterActionLeft(burn)) {
    total += burn;
  }
  return total;
};

/** Poison N: deals N before each hero action, then -1 (see poisonTick). */
export const poisonValue = (
  config: CostCurveConfig,
  stacks: number
): number => {
  let total = 0;
  for (let turn = 0; turn < stacks; turn += 1) {
    total += (stacks - turn) * delayed(config, turn);
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
