// ===================================================================
// UNIT POWER
// A power score for every hero, in the same damage points as the card
// cost curve (costCurve.ts), so a unit and a card can be compared.
//
//   threat     = damage points a unit's moves are worth per turn
//                (averaged over its move cycle, both phases)
//   toughness  = effective HP: HP, plus a second phase, scaled up for
//                Armor and for standing out of Melee reach
//   turnsToKill = toughness / the villain's damage per turn
//                 (ENERGY_PER_TURN × energyValue: what a turn of cards buys)
//   power      = threat × turnsToKill
//
// Power reads as "the damage this unit deals you before you can kill
// it". It multiplies offence by staying power, like Lanchester's law
// for fighting strength, so a glass cannon and a wall can both score
// high, but a unit that is weak at both can't.
// ===================================================================

import { foldPerHitAfflictions, getHero, HEROES, type HeroId } from '../game/heroes.ts';
import {
  ALOFT_EVASION,
  ELEMENT_ON_HIT,
  ENERGY_PER_TURN,
  LONG_RANGE_DAMAGE_FACTOR,
  SHOCK_BURST_FACTOR,
  TIERED_CUT_BY_TIER,
  WEAKEN_DAMAGE_FACTOR,
} from '../game/rules.ts';
import type { HeroDef, HeroEffect, HeroHitProc, HeroMove, HeroTier } from '../game/types.ts';
import type { CostCurveConfig } from './costCurveConfig.ts';
import { bleedValue, burnValue, hexValue, poisonValue, shockValue } from './statusValues.ts';

// --- TYPES ---
/** One unit's power score and what it is made of. */
export type UnitPower = {
  id: HeroId;
  name: string;
  tier: HeroTier;
  hp: number;
  threat: number;
  toughness: number;
  turnsToKill: number;
  power: number;
};

// --- SHARED ---
/** The villain's damage per turn: a full turn of energy at the curve's price. */
export const villainDamagePerTurn = (config: CostCurveConfig): number =>
  ENERGY_PER_TURN * config.curve.energyValue;

/** Every hero id in the catalog. */
const ALL_HERO_IDS = Object.keys(HEROES).filter((id): id is HeroId => Object.hasOwn(HEROES, id));

/** True for a hero that is off the back of the field (Range bonus applies). */
const isBehindFront = (def: HeroDef): boolean => def.row !== 'front';

// --- AFFLICTIONS ON THE VILLAIN ---
/** Prices N stacks of an affliction a hero lays on the villain. */
const afflictionValue = (config: CostCurveConfig, proc: HeroHitProc): number => {
  const { amount } = proc;
  switch (proc.status) {
    case 'hex':
      return hexValue(config, amount);
    case 'poison':
      return poisonValue(config, amount);
    case 'burn':
      return burnValue(amount);
    case 'frost':
      return burnValue(amount);
    case 'bleed':
      return bleedValue(config, amount);
    case 'shock':
      return shockValue(config, amount);
    case 'weaken':
      return amount * (1 - WEAKEN_DAMAGE_FACTOR) * villainDamagePerTurn(config);
  }
};

// --- MOVES ---
/** Prices a hero attack: its hits, the Range bonus, and per-hit afflictions. */
const attackValue = (
  config: CostCurveConfig,
  def: HeroDef,
  move: HeroMove,
  attack: Extract<HeroEffect, { kind: 'attack' }>
): number => {
  const rangeBonus = attack.type === 'range' && isBehindFront(def) ? LONG_RANGE_DAMAGE_FACTOR : 1;
  const element = move.element ? ELEMENT_ON_HIT[move.element] : null;
  const elementProcs: HeroHitProc[] = element?.status === 'frost' ? [{ status: 'frost', amount: element.amount }] : [];
  const procs = [...(attack.perHit ?? []), ...elementProcs];
  const procPoints = procs.reduce(
    (sum, proc) => sum + afflictionValue(config, { ...proc, amount: proc.amount * attack.hits }),
    0
  );
  return attack.amount * attack.hits * rangeBonus + procPoints;
};

/** How many helped units an effect's `who` means. */
const helpedCount = (config: CostCurveConfig, who: 'self' | 'allies'): number =>
  who === 'allies' ? 1 + config.unit.alliesHelped : 1;

/** Prices one effect of a hero move (everything but attacks and summons). */
const supportValue = (config: CostCurveConfig, effect: HeroEffect): number => {
  const { unit, prices, curve } = config;
  const villainTurn = villainDamagePerTurn(config);
  switch (effect.kind) {
    case 'hex':
    case 'poison':
    case 'burn':
    case 'frost':
    case 'bleed':
    case 'shock':
    case 'weaken':
      return afflictionValue(config, { status: effect.kind, amount: effect.amount });
    case 'guard':
      return Math.min(effect.amount, villainTurn) * helpedCount(config, effect.who);
    case 'heal':
      return effect.amount * unit.healUsed * helpedCount(config, effect.who);
    case 'wrath':
      return effect.amount * unit.allyHitsPerMove * unit.turnsLeft * helpedCount(config, effect.who);
    case 'protect':
      return (TIERED_CUT_BY_TIER[1] ?? 0) * villainTurn * (effect.turns ?? 1);
    case 'cleanse':
      return prices.cleanse * helpedCount(config, effect.who);
    case 'cloak':
      return effect.amount * prices.cloakPerTurn;
    case 'dispel':
      return effect.amount * prices.dispelPerBuff;
    case 'disrupt':
      return effect.amount * prices.disruptPerStack * prices.dispelPerBuff;
    case 'malaise':
      return effect.amount * prices.malaisePerTurn;
    case 'pin':
      return effect.amount * prices.pinPerTurn;
    case 'scramble':
      return effect.amount * unit.scrambleEnergy * curve.energyValue;
    case 'fatigue':
      return effect.amount * unit.fatigueEnergyShare * curve.energyValue * (effect.all ? ENERGY_PER_TURN : 1);
    case 'knockBack':
    case 'pullPlayer':
    case 'advanceSelf':
      return effect.lines * prices.movePerRow;
    case 'detonate':
      return config.battle.shockOnTarget * SHOCK_BURST_FACTOR;
    case 'soar':
      return villainTurn * ALOFT_EVASION * unit.soarShare;
    case 'revive':
      return unit.revive;
    case 'attack':
    case 'summon':
      return 0;
  }
};

/**
 * Prices one move: attacks, support, and summons (each summoned unit's
 * threat for the turns left; a summon's own summons are not counted).
 */
const moveValue = (config: CostCurveConfig, def: HeroDef, move: HeroMove, countSummons: boolean): number =>
  foldPerHitAfflictions(move.effects).reduce((sum, effect) => {
    if (effect.kind === 'attack') return sum + attackValue(config, def, move, effect);
    if (effect.kind === 'summon') {
      const summoned = countSummons ? threatOf(config, getHero(effect.heroId), false) : 0;
      return sum + effect.count * summoned * config.unit.turnsLeft;
    }
    return sum + supportValue(config, effect);
  }, 0);

/** Average value of a list of moves (they cycle in order). */
const averageMove = (config: CostCurveConfig, def: HeroDef, moves: readonly HeroMove[], countSummons: boolean): number =>
  moves.length === 0 ? 0 : moves.reduce((sum, move) => sum + moveValue(config, def, move, countSummons), 0) / moves.length;

// --- THREAT ---
/**
 * Damage points a unit is worth per turn: its average move (both
 * phases, weighted by the HP each phase has), times moves per turn
 * (Vigor adds one), plus its passives.
 */
export const threatOf = (config: CostCurveConfig, def: HeroDef, countSummons = true): number => {
  const firstPhase = averageMove(config, def, def.moves, countSummons);
  const phase = def.secondPhase;
  const secondShare = phase ? phase.restoreHpFraction / (1 + phase.restoreHpFraction) : 0;
  const secondPhase = phase ? averageMove(config, def, phase.moves, countSummons) : 0;
  const perMove = firstPhase * (1 - secondShare) + secondPhase * secondShare;
  const passives = def.passives ?? [];
  const movesPerTurn = 1 + (passives.includes('vigor') ? config.unit.vigorShare : 0);
  const passiveBonus =
    1 +
    (passives.includes('longRange') ? config.unit.longRangeBonus : 0) +
    (passives.includes('anchored') ? config.unit.anchoredBonus : 0);
  return perMove * movesPerTurn * passiveBonus;
};

// --- TOUGHNESS ---
/**
 * Effective HP: HP plus any second phase, divided by the share of the
 * villain's damage that Armor lets through, times the shield for
 * standing out of Melee reach.
 */
export const toughnessOf = (config: CostCurveConfig, def: HeroDef): number => {
  const { unit } = config;
  const phaseHp = def.secondPhase ? def.maxHp * def.secondPhase.restoreHpFraction : 0;
  const villainHit = villainDamagePerTurn(config) / unit.villainHitsPerTurn;
  const armorCut = Math.min(def.armor ?? 0, villainHit) / villainHit;
  const takenShare = 1 - unit.physicalShare * armorCut;
  const rowShield = def.row === 'horizon' ? unit.horizonShield : def.row === 'back' ? unit.backlineShield : 0;
  return ((def.maxHp + phaseHp) / takenShare) * (1 + rowShield);
};

// --- POWER ---
/** Rounds to one decimal for display and stable tests. */
const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Scores one unit. */
export const unitPower = (config: CostCurveConfig, id: HeroId): UnitPower => {
  const def = getHero(id);
  const threat = threatOf(config, def);
  const toughness = toughnessOf(config, def);
  const turnsToKill = toughness / villainDamagePerTurn(config);
  return {
    id,
    name: def.name,
    tier: def.tier,
    hp: def.maxHp,
    threat: round1(threat),
    toughness: round1(toughness),
    turnsToKill: round1(turnsToKill),
    power: round1(threat * turnsToKill),
  };
};

/** Scores every unit, strongest first. */
export const allUnitPowers = (config: CostCurveConfig): UnitPower[] =>
  ALL_HERO_IDS.map((id) => unitPower(config, id)).sort((a, b) => b.power - a.power);
