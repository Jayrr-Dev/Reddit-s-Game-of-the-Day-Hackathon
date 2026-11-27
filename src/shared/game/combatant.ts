// ===================================================================
// COMBATANT RULES
// Pure helpers for damage, guard and statuses. Both the villain and the
// heroes are Combatants, so one set of rules covers both sides.
// ===================================================================

import {
  AFTER_ACTION_DIVISOR,
  SHOCK_BURST_FACTOR,
  WEAKEN_DAMAGE_FACTOR,
  FROST_DAMAGE_PER_STACK,
  HEX_BURN_STACK_COST,
  HEX_ACTION_COST,
  BANE_AFFLICTIONS,
  MOMENTUM_DAMAGE_FACTOR,
  RAMPAGE_MOMENTUM_MULTIPLIER,
  SHARPSHOOTER_DAMAGE_FACTOR,
  PHYSICAL_TYPES,
  BLEED_BITE_FACTOR,
  TIERED_CUT_BY_TIER,
  TIERED_MAX_TIER,
  STACKING_BUFF_TURNS,
  STATUS_IS_AFFLICTION,
  ROUND_BUFFS,
} from './rules.ts';
import { characterBonuses, healingAmount, withBorrowedStats } from './character.ts';
import {
  afflictionResistOf,
  afflictionSkillBonusOf,
  buffPowerBonusOf,
  edgeDamageBonusOf,
  hasHexSixOf,
  stackedBuffTurnsOf,
  virulentStacks,
  momentumSkillBonusOf,
  type SkillPick,
} from './skills.ts';
import { pickOne, type RngState } from './rng.ts';
import type {
  BuffId,
  CardType,
  MeleeEdge,
  Combatant,
  CombatState,
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
  berserker: 0,
  bane: 0,
  instinct: 0,
  reflex: 0,
  invincible: 0,
  momentum: 0,
  protection: 0,
  enfeeble: 0,
  malaise: 0,
  hitLimit: 0,
  brace: 0,
  aloft: 0,
  cloak: 0,
  move: 0,
  rush: 0,
  armor: 0,
  pin: 0,
  fatigue: 0,
  fatigueAll: 0,
  scramble: 0,
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

/** Whether a unit is hidden from direct targeting. Older saves have no Cloak. */
export const isCloaked = (unit: Pick<Combatant, 'statuses'>): boolean =>
  (unit.statuses.cloak ?? 0) > 0;

/** Clears Cloak when the unit commits an attack, even if the attack misses. */
export const revealCloak = <T extends Combatant>(unit: T): T =>
  isCloaked(unit) ? { ...unit, statuses: { ...unit.statuses, cloak: 0 } } : unit;

/** Uses one turn of Cloak after the opposing side's targeting window closes. */
export const tickCloak = <T extends Combatant>(unit: T): T =>
  isCloaked(unit)
    ? { ...unit, statuses: { ...unit.statuses, cloak: unit.statuses.cloak - 1 } }
    : unit;

/** The buff that powers up a card type's damage, if any. */
export const damageBuffOf = (type?: CardType): BuffId | undefined =>
  type ? DAMAGE_BUFF_OF[type] : undefined;

/** Extra damage per hit a card of `type` gets from the attacker's buffs. */
/**
 * POTENCY (skill tree): what a buff's flat bonus (Wrath, Might, Surge,
 * Hone, Reinforce) is worth for this unit, rounded to whole points.
 */
export const buffedAmount = (unit: Combatant, amount: number): number =>
  Math.round(amount * (1 + buffPowerBonusOf(unit.skillPicks)));

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
  const amount = base + scornBonus(attacker, status);
  if (!BANE_AFFLICTIONS.has(status)) return amount;
  const boosted = amount + attacker.statuses.bane + (target?.statuses.vex ?? 0);
  // VIRULENCE skips Hex: Hex belongs to the Curses line.
  return status === 'hex'
    ? boosted
    : virulentStacks(boosted, attacker.skillPicks);
};

/** Resolve live equipment and trait paths together for combat and previews. */
export const combatantBonuses = (unit: Combatant) =>
  withBorrowedStats(characterBonuses(unit.traits, unit.equipment, unit.traitNodes), unit.borrowedStats);

export const scornBonus = (attacker: Combatant, status: StatusId): number =>
  (attacker.traits || attacker.borrowedStats) && STATUS_IS_AFFLICTION[status]
    ? combatantBonuses(attacker).afflictionFlat
    : 0;

export const offensiveBonus = (attacker: Combatant, type?: CardType) => {
  if (!attacker.traits && !attacker.borrowedStats) return { percent: 0, flat: 0 };
  const stats = combatantBonuses(attacker);
  switch (type) {
    case 'melee':
      return { percent: stats.meleePercent, flat: stats.meleeFlat };
    case 'range':
      return { percent: stats.rangePercent, flat: stats.rangeFlat };
    case 'magic':
      return { percent: stats.magicPercent, flat: stats.magicFlat };
    default:
      return { percent: 0, flat: 0 };
  }
};

const traitDamage = (
  base: number,
  attacker: Combatant,
  type: CardType | undefined,
  hits: number
) => {
  const { percent, flat } = offensiveBonus(attacker, type);
  return (base * (100 + percent)) / 100 + Math.floor(flat / Math.max(1, hits));
};

/** True when a card of `type` is boosted by the attacker's Momentum. */
export const hasMomentumFor = (attacker: Combatant, type?: CardType) =>
  type === 'melee' && attacker.statuses.momentum > 0;

/** True when a card of `type` is boosted by the attacker's Sharpshooter. */
export const hasSharpshooterFor = (attacker: Combatant, type?: CardType) =>
  type === 'range' && attacker.statuses.sharpshooter > 0;

/** Momentum's multiplier: doubled bonus on a Rampage card. */
const momentumFactorOf = (attacker: Combatant, isRampage: boolean): number => {
  // The base bonus (+50%) plus Bull Rush's skill ranks (+5% each).
  const bonus =
    MOMENTUM_DAMAGE_FACTOR - 1 + momentumSkillBonusOf(attacker.skillPicks);
  return 1 + bonus * (isRampage ? RAMPAGE_MOMENTUM_MULTIPLIER : 1);
};

/**
 * The attacker's own boosts for a card type: Momentum (Melee; more on a
 * Rampage card) and Sharpshooter (Range). 1 when none applies.
 */
const boostFactorOf = (
  attacker: Combatant,
  type?: CardType,
  isRampage = false,
  edge?: MeleeEdge
): number =>
  // HEAVY HANDS / KEEN EDGE (skill tree): +% to Blunt or Sharp Melee.
  (type === 'melee' && edge
    ? 1 + edgeDamageBonusOf(attacker.skillPicks, edge)
    : 1) *
  (hasMomentumFor(attacker, type) ? momentumFactorOf(attacker, isRampage) : 1) *
  (hasSharpshooterFor(attacker, type) ? SHARPSHOOTER_DAMAGE_FACTOR : 1);

/**
 * The attacker's own damage multiplier for a card type: its boosts
 * (Momentum, Sharpshooter) times Weaken times Enfeeble. 1 when none.
 */
export const damageFactorOf = (
  attacker: Combatant,
  type?: CardType,
  isRampage = false,
  edge?: MeleeEdge,
  debuffBonus = 0
): number => {
  const boost = boostFactorOf(attacker, type, isRampage, edge);
  // DEBILITATE: the villain's skill adds its share to each cut (additive).
  const weaken =
    attacker.statuses.weaken > 0
      ? Math.max(0, WEAKEN_DAMAGE_FACTOR - debuffBonus)
      : 1;
  const enfeeble =
    attacker.statuses.enfeeble > 0
      ? Math.max(
          0,
          remainingTierPercent(attacker.statuses.enfeeble) / 100 - debuffBonus
        )
      : 1;
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
/** A damaging affliction resolves once with its source's Malevolence bonus. */
export const afflictionDamage = (base: number, source?: Combatant): number => {
  const traitPercent = source && (source.traits || source.borrowedStats)
    ? combatantBonuses(source).afflictionDamagePercent
    : 0;
  // MALEDICTION (skill tree) adds its percent on top of the traits'.
  const skillPercent = Math.round(
    afflictionSkillBonusOf(source?.skillPicks) * 100
  );
  return Math.floor((base * (100 + traitPercent + skillPercent)) / 100);
};

/**
 * Reap is a Curse card, but its damage still scales like a spell
 * (Intelligence, Surge), as it did when it was a Magic card (Sam).
 */
const REAP_SCALING_TYPE: CardType = 'magic';

/** Reap's damage: the target's Hex times `multiplier`, then spell bonuses. */
export const reapDamage = (hex: number, multiplier: number, attacker: Combatant) =>
  Math.floor(
    traitDamage(afflictionDamage(hex * multiplier, attacker), attacker, REAP_SCALING_TYPE, 1)
  ) + typeBonus(attacker, REAP_SCALING_TYPE);

export const buffedAttackDamage = (
  base: number,
  attacker: Combatant,
  type?: CardType,
  isRampage = false,
  hits = 1,
  edge?: MeleeEdge
): number => {
  const withBuffs =
    traitDamage(base, attacker, type, hits) +
    buffedAmount(attacker, attacker.statuses.wrath + typeBonus(attacker, type));
  const boost = boostFactorOf(attacker, type, isRampage, edge);
  return Math.max(0, Math.floor(withBuffs * boost));
};

export const attackDamage = (
  base: number,
  attacker: Combatant,
  type?: CardType,
  isRampage = false,
  hits = 1,
  edge?: MeleeEdge,
  debuffBonus = 0
): number => {
  const withWrath =
    traitDamage(base, attacker, type, hits) +
    buffedAmount(attacker, attacker.statuses.wrath + typeBonus(attacker, type));
  const factor = damageFactorOf(attacker, type, isRampage, edge, debuffBonus);
  const scaled = withWrath * factor;
  const factored =
    attacker.statuses.enfeeble > 0 ? ceilHitDamage(scaled) : Math.floor(scaled);
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

/** Spend one Invincible stack when the next damaging attack connects. */
export const spendInvincible = <T extends Combatant>(target: T): T => ({
  ...target,
  statuses: { ...target.statuses, invincible: Math.max(0, target.statuses.invincible - 1) },
});

/**
 * Takes a hit of a type (a card's, or a hero attack's).
 * A Piercing hit skips the
 * target's damage reductions and Guard (Protection, Armor, Guard).
 */
export const takeHit = <T extends Combatant>(
  target: T,
  amount: number,
  type: CardType,
  isPiercing = false
): T => {
  // INVINCIBLE: a stack turns this hit to 0, then goes (even past Piercing).
  if (amount > 0 && target.statuses.invincible > 0)
    return spendInvincible(target);
  // PIERCING: past Protection, Armor and Guard, straight to HP.
  if (isPiercing) return loseHp(target, amount);
  const afterProtection = protectedAmount(target, amount);
  const reduced = armoredAmount(target, afterProtection, type);
  // ARMOR SOAK: counted so the view can show the armor icon on the hit.
  const soaked = afterProtection - reduced;
  const hit = takeDamage(
    soaked > 0
      ? { ...target, armorSoaked: (target.armorSoaked ?? 0) + soaked }
      : target,
    reduced
  );
  return hit;
};

/** What a Bleed bites for: BLEED_BITE_FACTOR of it, rounded up. */
export const bleedBiteOf = (bleed: number): number =>
  // The tiny nudge keeps float error (e.g. 6 x 1/3 = 2.0000001) from rounding up.
  bleed > 0 ? Math.ceil(bleed * BLEED_BITE_FACTOR - 1e-9) : 0;

/**
 * At the end of a physical attack, combine one Bleed bite per landed hit
 * (past Guard), then lose one stack. Hits use the pre-attack stack count.
 * Using the Bleed from before means an attack never bites with the
 * stacks it just laid itself.
 */
export const bleedOnAttack = <T extends Combatant>(
  target: T,
  priorBleed: number,
  source?: Combatant,
  landedHits = 1
): T => {
  const { bleed } = target.statuses;
  if (priorBleed <= 0 || bleed <= 0 || landedHits <= 0) return target;
  const bite = incomingAfflictionDamage(
    target,
    bleedBiteOf(priorBleed),
    source
  ) * landedHits;
  const bled = loseHp(target, bite);
  return {
    ...bled,
    bleedTaken: (target.bleedTaken ?? 0) + bite,
    statuses: { ...bled.statuses, bleed: bleed - 1 },
  };
};

/**
 * Shock goes off: SHOCK_BURST_FACTOR times its stacks (past Guard),
 * then its stacks halve (rounding down). A landed follow-up attack does this, as does a
 * Smite (a hero's `detonate`) at once. No Shock, nothing happens.
 */
export const burstShock = <T extends Combatant>(
  target: T,
  source?: Combatant
): T => {
  const { shock } = target.statuses;
  if (shock <= 0) return target;
  const damage = incomingAfflictionDamage(
    target,
    shock * SHOCK_BURST_FACTOR,
    source
  );
  const cleared = {
    ...target,
    shockHits: 0,
    shockBursts: (target.shockBursts ?? 0) + 1,
    shockDamageTaken: (target.shockDamageTaken ?? 0) + damage,
    statuses: { ...target.statuses, shock: Math.floor(shock / 2) },
  };
  return loseHp(cleared, damage);
};

// --- SHOCK CHAIN ---
/** True when this unit's Shock went off between two looks (a fade is no burst). */
export const didShockBurst = (before: Combatant, after: Combatant): boolean =>
  (after.shockBursts ?? 0) > (before.shockBursts ?? 0);

/**
 * SHOCK CHAIN (Sam, 2026-11-26): once one unit's Shock goes off, every
 * other standing unit on its side that still holds Shock goes off too,
 * one at a time in field order. Returns the side after each chained
 * burst (empty when nothing went off), so the view can show each bolt
 * on its own beat. Only Shock primed before the attack can join the chain,
 * and each unit goes off at most once.
 */
export const shockChain = <T extends Combatant & { uid: number }>(
  before: readonly T[],
  after: readonly T[],
  eligible: ReadonlySet<number>,
  source?: Combatant
): T[][] => {
  const isTriggered = after.some((unit) => {
    const old = before.find((prior) => prior.uid === unit.uid);
    return old !== undefined && didShockBurst(old, unit);
  });
  if (!isTriggered) return [];
  const charged = after.filter((unit) => unit.hp > 0 && unit.statuses.shock > 0 && eligible.has(unit.uid));
  // Imperative on purpose: each step builds on the side the last burst left.
  const steps: T[][] = [];
  let side: T[] = [...after];
  for (const { uid } of charged) {
    side = side.map((unit) => (unit.uid === uid ? burstShock(unit, source) : unit));
    steps.push(side);
  }
  return steps;
};

// --- TIERED STATUSES (Protection, Enfeeble; see TIERED_CUT_BY_TIER) ---
/** The share of damage a tier cuts (0 for no tier). */
export const tierCut = (tier: number): number =>
  TIERED_CUT_BY_TIER[Math.min(tier, TIERED_MAX_TIER)] ?? 0;

const remainingTierPercent = (tier: number): number =>
  100 - Math.round(tierCut(tier) * 100);

/** Ignore floating-point noise near integers, e.g. Tier IV leaving 1 of 20. */
const ceilHitDamage = (amount: number): number =>
  Math.max(
    0,
    Math.ceil(amount - Math.max(1, Math.abs(amount)) * Number.EPSILON * 4)
  );

/** One tier up, capped at TIERED_MAX_TIER. */
const raiseTier = (tier: number): number => Math.min(TIERED_MAX_TIER, tier + 1);

/** A tier at its renewal check: kept when renewed, else it lapses. */
const renewedTier = (tier: number, isRenewed: boolean): number =>
  isRenewed ? tier : 0;

/**
 * Damage after Protection: its tier's share is stopped. Remaining hit
 * or affliction damage rounds up to the next whole.
 */
export const protectedAmount = (target: Combatant, amount: number): number =>
  target.statuses.protection > 0
    ? ceilHitDamage(
        (amount * remainingTierPercent(target.statuses.protection)) / 100
      )
    : Math.round(amount);

/** Afflictions benefit from source Malevolence and target Protection but still bypass Armor and Guard. */
export const incomingAfflictionDamage = (
  target: Combatant,
  amount: number,
  source?: Combatant
): number =>
  protectedAmount(
    target,
    // TOLERANCE: the target's own skill cuts what reaches it.
    Math.round(
      afflictionDamage(amount, source) *
        (1 - afflictionResistOf(target.skillPicks))
    )
  );

/**
 * Casts Protection from a hero move: one tier higher (up to IV),
 * expiring when that hero's next turn starts.
 */
export const castProtection = <T extends Combatant>(target: T): T => ({
  ...target,
  protectionCast: true,
  statuses: {
    ...target.statuses,
    protection: raiseTier(target.statuses.protection),
  },
});

/** Applies a timed Protection tier for exactly this many opposing turns. */
export const castTimedProtection = <T extends Combatant>(target: T, turns: number): T => ({
  ...castProtection(target),
  cardProtectionTurns: turns,
  cardProtectionDuration: turns,
});

/** Spend one opposing turn of timed Protection. */
export const tickProtection = <T extends Combatant>(target: T): T => {
  const turns = target.cardProtectionTurns;
  if (!turns) return target;
  return {
    ...target,
    cardProtectionTurns: turns - 1,
    ...(turns === 1 ? { statuses: { ...target.statuses, protection: 0 } } : {}),
  };
};

/** Bulwark raises Protection and refreshes its duration. Traits can supply extra turns. */
export const castCardProtection = <T extends Combatant>(
  target: T,
  extraTurns = 0
): T => {
  // EVERLASTING (skill tree) adds its turn on top of any trait turns.
  const duration =
    STACKING_BUFF_TURNS +
    Math.max(0, Math.trunc(extraTurns)) +
    stackedBuffTurnsOf(target.skillPicks);
  return castTimedProtection(target, duration);
};

/**
 * Your turn starts: last round's buffs are spent, except for
 * Stacked Buffs from cards that still have time left.
 */
export const dropRoundBuffs = <T extends Combatant>(target: T): T => ({
  ...target,
  statuses: {
    ...target.statuses,
    ...Object.fromEntries(
      ROUND_BUFFS.filter(
        (id) =>
          (id !== 'protection' || !target.cardProtectionTurns) &&
          (id !== 'instinct' || !target.instinctTurns)
      ).map((id) => [id, 0])
    ),
  },
});

/**
 * Enfeebles a unit: add a tier and refresh the duration.
 */
export const enfeeble = <T extends Combatant>(
  target: T,
  extraTurns = 0
): T => ({
  ...target,
  // EVERLASTING (caster's skill) passes extraTurns to make it linger.
  enfeebleTurns: STACKING_BUFF_TURNS + extraTurns,
  statuses: {
    ...target.statuses,
    enfeeble: raiseTier(target.statuses.enfeeble),
  },
});

/** Enfeeble cast `times` times in a row (Sap: Enfeeble ×3). */
export const enfeebleTimes = <T extends Combatant>(
  target: T,
  times: number,
  extraTurns = 0
): T =>
  Array.from({ length: times }).reduce<T>(
    (unit) => enfeeble(unit, extraTurns),
    target
  );

/** True only on natural expiry, not when a status is cleansed or its target falls. */
export const tierIVExpires = (target: Combatant, countProtection = true): boolean =>
  (countProtection && target.cardProtectionTurns === 1 &&
    target.statuses.protection === TIERED_MAX_TIER) ||
  (target.instinctTurns === 1 &&
    target.statuses.instinct === TIERED_MAX_TIER) ||
  (target.enfeebleTurns === 1 && target.statuses.enfeeble === TIERED_MAX_TIER);

/** Spend a turn only after the enemies had a turn (not on wave arrival). */
export const tickStackingBuffs = <T extends Combatant>(target: T, countProtection = true): T => {
  const protectedTarget = countProtection ? tickProtection(target) : target;
  const { enfeebleTurns, instinctTurns } = protectedTarget;
  if (!enfeebleTurns && !instinctTurns) return protectedTarget;
  return {
    ...protectedTarget,
    ...(enfeebleTurns ? { enfeebleTurns: enfeebleTurns - 1 } : {}),
    ...(instinctTurns ? { instinctTurns: instinctTurns - 1 } : {}),
    statuses: {
      ...protectedTarget.statuses,
      ...(enfeebleTurns === 1 ? { enfeeble: 0 } : {}),
      ...(instinctTurns === 1 ? { instinct: 0 } : {}),
    },
  };
};

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

/** Keep duration or progress counters only while their associated status still exists. */
const clearSpentStatus = <T extends Combatant>(
  unit: T,
  id: StatusId,
  value: number
): T => ({
  ...unit,
  statuses: { ...unit.statuses, [id]: value },
  ...(!value && id === 'protection'
    ? {
        cardProtectionTurns: 0,
        cardProtectionDuration: 0,
        protectionCast: false,
      }
    : {}),
  ...(!value && id === 'instinct' ? { instinctTurns: 0 } : {}),
  ...(!value && id === 'enfeeble' ? { enfeebleTurns: 0 } : {}),
  ...(!value && id === 'shock' ? { shockHits: 0 } : {}),
});

/** Disrupt lowers one random buff OR affliction, without touching Guard, innate armor or Aloft. */
export const disruptStatus = <T extends Combatant>(
  target: T,
  amount: number,
  rng: RngState,
  innateArmor = 0,
  buffsOnly = false
): readonly [T, RngState, StatusId | undefined] => {
  if (amount < 1) return [target, rng, undefined];
  const statuses = (Object.keys(STATUS_IS_AFFLICTION) as StatusId[]).filter(
    (id) =>
      id !== 'aloft' &&
      (!buffsOnly || !STATUS_IS_AFFLICTION[id]) &&
      target.statuses[id] > (id === 'armor' ? innateArmor : 0)
  );
  if (!statuses.length) return [target, rng, undefined];
  const [id, next] = pickOne(rng, statuses);
  const value = Math.max(
    id === 'armor' ? innateArmor : 0,
    target.statuses[id] - Math.floor(amount)
  );
  return [clearSpentStatus(target, id, value), next, id];
};

/** Lowers all currently active afflictions without spending RNG. */
export const lowerAfflictions = <T extends Combatant>(
  target: T,
  amount: number
): T =>
  (Object.keys(STATUS_IS_AFFLICTION) as StatusId[]).reduce(
    (unit, id) =>
      STATUS_IS_AFFLICTION[id] && unit.statuses[id] > 0
        ? clearSpentStatus(unit, id, Math.max(0, unit.statuses[id] - amount))
        : unit,
    target
  );

/** Only active boons are removed: not Guard, afflictions, innate Armor or flight. */
export const dispelBuffs = <T extends Combatant>(
  target: T,
  count: number,
  rng: RngState,
  innateArmor = 0
): readonly [T, RngState, readonly StatusId[]] => {
  const buffIds = (Object.keys(STATUS_IS_AFFLICTION) as StatusId[]).filter(
    (id) =>
      id !== 'aloft' &&
      !STATUS_IS_AFFLICTION[id] &&
      target.statuses[id] > (id === 'armor' ? innateArmor : 0)
  );
  const removed: StatusId[] = [];
  let unit = target;
  let next = rng;
  while (removed.length < count && buffIds.length) {
    const [id, after] = pickOne(next, buffIds);
    next = after;
    buffIds.splice(buffIds.indexOf(id), 1);
    removed.push(id);
    unit = clearSpentStatus(unit, id, id === 'armor' ? innateArmor : 0);
  }
  return [unit, next, removed];
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
  hp: Math.min(target.maxHp, target.hp + healingAmount(amount, target)),
});

/** Vigor scales printed Guard. Endurance is shared by this card's Guard applications. */
export const guardAmount = (
  base: number,
  owner: Combatant,
  applications = 1
): number => {
  const { shieldPercent, shieldFlat } = combatantBonuses(owner);
  return Math.max(0,
    Math.floor((base * (100 + shieldPercent)) / 100) +
    Math.floor(shieldFlat / applications) +
    buffedAmount(owner, owner.statuses.reinforce)
  );
};

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
  ...(status === 'instinct' && amount > 0
    ? {
        instinctTurns:
          STACKING_BUFF_TURNS + stackedBuffTurnsOf(target.skillPicks),
      }
    : {}),
  statuses: {
    ...target.statuses,
    [status]:
      status === 'instinct'
        ? Math.min(TIERED_MAX_TIER, target.statuses.instinct + amount)
        : status === 'reflex' && amount > 0
          ? 1
          : status === 'malaise' || status === 'hitLimit' || status === 'cloak' || status === 'pin' || status === 'scramble'
            ? Math.max(target.statuses[status] ?? 0, amount)
            : (target.statuses[status] ?? 0) + amount,
  },
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

/** Who laid a Hex: their skill tree can widen the empowered digits. */
type HexSource = { skillPicks?: readonly SkillPick[] };

/** Hex deals its face value on odd stacks; Sixfold Curse also enables endings in 6. */
export const hexBurnAmount = (hex: number, source?: HexSource): number =>
  hex > 0 && (hex % 2 !== 0 || (hex % 10 === 6 && hasHexSixOf(source?.skillPicks))) ? hex : 0;

/** Spend one stack only when the current Hex triggers. */
export const hexAfterBurn = (hex: number, source?: HexSource): number =>
  Math.max(0, hex - (hexBurnAmount(hex, source) ? HEX_BURN_STACK_COST : 0));

/** Remaining Hex after a player action. */
export const hexAfterCountdown = (hex: number): number => Math.max(0, hex - HEX_ACTION_COST);

/** Hex burns at the player's turn opening, spending one stack. */
export const hexBurn = <T extends Combatant>(
  target: T,
  source?: Combatant
): T => {
  const { hex } = target.statuses;
  const damage = hexBurnAmount(hex, source);
  if (damage <= 0) return target;
  const burned = dealHexDamage(target, damage, source);
  return { ...burned, statuses: { ...burned.statuses, hex: hexAfterBurn(hex, source) } };
};

/** Apply Hex damage separately from its stack change for the combat HUD. */
function dealHexDamage<T extends Combatant>(target: T, amount: number, source?: Combatant): T {
  const loss = incomingAfflictionDamage(target, amount, source);
  return { ...loseHp(target, loss), hexDamageTaken: (target.hexDamageTaken ?? 0) + loss };
}

/** Count down once and burst at the resulting value without spending another stack. */
export const hexAfterAction = <T extends Combatant>(target: T, source?: Combatant): T => {
  if (target.hp <= 0 || target.statuses.hex <= 0) return target;
  const hex = hexAfterCountdown(target.statuses.hex);
  const ticked = { ...target, statuses: { ...target.statuses, hex } };
  const damage = hexBurnAmount(hex, source);
  return damage > 0 ? dealHexDamage(ticked, damage, source) : ticked;
};

/** Only player actions count down Hex on enemies that were already cursed. */
export function hexAfterPlayerAction(before: CombatState, after: CombatState): CombatState {
  const primed = new Set(before.heroes.filter(unit => unit.statuses.hex > 0).map(unit => unit.uid));
  const heroes = primed.size ? after.heroes.map(unit =>
    primed.has(unit.uid) ? hexAfterAction(unit, before.player) : unit
  ) : after.heroes;
  const player = hexAfterAction(after.player);
  return player !== after.player || heroes.some((unit, index) => unit !== after.heroes[index])
    ? { ...after, player, heroes } : after;
}

/**
 * What an after-action status (Burn, Frost) drops to: divided by
 * AFTER_ACTION_DIVISOR to the nearest whole, an exact half rounding
 * DOWN (3 -> 1, 1 -> 0), so it always runs out instead of sticking at 1.
 */
export const afterActionLeft = (stacks: number): number =>
  Math.ceil(stacks / AFTER_ACTION_DIVISOR - 0.5);

/** Burn, right after an action: it deals its value, then halves. */
export const burnTick = <T extends Combatant>(
  target: T,
  source?: Combatant
): T => {
  const { burn } = target.statuses;
  if (burn <= 0) return target;
  const burned = loseHp(target, incomingAfflictionDamage(target, burn, source));
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

/** After an action, Shock fades by 1 (no damage; Sam, 2026-11-24). */
const shockFade = <T extends Combatant>(target: T): T =>
  target.statuses.shock > 0
    ? {
        ...target,
        statuses: { ...target.statuses, shock: target.statuses.shock - 1 },
      }
    : target;

/**
 * Everything that runs right after a unit's action (a hero's move, the
 * villain's whole turn): Burn, Frost thaws and Shock fades. (Bleed
 * goes off on attacks landed instead: see bleedOnAttack.)
 */
export const afterAction = <T extends Combatant>(
  target: T,
  source?: Combatant
): T => shockFade(frostThaw(burnTick(target, source)));

/**
 * Poison right before an action (a hero's move; the villain's turn
 * start): loses this much HP, then Poison drops by 1.
 */
export const poisonTick = <T extends Combatant>(
  target: T,
  source?: Combatant
): T => {
  const { poison } = target.statuses;
  if (poison <= 0) return target;
  const poisoned = loseHp(
    target,
    incomingAfflictionDamage(target, poison, source)
  );
  return {
    ...poisoned,
    statuses: { ...poisoned.statuses, poison: poison - 1 },
  };
};

/**
 * End-of-turn upkeep: weaken wears off by 1 (Poison ticks before
 * actions instead: see poisonTick) and unused Momentum is lost. Wrath and buffs are
 * permanent for the fight (Hex runs before the turn: see hexBurn).
 */
export const endOfTurnUpkeep = <T extends Combatant>(target: T): T => {
  const { weaken, vex } = target.statuses;
  return {
    ...target,
    statuses: {
      ...target.statuses,
      weaken: Math.max(0, weaken - 1),
      vex: Math.max(0, vex - 1),
      // SHARPSHOOTER N lasts N turns: one comes off as each turn ends.
      sharpshooter: Math.max(0, target.statuses.sharpshooter - 1),
      malaise: Math.max(0, (target.statuses.malaise ?? 0) - 1),
      hitLimit: Math.max(0, (target.statuses.hitLimit ?? 0) - 1),
      // PIN N holds its bearer for N of its own turns.
      pin: Math.max(0, (target.statuses.pin ?? 0) - 1),
      // SCRAMBLE N lasts N of its bearer's turns.
      scramble: Math.max(0, (target.statuses.scramble ?? 0) - 1),
      momentum: 0,
      rush: 0,
      // Card Protection has a separate countdown through the enemy turns.
      protection: renewedTier(
        target.statuses.protection,
        target.protectionCast === true || (target.cardProtectionTurns ?? 0) > 0
      ),
    },
    protectionCast: false,
    // Shock's hits must all land within one turn.
    shockHits: 0,
  };
};
