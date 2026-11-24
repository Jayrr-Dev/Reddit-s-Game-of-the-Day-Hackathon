// ===================================================================
// COMBATANT RULES
// Pure helpers for damage, guard and statuses. Both the villain and the
// heroes are Combatants, so one set of rules covers both sides.
// ===================================================================

import {
  AFTER_ACTION_DIVISOR,
  SHOCK_HITS,
  WEAKEN_DAMAGE_FACTOR,
  FROST_DAMAGE_PER_STACK,
  HEX_BURN_LOSS,
  HEX_EMPOWERED_DIGIT,
  HEX_EMPOWERED_MULTIPLIER,
  HEX_GROWTH,
  BANE_AFFLICTIONS,
  MOMENTUM_DAMAGE_FACTOR,
  SHARPSHOOTER_DAMAGE_FACTOR,
  PHYSICAL_TYPES,
  TIERED_CUT_BY_TIER,
  TIERED_MAX_TIER,
  STATUS_IS_AFFLICTION,
} from './rules.ts';
import { pickOne, type RngState } from './rng.ts';
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
  shock: 0,
  bleed: 0,
  vex: 0,
  weaken: 0,
  wrath: 0,
  might: 0,
  surge: 0,
  hone: 0,
  reinforce: 0,
  sharpshooter: 0,
  bane: 0,
  instinct: 0,
  momentum: 0,
  protection: 0,
  enfeeble: 0,
  brace: 0,
  aloft: 0,
  rush: 0,
  armor: 0,
};

/** Which buff powers up each card type's damage (curses and buffs: none). */
const DAMAGE_BUFF_OF: Partial<Record<CardType, BuffId>> = {
  melee: 'might',
  magic: 'surge',
  range: 'hone',
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

/**
 * How many stacks of `status` land: the base, plus the attacker's Bane
 * and the target's Vex when given (both only boost BANE_AFFLICTIONS).
 */
export const afflictionAmount = (
  base: number,
  attacker: Combatant,
  status: StatusId,
  target?: Combatant
): number => {
  if (!BANE_AFFLICTIONS.has(status)) return base;
  return base + attacker.statuses.bane + (target?.statuses.vex ?? 0);
};

/** True when a card of `type` is boosted by the attacker's Momentum. */
export const hasMomentumFor = (attacker: Combatant, type?: CardType) =>
  type === 'melee' && attacker.statuses.momentum > 0;

/** True when a card of `type` is boosted by the attacker's Sharpshooter. */
export const hasSharpshooterFor = (attacker: Combatant, type?: CardType) =>
  type === 'range' && attacker.statuses.sharpshooter > 0;

/**
 * The attacker's own boosts for a card type: Momentum (Melee) and
 * Sharpshooter (Range). 1 when none applies.
 */
const boostFactorOf = (attacker: Combatant, type?: CardType): number =>
  (hasMomentumFor(attacker, type) ? MOMENTUM_DAMAGE_FACTOR : 1) *
  (hasSharpshooterFor(attacker, type) ? SHARPSHOOTER_DAMAGE_FACTOR : 1);

/**
 * The attacker's own damage multiplier for a card type: its boosts
 * (Momentum, Sharpshooter) times Weaken times Enfeeble. 1 when none.
 */
export const damageFactorOf = (
  attacker: Combatant,
  type?: CardType
): number => {
  const boost = boostFactorOf(attacker, type);
  const weaken = attacker.statuses.weaken > 0 ? WEAKEN_DAMAGE_FACTOR : 1;
  const enfeeble = 1 - tierCut(attacker.statuses.enfeeble);
  return boost * weaken * enfeeble;
};

/**
 * Damage per hit after the attacker's wrath, type buff, Momentum and
 * weaken. Wrath and the buff (Might, Surge or Hone, by card type) add
 * first, then Momentum (Melee only) and weaken scale, matching the UI.
 */
/**
 * A hit from the attacker's own buffs only (Wrath, its type's buff,
 * Momentum): what a card in hand shows before it is aimed. Debuffs on
 * the attacker (Weaken) and anything about the target apply only once
 * it is aimed (attackDamage, then cardHitOn).
 */
export const buffedAttackDamage = (
  base: number,
  attacker: Combatant,
  type?: CardType
): number => {
  const withBuffs = base + attacker.statuses.wrath + typeBonus(attacker, type);
  return Math.max(0, Math.floor(withBuffs * boostFactorOf(attacker, type)));
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

/** A hit after Armor: a physical one is Armor lower, never below 0. */
const armoredAmount = (target: Combatant, amount: number, type: CardType) =>
  PHYSICAL_TYPES.has(type)
    ? Math.max(0, amount - target.statuses.armor)
    : amount;

/** A shot at it missed (Out of Range): counted so the view pops "Miss". */
export const missShot = <T extends Combatant>(target: T): T => ({
  ...target,
  missedShots: (target.missedShots ?? 0) + 1,
});

/** Counts a dodged hit or affliction (Instinct), for the "Dodge" pop. */
export const dodge = <T extends Combatant>(target: T): T => ({
  ...target,
  dodgedHits: (target.dodgedHits ?? 0) + 1,
});

/**
 * Takes a hit of a type (a card's, or a hero attack's) and counts it
 * toward Shock: while shocked, every hit (any type) adds one, and the
 * SHOCK_HITS-th bursts for the whole Shock (past Guard) and clears
 * it. A Piercing hit skips the
 * target's damage reductions (Protection, Armor); Guard still soaks it.
 */
export const takeHit = <T extends Combatant>(
  target: T,
  amount: number,
  type: CardType,
  isPiercing = false
): T => {
  const reduced = isPiercing
    ? amount
    : armoredAmount(target, protectedAmount(target, amount), type);
  const hit = takeDamage(target, reduced);
  const { shock } = hit.statuses;
  if (shock <= 0) return hit;
  const inARow = (hit.shockHits ?? 0) + 1;
  if (inARow < SHOCK_HITS) return { ...hit, shockHits: inARow };
  const cleared = {
    ...hit,
    shockHits: 0,
    statuses: { ...hit.statuses, shock: 0 },
  };
  return loseHp(cleared, shock);
};

// --- TIERED STATUSES (Protection, Enfeeble; see TIERED_CUT_BY_TIER) ---
/** The share of damage a tier cuts (0 for no tier). */
export const tierCut = (tier: number): number => TIERED_CUT_BY_TIER[tier] ?? 0;

/** One tier up, capped at TIERED_MAX_TIER. */
const raiseTier = (tier: number): number => Math.min(TIERED_MAX_TIER, tier + 1);

/** A tier at its renewal check: kept when renewed, else it lapses. */
const renewedTier = (tier: number, isRenewed: boolean): number =>
  isRenewed ? tier : 0;

/**
 * A hit after Protection: its tier's share is stopped, rounded to the
 * nearest whole. Ticks (loseHp) ignore it.
 */
export const protectedAmount = (target: Combatant, amount: number): number =>
  Math.round(amount * (1 - tierCut(target.statuses.protection)));

/**
 * Casts Protection: tier I, or one tier up for each cast this turn (to
 * III). Marked cast this turn, so the end of the turn keeps it for the
 * heroes' turn; it clears when your next turn starts (dropProtection).
 */
export const castProtection = <T extends Combatant>(target: T): T => ({
  ...target,
  protectionCast: true,
  statuses: {
    ...target.statuses,
    protection: raiseTier(target.statuses.protection),
  },
});

/** Your turn starts: last turn's Protection is spent. */
export const dropProtection = <T extends Combatant>(target: T): T => ({
  ...target,
  statuses: { ...target.statuses, protection: 0 },
});

/**
 * Enfeebles a unit: tier I, or one tier up when it is still enfeebled
 * from the turn before. Marked applied, so this turn's check keeps it.
 */
export const enfeeble = <T extends Combatant>(target: T): T => ({
  ...target,
  enfeebleApplied: true,
  statuses: {
    ...target.statuses,
    enfeeble: raiseTier(target.statuses.enfeeble),
  },
});

/** Enfeeble cast `times` times in a row (Sap: Enfeeble ×3). */
export const enfeebleTimes = <T extends Combatant>(
  target: T,
  times: number
): T =>
  Array.from({ length: times }).reduce<T>((unit) => enfeeble(unit), target);

/**
 * The end of the villain's turn for an enfeebled unit: Enfeeble laid on
 * this turn holds through the heroes' turn ahead; otherwise it lapses.
 */
export const enfeebleCheck = <T extends Combatant>(target: T): T => ({
  ...target,
  enfeebleApplied: false,
  statuses: {
    ...target.statuses,
    enfeeble: renewedTier(
      target.statuses.enfeeble,
      target.enfeebleApplied === true
    ),
  },
});

/**
 * Cleanse: removes one affliction (STATUS_IS_AFFLICTION) the target
 * carries, picked at random from the fight's rng so replays repeat it.
 * Returns the target and the next rng; with no affliction, both as they
 * were.
 */
export const cleanseOne = <T extends Combatant>(
  target: T,
  rng: RngState
): readonly [T, RngState] => {
  const carried = (Object.keys(STATUS_IS_AFFLICTION) as StatusId[]).filter(
    (id) => STATUS_IS_AFFLICTION[id] && target.statuses[id] > 0
  );
  if (carried.length === 0) return [target, rng];
  const [removed, next] = pickOne(rng, carried);
  const cleansed = {
    ...target,
    statuses: { ...target.statuses, [removed]: 0 },
    ...(removed === 'shock' ? { shockHits: 0 } : {}),
  };
  return [cleansed, next];
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

/** Guard a card gives, plus the villain's Reinforce. */
export const guardAmount = (base: number, owner: Combatant): number =>
  base + owner.statuses.reinforce;

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

/**
 * Guard expiring at the start of its owner's turn: all of it goes,
 * unless the owner has Brace, which keeps it all for this turn and
 * drops by 1.
 */
export const expireGuard = <T extends Combatant>(target: T): T => {
  const { brace } = target.statuses;
  if (brace <= 0 || target.guard <= 0) return { ...target, guard: 0 };
  return { ...target, statuses: { ...target.statuses, brace: brace - 1 } };
};

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

/** Bleed, right after an action: it deals its value, then drops by 1. */
export const bleedTick = <T extends Combatant>(target: T): T => {
  const { bleed } = target.statuses;
  if (bleed <= 0) return target;
  const bled = loseHp(target, bleed);
  return { ...bled, statuses: { ...bled.statuses, bleed: bleed - 1 } };
};

/**
 * Everything that runs right after a unit's action: Burn, Bleed, then
 * Frost thaws.
 */
export const afterAction = <T extends Combatant>(target: T): T =>
  frostThaw(bleedTick(burnTick(target)));

/**
 * End-of-turn upkeep: poison deals its damage then weakens by 1, weaken
 * wears off by 1, and unused Momentum is lost. Wrath and buffs are
 * permanent for the fight (Hex runs before the turn: see hexBurn).
 */
export const endOfTurnUpkeep = <T extends Combatant>(target: T): T => {
  const { poison, weaken, vex } = target.statuses;
  const poisoned = loseHp(target, poison);
  return {
    ...poisoned,
    statuses: {
      ...poisoned.statuses,
      poison: Math.max(0, poison - 1),
      weaken: Math.max(0, weaken - 1),
      vex: Math.max(0, vex - 1),
      momentum: 0,
      rush: 0,
      // Protection cast this turn covers the turn ahead; else it lapses.
      protection: renewedTier(
        target.statuses.protection,
        target.protectionCast === true
      ),
    },
    protectionCast: false,
  };
};
