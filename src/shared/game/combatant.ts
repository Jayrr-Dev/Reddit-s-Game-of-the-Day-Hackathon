// ===================================================================
// COMBATANT RULES
// Pure helpers for damage, guard and statuses. Both the villain and the
// heroes are Combatants, so one set of rules covers both sides.
// ===================================================================

import {
  AFTER_ACTION_DIVISOR,
  BLEED_HITS,
  DREAD_DAMAGE_FACTOR,
  FROST_DAMAGE_PER_STACK,
  HEX_BURN_LOSS,
  HEX_EMPOWERED_DIGIT,
  HEX_EMPOWERED_MULTIPLIER,
  HEX_GROWTH,
  MOMENTUM_DAMAGE_FACTOR,
} from './rules.ts';
import type {
  BuffId,
  CardType,
  Combatant,
  StatusId,
  Statuses,
} from './types.ts';

// --- CONSTRUCTION ---
export const NO_STATUSES: Statuses = {
  hex: 0,
  poison: 0,
  burn: 0,
  frost: 0,
  bleed: 0,
  dread: 0,
  wrath: 0,
  might: 0,
  surge: 0,
  piercing: 0,
  protection: 0,
  momentum: 0,
  aloft: 0,
};

/** Which buff powers up each card type's damage (curses and buffs: none). */
const DAMAGE_BUFF_OF: Partial<Record<CardType, BuffId>> = {
  melee: 'might',
  magic: 'surge',
  range: 'piercing',
};

/** Makes a fresh combatant at the given HP. */
export const createCombatant = (hp: number, maxHp: number): Combatant => ({
  hp,
  maxHp,
  guard: 0,
  statuses: NO_STATUSES,
  damageTaken: 0,
});

// --- QUERIES ---
export const isDefeated = (combatant: Combatant): boolean => combatant.hp <= 0;

/** The buff that powers up a card type's damage, if any. */
export const damageBuffOf = (type?: CardType): BuffId | undefined =>
  type ? DAMAGE_BUFF_OF[type] : undefined;

/** Extra damage per hit a card of `type` gets from the attacker's buffs. */
export const typeBonus = (attacker: Combatant, type?: CardType): number => {
  const buff = damageBuffOf(type);
  return buff ? attacker.statuses[buff] : 0;
};

/** True when a card of `type` is boosted by the attacker's Momentum. */
export const hasMomentumFor = (attacker: Combatant, type?: CardType) =>
  type === 'melee' && attacker.statuses.momentum > 0;

/**
 * The attacker's own damage multiplier for a card type: Momentum
 * (Melee only) times Dread. 1 when neither applies.
 */
export const damageFactorOf = (
  attacker: Combatant,
  type?: CardType
): number => {
  const momentum = hasMomentumFor(attacker, type) ? MOMENTUM_DAMAGE_FACTOR : 1;
  const dread = attacker.statuses.dread > 0 ? DREAD_DAMAGE_FACTOR : 1;
  return momentum * dread;
};

/**
 * Damage per hit after the attacker's wrath, type buff, Momentum and
 * dread. Wrath and the buff (Might, Surge or Piercing, by card type) add
 * first, then Momentum (Melee only) and dread scale, matching the UI.
 */
/**
 * A hit from the attacker's own buffs only (Wrath, its type's buff,
 * Momentum): what a card in hand shows before it is aimed. Debuffs on
 * the attacker (Dread) and anything about the target apply only once
 * it is aimed (attackDamage, then cardHitOn).
 */
export const buffedAttackDamage = (
  base: number,
  attacker: Combatant,
  type?: CardType
): number => {
  const momentum = hasMomentumFor(attacker, type) ? MOMENTUM_DAMAGE_FACTOR : 1;
  const withBuffs = base + attacker.statuses.wrath + typeBonus(attacker, type);
  return Math.max(0, Math.floor(withBuffs * momentum));
};

export const attackDamage = (
  base: number,
  attacker: Combatant,
  type?: CardType
): number => {
  const withWrath = base + attacker.statuses.wrath + typeBonus(attacker, type);
  const factored = Math.floor(withWrath * damageFactorOf(attacker, type));
  const frost = attacker.statuses.frost * FROST_DAMAGE_PER_STACK;
  return Math.max(0, factored - frost);
};

// --- UPDATES (EACH RETURNS A NEW COMBATANT) ---

/** Takes a hit: guard absorbs first, the rest comes off HP. */
export const takeDamage = <T extends Combatant>(
  target: T,
  amount: number
): T => {
  const absorbed = Math.min(target.guard, amount);
  const dealt = amount - absorbed;
  return {
    ...target,
    guard: target.guard - absorbed,
    hp: Math.max(0, target.hp - dealt),
    damageTaken: target.damageTaken + dealt,
  };
};

/**
 * Takes a hit of a type (a card's, or a hero attack's) and counts it
 * toward Bleed: while bleeding, each non-Magic hit in a row adds one,
 * and the BLEED_HITS-th bursts for the whole Bleed (past Guard) and
 * clears it; a Magic hit resets the count.
 */
export const takeHit = <T extends Combatant>(
  target: T,
  amount: number,
  type: CardType
): T => {
  const hit = takeDamage(target, amount);
  const { bleed } = hit.statuses;
  if (bleed <= 0) return hit;
  if (type === 'magic') return { ...hit, bleedHits: 0 };
  const inARow = (hit.bleedHits ?? 0) + 1;
  if (inARow < BLEED_HITS) return { ...hit, bleedHits: inARow };
  const cleared = {
    ...hit,
    bleedHits: 0,
    statuses: { ...hit.statuses, bleed: 0 },
  };
  return loseHp(cleared, bleed);
};

/** Loses HP directly, ignoring guard (hex, poison and burn). */
export const loseHp = <T extends Combatant>(target: T, amount: number): T => ({
  ...target,
  hp: Math.max(0, target.hp - amount),
  damageTaken: target.damageTaken + amount,
});

/** Restores HP up to max. */
export const heal = <T extends Combatant>(target: T, amount: number): T => ({
  ...target,
  hp: Math.min(target.maxHp, target.hp + amount),
});

/** Guard a card gives, plus the villain's Protection. */
export const guardAmount = (base: number, owner: Combatant): number =>
  base + owner.statuses.protection;

/** Adds guard. */
export const addGuard = <T extends Combatant>(
  target: T,
  amount: number
): T => ({
  ...target,
  guard: target.guard + amount,
});

/** Adds stacks of a status. */
export const addStatus = <T extends Combatant>(
  target: T,
  status: StatusId,
  amount: number
): T => ({
  ...target,
  statuses: { ...target.statuses, [status]: target.statuses[status] + amount },
});

/** Removes all guard (at the start of the owner's turn). */
export const clearGuard = <T extends Combatant>(target: T): T => ({
  ...target,
  guard: 0,
});

/** Whether this Hex is the empowered kind (odd, last digit 3). */
const isEmpoweredHex = (hex: number): boolean =>
  hex % 2 === 1 && hex % 10 === HEX_EMPOWERED_DIGIT;

/**
 * What a Hex of this size burns for this turn: nothing when even, its
 * value when odd, and HEX_EMPOWERED_MULTIPLIER times that when its last
 * digit is HEX_EMPOWERED_DIGIT (3 -> 6, 13 -> 26).
 */
export const hexBurnAmount = (hex: number): number => {
  if (hex <= 0 || hex % 2 === 0) return 0;
  return isEmpoweredHex(hex) ? hex * HEX_EMPOWERED_MULTIPLIER : hex;
};

/**
 * What a Hex becomes after its bearer's turn starts:
 *   even         grows by HEX_GROWTH (it is building toward a burn)
 *   odd          burned, so it loses HEX_BURN_LOSS of itself, ROUNDED UP,
 *                so it always drops by at least 1 and never sticks
 *                (1 -> 0, 5 -> 3, 7 -> 4)
 *   odd, ends 3  burned double, so it clears
 */
export const hexAfterTurn = (hex: number): number => {
  if (hex <= 0) return 0;
  if (hex % 2 === 0) return hex + HEX_GROWTH;
  if (isEmpoweredHex(hex)) return 0;
  return hex - Math.ceil(hex * HEX_BURN_LOSS);
};

/**
 * Hex, right before its bearer's turn: it burns (see hexBurnAmount),
 * then moves on (see hexAfterTurn). So Hex 7 deals 7, 0, 5, 6 and is
 * gone (7 -> 4 -> 5 -> 3 -> cleared).
 */
export const hexBurn = <T extends Combatant>(target: T): T => {
  const { hex } = target.statuses;
  if (hex <= 0) return target;
  const burned = loseHp(target, hexBurnAmount(hex));
  return {
    ...burned,
    statuses: { ...burned.statuses, hex: hexAfterTurn(hex) },
  };
};

/**
 * What an after-action status (Burn, Frost) drops to: divided by
 * AFTER_ACTION_DIVISOR to the nearest whole, an exact half rounding
 * DOWN (3 -> 1, 1 -> 0), so it always runs out instead of sticking at 1.
 */
const afterActionLeft = (stacks: number): number =>
  Math.ceil(stacks / AFTER_ACTION_DIVISOR - 0.5);

/** Burn, right after an action: it deals its value, then halves. */
export const burnTick = <T extends Combatant>(target: T): T => {
  const { burn } = target.statuses;
  if (burn <= 0) return target;
  const burned = loseHp(target, burn);
  const left = afterActionLeft(burn);
  return { ...burned, statuses: { ...burned.statuses, burn: left } };
};

/** Frost, right after an action: it halves (its hits are already softer). */
export const frostThaw = <T extends Combatant>(target: T): T => {
  const { frost } = target.statuses;
  if (frost <= 0) return target;
  const left = afterActionLeft(frost);
  return { ...target, statuses: { ...target.statuses, frost: left } };
};

/** Everything that runs right after a unit's action: Burn, then Frost. */
export const afterAction = <T extends Combatant>(target: T): T =>
  frostThaw(burnTick(target));

/**
 * End-of-turn upkeep: poison deals its damage then weakens by 1, dread
 * wears off by 1, and unused Momentum is lost. Wrath and buffs are
 * permanent for the fight (Hex runs before the turn: see hexBurn).
 */
export const endOfTurnUpkeep = <T extends Combatant>(target: T): T => {
  const { poison, dread } = target.statuses;
  const poisoned = loseHp(target, poison);
  return {
    ...poisoned,
    statuses: {
      ...poisoned.statuses,
      poison: Math.max(0, poison - 1),
      dread: Math.max(0, dread - 1),
      momentum: 0,
    },
  };
};
