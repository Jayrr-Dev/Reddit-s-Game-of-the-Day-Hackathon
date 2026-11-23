// ===================================================================
// COMBATANT RULES
// Pure helpers for damage, shroud and statuses. Both the villain and the
// heroes are Combatants, so one set of rules covers both sides.
// ===================================================================

import { DREAD_DAMAGE_FACTOR } from './rules.ts';
import type { Combatant, StatusId, Statuses } from './types.ts';

// --- CONSTRUCTION ---
export const NO_STATUSES: Statuses = { hex: 0, dread: 0, wrath: 0 };

/** Makes a fresh combatant at the given HP. */
export const createCombatant = (hp: number, maxHp: number): Combatant => ({
  hp,
  maxHp,
  shroud: 0,
  statuses: NO_STATUSES,
});

// --- QUERIES ---
export const isDefeated = (combatant: Combatant): boolean => combatant.hp <= 0;

/**
 * Damage per hit after the attacker's wrath and dread.
 * Wrath adds first, then dread scales, matching what the UI shows.
 */
export const attackDamage = (base: number, attacker: Combatant): number => {
  const withWrath = base + attacker.statuses.wrath;
  const factor = attacker.statuses.dread > 0 ? DREAD_DAMAGE_FACTOR : 1;
  return Math.max(0, Math.floor(withWrath * factor));
};

// --- UPDATES (EACH RETURNS A NEW COMBATANT) ---

/** Takes a hit: shroud absorbs first, the rest comes off HP. */
export const takeDamage = <T extends Combatant>(
  target: T,
  amount: number
): T => {
  const absorbed = Math.min(target.shroud, amount);
  return {
    ...target,
    shroud: target.shroud - absorbed,
    hp: Math.max(0, target.hp - (amount - absorbed)),
  };
};

/** Loses HP directly, ignoring shroud (used by hex). */
export const loseHp = <T extends Combatant>(target: T, amount: number): T => ({
  ...target,
  hp: Math.max(0, target.hp - amount),
});

/** Restores HP up to max. */
export const heal = <T extends Combatant>(target: T, amount: number): T => ({
  ...target,
  hp: Math.min(target.maxHp, target.hp + amount),
});

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
 * End-of-turn upkeep: hex deals its damage then weakens by 1,
 * and dread wears off by 1. Wrath is permanent for the fight.
 */
export const endOfTurnUpkeep = <T extends Combatant>(target: T): T => {
  const { hex, dread } = target.statuses;
  const hexed = loseHp(target, hex);
  return {
    ...hexed,
    statuses: {
      ...hexed.statuses,
      hex: Math.max(0, hex - 1),
      dread: Math.max(0, dread - 1),
    },
  };
};
