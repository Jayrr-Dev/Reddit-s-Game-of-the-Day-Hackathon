// ===================================================================
// PLAYER POWER
// A ballpark power score for the villain at a given level and play
// style, on the same scale as unit power (unitPower.ts):
//
//   power = damage per turn × toughness / 24
//   toughness = HP / (share of a boss's turn that still lands)
//
// Guard and Distance on the deck's cards stop part of each boss turn
// (the `player` group of costCurveConfig.ts), which stretches HP the
// way Armor and rows stretch a unit's.
//
// Unit power is threat × toughness / 24, so the two compare directly:
// by Lanchester's law, whoever has the higher damage × HP wins a duel,
// so a player whose power is above a boss's is favoured 1-on-1.
//
// Assumptions (all optimistic, "optimal cards"):
// - Trait points (2 a level) go where they raise power most: a search
//   over Vigor, Endurance and the style's damage traits, using the real
//   trait boards (characterBonuses).
// - Skill points (1 a level) buy the style's circles in order
//   (playerStyles.ts).
// - Each turn the hand holds the best mix of the style's cards for the
//   energy and cards drawn (up to 2 copies, 1 of a Legendary). Remove,
//   Exhaust, Imbue, buff and pure Guard cards are left out.
// - Guard and Distance count on an AVERAGE draw (each copy is in hand
//   cardsPerTurn / deck size of the time), not every turn.
// - Iron Ring and Traveler's Amulet are worn.
// ===================================================================

import { characterBonuses, TRAIT_CAP, type Traits } from '../game/character.ts';
import { ALL_CARD_IDS, getCard, isCardInPlay } from '../game/cards.ts';
import type { CardDef, CardEffect } from '../game/types.ts';
import { cardValueParts } from './costCurve.ts';
import type { CostCurveConfig } from './costCurveConfig.ts';
import type { PlayStyle, SkillStep } from './playerStyles.ts';
import { villainDamagePerTurn } from './unitPower.ts';

// --- TYPES ---
type Stats = ReturnType<typeof characterBonuses>;

/** The multipliers bought on the skill tree. */
type SkillBonus = { damage: number; affliction: number; stacks: number; bought: string[] };

/** One style at one level. */
export type PlayerPower = {
  level: number;
  style: string;
  traits: Partial<Traits>;
  skills: string[];
  energy: number;
  hp: number;
  damagePerTurn: number;
  /** Incoming damage a turn's Guard and Distance stop. */
  blockedPerTurn: number;
  /** Effective HP: HP stretched by the damage blocked. */
  toughness: number;
  power: number;
};

// --- CONSTANTS ---
const TRAIT_POINTS_PER_LEVEL = 2;
const SKILL_POINTS_PER_LEVEL = 1;
const WORN = { rings: ['iron-ring', null, null, null, null], amulet: 'travelers-amulet' };
const AFFLICTION_LABELS = new Set(['hex', 'poison', 'burn', 'bleed', 'shock', 'frost', 'ice frost']);
const DAMAGE_KEYWORD_LABELS = new Set(['piercing', 'longRange']);
const STACKING_KINDS = new Set(['hex', 'poison', 'burn', 'bleed', 'shock', 'frost']);

// --- SKILLS ---
/** Buys the style's skill steps in order with `points`. */
export const skillBonusAt = (skills: readonly SkillStep[], points: number): SkillBonus => {
  const bonus: SkillBonus = { damage: 1, affliction: 1, stacks: 1, bought: [] };
  let left = points;
  for (const step of skills) {
    if (step.points > left) break;
    left -= step.points;
    bonus.damage *= step.damage ?? 1;
    bonus.affliction *= step.affliction ?? 1;
    bonus.stacks *= step.stacks ?? 1;
    bonus.bought.push(step.name);
  }
  return bonus;
};

// --- CARDS ---
/** True for a card a style's deck plays every turn (no one-shots, buffs or imbues). */
const isRepeatableAttack = (card: CardDef, style: PlayStyle): boolean =>
  style.cardTypes.includes(card.type) &&
  !card.keywords.includes('remove') &&
  !card.keywords.includes('exhaust') &&
  card.effects.every((effect) => effect.kind !== 'imbue' && effect.kind !== 'buff') &&
  card.effects.some((effect) => effect.kind === 'damage' || STACKING_KINDS.has(effect.kind));

/** The style's cards, as defs. */
const styleCards = (style: PlayStyle): CardDef[] =>
  ALL_CARD_IDS.filter(isCardInPlay)
    .map(getCard)
    .filter((card) => isRepeatableAttack(card, style));

/** Trait damage bonus for a card type: percent and flat (see offensiveBonus). */
const typeBonus = (stats: Stats, card: CardDef): { percent: number; flat: number } => {
  if (card.type === 'melee') return { percent: stats.meleePercent, flat: stats.meleeFlat };
  if (card.type === 'range') return { percent: stats.rangePercent, flat: stats.rangeFlat };
  if (card.type === 'magic') return { percent: stats.magicPercent, flat: stats.magicFlat };
  return { percent: 0, flat: 0 };
};

/** A card with trait damage and extra affliction stacks folded in. */
const buffedCard = (card: CardDef, stats: Stats, skills: SkillBonus): CardDef => {
  const { percent, flat } = typeBonus(stats, card);
  const effects = card.effects.map((effect): CardEffect => {
    if (effect.kind === 'damage') {
      const perHit = (effect.amount * (100 + percent)) / 100 + Math.floor(flat / Math.max(1, effect.hits));
      return { ...effect, amount: perHit };
    }
    if (effect.kind === 'hex') return { ...effect, amount: effect.amount + stats.afflictionFlat };
    if (STACKING_KINDS.has(effect.kind) && 'amount' in effect) {
      return { ...effect, amount: Math.round((effect.amount + stats.afflictionFlat) * skills.stacks) };
    }
    return effect;
  });
  return { ...card, effects };
};

/** Damage one play of a card deals (hits, afflictions, Piercing), with these stats and skills. */
const cardDamage = (config: CostCurveConfig, card: CardDef, stats: Stats, skills: SkillBonus): number => {
  const crit = card.type === 'range' || card.type === 'magic' ? 1 + stats.accuracyPercent / 100 : 1;
  return cardValueParts(config, buffedCard(card, stats, skills)).reduce((sum, part) => {
    if (part.label === 'damage') return sum + part.points * crit * skills.damage;
    if (AFFLICTION_LABELS.has(part.label)) {
      return sum + part.points * (1 + stats.afflictionDamagePercent / 100) * skills.affliction;
    }
    // Piercing and Longrange add damage; guard, moves and draw are not damage.
    return DAMAGE_KEYWORD_LABELS.has(part.label) ? sum + part.points * skills.damage : sum;
  }, 0);
};

// --- DEFENCE ---
/** Guard one play of a card gives, with Vigor's percent and Endurance's flat bonus (see guardAmount). */
const cardGuard = (card: CardDef, stats: Stats): number =>
  card.effects.reduce((sum, effect) => {
    if (effect.kind !== 'guard') return sum;
    return sum + Math.floor((effect.amount * (100 + stats.shieldPercent)) / 100) + stats.shieldFlat;
  }, 0);

/** Incoming damage one play of a card stops this turn: its Guard, plus a dodge for Distance. */
const cardBlock = (config: CostCurveConfig, card: CardDef, stats: Stats): number => {
  const { incomingPerTurn, distanceDodgeShare } = config.player;
  const dodge = card.keywords.includes('distance') ? distanceDodgeShare * incomingPerTurn : 0;
  return cardGuard(card, stats) + dodge;
};

// --- HAND ---
/** One card the deck holds: what it costs, deals and stops, and how many copies the deck has. */
type DeckCard = { cost: number; damage: number; block: number; copies: number };

/** One turn: the best damage hand, and the damage stopped on an average draw. */
type Turn = { damage: number; blocked: number; toughness: number };

/**
 * Most damage one turn's hand can deal: a knapsack over energy and
 * cards drawn, each card up to its copies (2, or 1 for a Legendary).
 */
const bestDamage = (deck: DeckCard[], energy: number, cards: number): number => {
  // best[e][n]: most damage spending at most e energy on at most n cards.
  const best = Array.from({ length: energy + 1 }, () => new Array<number>(cards + 1).fill(0));
  for (const card of deck) {
    for (let copy = 0; copy < card.copies; copy += 1) {
      // Walk downwards so each copy is added at most once (0/1 knapsack in place).
      for (let e = energy; e >= card.cost; e -= 1) {
        for (let n = cards; n >= 1; n -= 1) {
          const withCard = (best[e - card.cost]?.[n - 1] ?? 0) + card.damage;
          if (withCard > (best[e]?.[n] ?? 0)) best[e]![n] = withCard;
        }
      }
    }
  }
  return best[energy]?.[cards] ?? 0;
};

/**
 * Damage stopped on an AVERAGE turn, not the best one: each copy of a
 * Guard or Distance card is in hand cardsPerTurn / deck size of the
 * time. A deck with one Guard card can't hold it every turn, so
 * defence is counted by draw odds while damage stays a ceiling.
 */
const averageBlock = (config: CostCurveConfig, deck: DeckCard[], cards: number): number => {
  const deckSize = deck.reduce((sum, card) => sum + card.copies, 0);
  const inHand = deckSize === 0 ? 0 : Math.min(1, cards / deckSize);
  const blocked = deck.reduce((sum, card) => sum + card.block * card.copies * inHand, 0);
  return Math.min(blocked, config.player.incomingPerTurn * config.player.maxBlockedShare);
};

/** One turn for a style with these stats and skills. */
const styleTurn = (config: CostCurveConfig, style: PlayStyle, stats: Stats, skills: SkillBonus): Turn => {
  const deck = styleCards(style).map((card) => ({
    cost: card.cost,
    damage: cardDamage(config, card, stats, skills),
    block: cardBlock(config, card, stats),
    copies: card.rarity === 'legendary' ? 1 : 2,
  }));
  const blocked = averageBlock(config, deck, stats.cardsPerTurn);
  // HP lasts 1 / (share of a boss turn that still lands).
  const toughness = 1 / (1 - blocked / config.player.incomingPerTurn);
  return { damage: bestDamage(deck, stats.startingEnergy, stats.cardsPerTurn), blocked, toughness };
};

// --- TRAIT SEARCH ---
/** Every way to split `points` between the style's damage traits (step 2 for two). */
const damageSplits = (style: PlayStyle, points: number): Partial<Traits>[] => {
  const [first, second] = style.damageTraits;
  if (!first) return [{}];
  if (!second) return [{ [first]: Math.min(TRAIT_CAP, points) }];
  const splits: Partial<Traits>[] = [];
  for (let a = 0; a <= Math.min(TRAIT_CAP, points); a += 2) {
    splits.push({ [first]: a, [second]: Math.min(TRAIT_CAP, points - a) });
  }
  return splits;
};

/** Scores one style at one level, searching for the strongest trait split. */
export const playerPower = (config: CostCurveConfig, style: PlayStyle, level: number): PlayerPower => {
  const traitPoints = TRAIT_POINTS_PER_LEVEL * level;
  const skills = skillBonusAt(style.skills, SKILL_POINTS_PER_LEVEL * level);
  const turnCache = new Map<string, Turn>();
  let best: PlayerPower | null = null;
  for (let vigor = 0; vigor <= Math.min(TRAIT_CAP, traitPoints); vigor += 2) {
    for (let endurance = 0; endurance <= Math.min(TRAIT_CAP, traitPoints - vigor); endurance += 2) {
      for (const split of damageSplits(style, traitPoints - vigor - endurance)) {
        const traits = { ...split, vigor, endurance };
        const stats = characterBonuses(traits, WORN);
        // The hand depends only on damage traits, energy and Guard bonuses, not on HP.
        const key = `${JSON.stringify(split)}|${stats.startingEnergy}|${stats.shieldPercent}|${stats.shieldFlat}`;
        const turn = turnCache.get(key) ?? styleTurn(config, style, stats, skills);
        turnCache.set(key, turn);
        const toughness = stats.maxHp * turn.toughness;
        const power = (turn.damage * toughness) / villainDamagePerTurn(config);
        if (!best || power > best.power) {
          best = {
            level, style: style.label, traits, skills: skills.bought, energy: stats.startingEnergy, hp: stats.maxHp,
            damagePerTurn: turn.damage, blockedPerTurn: turn.blocked, toughness, power,
          };
        }
      }
    }
  }
  if (!best) throw new Error('No trait split found');
  return { ...best, damagePerTurn: Math.round(best.damagePerTurn), toughness: Math.round(best.toughness), power: Math.round(best.power) };
};
