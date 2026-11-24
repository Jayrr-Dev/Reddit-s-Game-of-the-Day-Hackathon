// ===================================================================
// COMBATANT RULES
// Pure helpers for damage, shroud and statuses. Both the villain and the
// heroes are Combatants, so one set of rules covers both sides.
// ===================================================================

import {
  DREAD_DAMAGE_FACTOR,
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
  shroud: 0,
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
  return Math.max(0, Math.floor(withWrath * damageFactorOf(attacker, type)));
};

// --- UPDATES (EACH RETURNS A NEW COMBATANT) ---

/** Takes a hit: shroud absorbs first, the rest comes off HP. */
export const takeDamage = <T extends Combatant>(
  target: T,
  amount: number
): T => {
  const absorbed = Math.min(target.shroud, amount);
  const dealt = amount - absorbed;
  return {
    ...target,
    shroud: target.shroud - absorbed,
    hp: Math.max(0, target.hp - dealt),
    damageTaken: target.damageTaken + dealt,
  };
};

/** Loses HP directly, ignoring shroud (used by hex and poison). */
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

/** Shroud a card gives, plus the villain's Protection. */
export const guardAmount = (base: number, owner: Combatant): number =>
  base + owner.statuses.protection;

/** Adds shroud. */
export const addShroud = <T extends Combatant>(
  target: T,
  amount: number
): T => ({
  ...target,
  shroud: target.shroud + amount,
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

/** Removes all shroud (at the start of the owner's turn). */
export const clearShroud = <T extends Combatant>(target: T): T => ({
  ...target,
  shroud: 0,
});

/**
 * Hex, right before its bearer's turn: it burns for its value on odd
 * counts only (1, 3, 5 ... nothing on 2, 4 ...), then grows by
 * HEX_GROWTH. So a Hex of 1 deals 1, then 0, then 3, then 0, then 5.
 */
export const hexBurn = <T extends Combatant>(target: T): T => {
  const { hex } = target.statuses;
  if (hex <= 0) return target;
  const burned = hex % 2 === 1 ? loseHp(target, hex) : target;
  return {
    ...burned,
    statuses: { ...burned.statuses, hex: hex + HEX_GROWTH },
  };
};

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
