// ===================================================================
// COST CURVE
// Scores every card against the cost curve (see costCurveConfig.ts for
// the method and every tunable number). Pure functions only: the CLI
// in scripts/card-balance.ts prints what these return.
// ===================================================================

import {
  ALL_CARD_IDS,
  getCard,
  hitsPerPlay,
  isCardInPlay,
  type CardId,
} from '../game/cards.ts';
import {
  ELEMENT_ON_HIT,
  MOMENTUM_DAMAGE_FACTOR,
  STACKING_BUFF_TURNS,
  TIERED_CUT_BY_TIER,
} from '../game/rules.ts';
import type {
  BaseCardEffect,
  CardDef,
  CardEffect,
  CardKeyword,
  CardRarity,
  CardType,
} from '../game/types.ts';
import type { CostCurveConfig } from './costCurveConfig.ts';
import {
  bleedValue,
  burnValue,
  enfeebleValue,
  hexValue,
  poisonValue,
  shockValue,
  weakenValue,
} from './statusValues.ts';

// --- TYPES ---
/** One priced piece of a card: what it is and its damage points. */
export type ValuePart = { label: string; points: number };

export type Verdict = 'too strong' | 'on curve' | 'too weak';

/** A card's score on the curve. */
export type CardScore = {
  id: CardId;
  name: string;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  value: number;
  target: number;
  ratio: number;
  verdict: Verdict;
  parts: ValuePart[];
};

/**
 * How an effect is multiplied on the card it sits on: hits per play
 * (afflictions land per hit) and picks (Target N repeats damage).
 */
type EffectContext = {
  reach: boolean;
  afflictionHits: number;
  damageScale: number;
};

// --- SHARED PRICES ---
/** A free move (keyword move, Rush): the button price, when it's useful. */
const freeMoveValue = (config: CostCurveConfig): number =>
  config.curve.energyValue *
  config.movement.avgButtonEnergy *
  config.movement.moveUsefulChance;

/** Heroes an ALL effect hits: the front line for Melee, else everyone. */
const areaSize = (config: CostCurveConfig, reach: boolean): number =>
  reach ? config.battle.heroesInReach : config.battle.heroesInFrontLine;

/** Multiplier for a target: 1 for one hero, area minus overkill for ALL. */
const targetScale = (
  config: CostCurveConfig,
  target: string | undefined,
  reach: boolean
): number =>
  target === 'all' ? areaSize(config, reach) * config.battle.areaOverkill : 1;

/** Value of a buff stack that boosts every relevant hit left in the fight. */
const fightBuffValue = (
  config: CostCurveConfig,
  amount: number,
  hitsLeft: number
): number => amount * hitsLeft * config.battle.delayKeptPerTurn;

// --- EFFECT PRICES ---
/** Prices a buff effect (fight-long, this turn or this action). */
const priceBuff = (
  config: CostCurveConfig,
  effect: Extract<BaseCardEffect, { kind: 'buff' }>
): number => {
  const { buff, amount, duration } = effect;
  if (duration === 'turn') return amount * config.prices.hitsThisTurn;
  if (duration === 'action') return amount * config.prices.hitsThisAction;
  switch (buff) {
    case 'might':
    case 'surge':
    case 'hone':
      return fightBuffValue(config, amount, config.buffHitsLeft[buff]);
    case 'reinforce':
      return amount * config.prices.reinforcedGuardCards;
    case 'bane':
      return amount * config.prices.baneAfflictionsLeft;
    case 'instinct':
      return (
        (TIERED_CUT_BY_TIER[Math.min(amount, TIERED_CUT_BY_TIER.length - 1)] ?? 0) *
        config.battle.incomingPerTurn
      );
    case 'sharpshooter':
      return config.prices.sharpshooter;
    case 'berserker':
      return config.prices.berserker;
    case 'reflex':
      return config.prices.reflex;
    case 'invincible':
      return amount * config.prices.invincible;
  }
};

/** Prices an effect that lands on heroes (damage and afflictions). */
const priceHostile = (
  config: CostCurveConfig,
  effect: BaseCardEffect,
  context: EffectContext
): number | null => {
  const { battle } = config;
  const target = 'target' in effect ? effect.target : undefined;
  const area = targetScale(config, target, context.reach);
  const perHit = context.afflictionHits * area;
  switch (effect.kind) {
    case 'damage': {
      const aim = effect.target === 'random' ? battle.randomAim : 1;
      return effect.amount * effect.hits * context.damageScale * aim * area;
    }
    case 'hex':
      return hexValue(config, effect.amount) * area;
    case 'burn':
      return burnValue(effect.amount) * perHit;
    case 'poison':
      return poisonValue(config, effect.amount) * perHit;
    case 'bleed':
      return bleedValue(config, effect.amount * context.afflictionHits) * area;
    case 'shock':
      return shockValue(config, effect.amount) * area;
    case 'frost':
      return burnValue(effect.amount * context.afflictionHits) * area;
    case 'weaken':
      return weakenValue(config, effect.amount) * area;
    case 'enfeeble':
      return enfeebleValue(config, effect.times ?? 1, STACKING_BUFF_TURNS) * area;
    case 'vex':
      return effect.amount * config.prices.vexPerStack * area;
    case 'scramble':
      return effect.amount * config.prices.scrambleShare * battle.heroHitDamage * area;
    case 'malaise':
      return effect.amount * config.prices.malaisePerTurn * area;
    case 'pin':
      return effect.amount * config.prices.pinPerTurn * area;
    case 'dispel':
      return effect.amount * config.prices.dispelPerBuff * area;
    case 'disrupt':
      return (
        effect.amount * config.prices.disruptPerStack * area +
        (effect.hitLimitTurns ?? 0) * config.prices.hitLimitShare * battle.incomingPerTurn
      );
    case 'reap':
      return effect.multiplier * battle.hexOnTarget;
    case 'amplify':
      return shockValue(config, battle.shockOnTarget * (effect.factor - 1));
    case 'pull':
      return effect.rows * config.prices.movePerRow;
    case 'push':
      return effect.rows * config.prices.movePerRow * (effect.target === 'all' ? battle.heroesInReach : 1);
    default:
      return null;
  }
};

/** Prices an effect on the villain (defence, draw, energy, movement). */
const priceSelf = (config: CostCurveConfig, effect: BaseCardEffect): number => {
  const { prices, movement, curve } = config;
  switch (effect.kind) {
    case 'guard':
      return effect.amount * prices.guard;
    case 'heal':
      return effect.amount * prices.heal;
    case 'brace':
      return effect.amount * prices.bracePerStack;
    case 'cleanse':
      return prices.cleanse;
    case 'draw':
      return effect.amount * prices.draw;
    case 'energy':
      return effect.amount * curve.energyValue;
    case 'armor':
      return effect.amount * config.battle.physicalHitsLeft * config.battle.delayKeptPerTurn;
    case 'cloak':
      return effect.amount * prices.cloakPerTurn;
    case 'wrath':
      return fightBuffValue(config, effect.amount, config.buffHitsLeft.wrath);
    case 'protect':
      return (TIERED_CUT_BY_TIER[1] ?? 0) * config.battle.incomingPerTurn * STACKING_BUFF_TURNS;
    case 'buff':
      return priceBuff(config, effect);
    case 'rush':
      return (
        freeMoveValue(config) +
        (effect.amount - 1) * curve.energyValue * movement.avgButtonEnergy * movement.secondMoveUsefulChance
      );
    case 'charge':
    case 'backStep':
      // Same move as the button for the same energy: it only saves the streak.
      return curve.energyValue * movement.streakEnergySaved;
    case 'momentum':
      return (MOMENTUM_DAMAGE_FACTOR - 1) * movement.meleeCardDamage * movement.meleeFollowsChance;
    case 'move':
      return movement.extraRowsValue;
    default:
      return 0;
  }
};

/** Prices one base effect: hostile first, then villain-side. */
const priceBaseEffect = (
  config: CostCurveConfig,
  effect: BaseCardEffect,
  context: EffectContext
): number => priceHostile(config, effect, context) ?? priceSelf(config, effect);

// --- KEYWORDS ---
/** Prices a keyword on a card that deals `damage` points a play. */
export const keywordValue = (
  config: CostCurveConfig,
  keyword: CardKeyword,
  damage: number
): number => {
  const { keywords } = config;
  const freeMove = freeMoveValue(config);
  switch (keyword) {
    case 'charge':
      return freeMove + (MOMENTUM_DAMAGE_FACTOR - 1) * damage * keywords.chargeMomentumChance;
    case 'distance':
      return freeMove;
    case 'rampage':
      return keywords.rampageKillChance * freeMove + keywords.rampageShare * damage;
    case 'piercing':
      return keywords.piercingShare * damage + keywords.piercingFlat;
    case 'longRange':
      return keywords.longRangeShare * damage + keywords.longRangeFlat;
    case 'hold':
      return keywords.hold;
    case 'remove':
      return keywords.remove;
    case 'exhaust':
      return keywords.exhaust;
    case 'unique':
      return keywords.unique;
  }
};

// --- IMBUES ---
/** Prices an imbue: its gift, on a typical card, for the plays left. */
const priceImbue = (
  config: CostCurveConfig,
  effect: Extract<CardEffect, { kind: 'imbue' }>
): ValuePart => {
  const { playsLeft, hitsPerPlay } = config.imbue;
  const { gift } = effect;
  if (gift.kind === 'keyword') {
    const points = keywordValue(config, gift.keyword, config.movement.meleeCardDamage);
    return { label: `imbue ${gift.keyword}`, points: points * playsLeft };
  }
  const context: EffectContext = { reach: true, afflictionHits: hitsPerPlay, damageScale: hitsPerPlay };
  const points = priceBaseEffect(config, gift.effect, context);
  return { label: `imbue ${gift.effect.kind}`, points: points * playsLeft };
};

// --- CARDS ---
/** Labels a priced effect ("damage", "buff might", "hex"). */
const effectLabel = (effect: BaseCardEffect): string =>
  effect.kind === 'buff' ? effect.buff : effect.kind;

/** Prices every effect, element and keyword on a card. */
export const cardValueParts = (config: CostCurveConfig, card: CardDef): ValuePart[] => {
  const context: EffectContext = {
    reach: card.reach,
    afflictionHits: Math.max(1, hitsPerPlay(card)),
    damageScale: card.targets,
  };
  const effectParts = card.effects.map((effect) =>
    effect.kind === 'imbue'
      ? priceImbue(config, effect)
      : { label: effectLabel(effect), points: priceBaseEffect(config, effect, context) }
  );
  const damage = effectParts
    .filter((part) => part.label === 'damage')
    .reduce((sum, part) => sum + part.points, 0);
  const elementPart = elementValuePart(card);
  const keywordParts = card.keywords.map((keyword) => ({
    label: keyword,
    points: keywordValue(config, keyword, damage),
  }));
  const killPart = card.costReductionPerKill
    ? [{ label: 'cheaper per kill', points: config.keywords.cheaperPerKill }]
    : [];
  return [...effectParts, ...elementPart, ...keywordParts, ...killPart];
};

/** An element's on-hit status (Ice: Frost 1 per hit), priced as Frost. */
const elementValuePart = (card: CardDef): ValuePart[] => {
  const onHit = card.element ? ELEMENT_ON_HIT[card.element] : null;
  if (!onHit || onHit.status !== 'frost') return [];
  return [{ label: 'ice frost', points: burnValue(onHit.amount * hitsPerPlay(card)) }];
};

/** What a card of this cost and rarity should be worth. */
export const targetValue = (config: CostCurveConfig, cost: number, rarity: CardRarity): number => {
  const { cardSlot, energyValue, zeroCostFloor } = config.curve;
  const base = cost === 0 ? zeroCostFloor : cardSlot + energyValue * cost;
  return base * config.rarityPremium[rarity];
};

/** Too strong, on curve or too weak, from the value / target ratio. */
export const verdictFor = (config: CostCurveConfig, ratio: number): Verdict => {
  if (ratio > config.verdict.tooStrongAbove) return 'too strong';
  if (ratio < config.verdict.tooWeakBelow) return 'too weak';
  return 'on curve';
};

/** Rounds to one decimal for display and stable tests. */
const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Scores one card against the curve. */
export const scoreCard = (config: CostCurveConfig, id: CardId): CardScore => {
  const card = getCard(id);
  const parts = cardValueParts(config, card).map((part) => ({ ...part, points: round1(part.points) }));
  const value = round1(parts.reduce((sum, part) => sum + part.points, 0));
  const target = round1(targetValue(config, card.cost, card.rarity));
  const ratio = Math.round((value / target) * 100) / 100;
  return {
    id,
    name: card.name,
    type: card.type,
    rarity: card.rarity,
    cost: card.cost,
    value,
    target,
    ratio,
    verdict: verdictFor(config, ratio),
    parts,
  };
};

/** Scores every card in play, strongest ratio first. */
export const scoreAllCards = (config: CostCurveConfig): CardScore[] =>
  ALL_CARD_IDS.filter(isCardInPlay)
    .map((id) => scoreCard(config, id))
    .sort((a, b) => b.ratio - a.ratio);
