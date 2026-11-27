// ===================================================================
// MOVEMENT
// The villain's moves on the battlefield itself, as data. Each move
// says which formation it needs, how it reshapes the field and what it
// grants. To add a move, add an entry to MOVEMENTS (and its id to
// MovementId); cost, availability and the action log handle it.
//
// SHARED BUTTON COST: each Charge or Back Step button use counts toward one streak, whatever its
// kind. Each move costs its base cost plus MOVEMENT_STREAK_COST per
// move made in a row. The streak survives the turn it was made and the
// next one; it resets only after one full turn with no movement.
// Example: Charge on turn 3 (0), Back Step on turn 3 (1), Charge on
// turn 4 (2). Nothing on turn 5. Turn 6: back to 0.
// ===================================================================

import { appendCombatHistory, recordEffects } from './combatHistory.ts';
import { chargeGuardOf, iFramesOf, movementDiscountOf } from './skills.ts';
import { addGuard, hexAfterPlayerAction } from './combatant.ts';
import { fallBack, isDeep, rowDepth, stepForward } from './battlefield.ts';
import { canPlayCard, canPlayCardOnSelf, combatOutcome } from './combat.ts';
import {
  BACK_STEP_COST,
  BACK_STEP_ROWS,
  CHARGE_COST,
  CHARGE_ROWS,
  MOVEMENT_STREAK_COST,
  ROW_LABEL,
} from './rules.ts';
import type {
  CombatState,
  Combatant,
  HeroUnit,
  MovementId,
  StatusId,
} from './types.ts';

// --- TYPES ---
/** One movement's rules. */
export type MovementDef = {
  /** Energy it costs with no streak running. */
  baseCost: number;
  /** It is offered only while the heroes stand like this. */
  fitsFormation: (heroes: readonly HeroUnit[]) => boolean;
  /** How the heroes' places change when the villain moves. */
  reshape: (heroes: HeroUnit[], extraRows?: number) => HeroUnit[];
  /**
   * The bonus for a successful move. Momentum and Reflex do not stack.
   */
  grants?: { status: StatusId; amount: number };
};

// --- HELPERS ---
/** True when anyone stands in a different row after a move. */
const changesRows = (
  before: readonly HeroUnit[],
  after: readonly HeroUnit[]
): boolean => after.some((unit, index) => unit.row !== before[index]?.row);

/** True when a Back Step would move anyone (someone has room behind). */
const hasRoomToFallBack = (heroes: readonly HeroUnit[]): boolean =>
  changesRows(heroes, fallBack(heroes, BACK_STEP_ROWS));

// --- REGISTRY ---
export const MOVEMENTS: Record<MovementId, MovementDef> = {
  /**
   * Rush an empty front row: the field closes in up to CHARGE_ROWS rows
   * (until someone stands in front), and the next Melee card hits harder.
   */
  charge: {
    baseCost: CHARGE_COST,
    // Only when it would close in on someone (Anchored heroes hold their line).
    fitsFormation: (heroes) =>
      heroes.every((unit) => unit.row !== 'front') &&
      changesRows(heroes, stepForward(heroes, CHARGE_ROWS)),
    reshape: (heroes, extraRows = 0) =>
      stepForward(heroes, CHARGE_ROWS + extraRows),
    grants: { status: 'momentum', amount: 1 },
  },
  /**
   * Fall back while anyone stands on Frontline and someone has room behind:
   * every hero drops BACK_STEP_ROWS row where it can. A boss reaching
   * back still shows it, locked (see movementBlockReason).
   */
  backStep: {
    baseCost: BACK_STEP_COST,
    fitsFormation: (heroes) =>
      heroes.some((unit) => unit.row === 'front') &&
      (heroes.some(isDeep) || hasRoomToFallBack(heroes)),
    reshape: (heroes, extraRows = 0) =>
      fallBack(heroes, BACK_STEP_ROWS + extraRows),
    grants: { status: 'reflex', amount: 1 },
  },
};

/** What a locked move says while a boss reaches into the back row. */
const BLOCKED_BY_BOSS: Record<MovementId, string> = {
  charge: 'A boss holds the field: there is no line to rush.',
  backStep: `A boss holds the ${ROW_LABEL.back} too: there is no room to fall back.`,
};

/** Why the villain can't move while Pinned. */
const PINNED_REASON = "You're Pinned: you can't move this turn.";

/** Every movement id, in the order they are offered. */
export const MOVEMENT_IDS = Object.keys(MOVEMENTS) as MovementId[];

// --- QUERIES ---
/** True for a known movement id (validates logged actions). */
export const isMovementId = (value: unknown): value is MovementId =>
  typeof value === 'string' && MOVEMENT_IDS.includes(value as MovementId);

/**
 * How many moves in a row are running. The last move counts while it
 * was made this turn or last turn; a full turn without one resets it.
 */
const streakOf = (state: CombatState): number => {
  const last = state.lastMovement;
  const isRunning = last !== null && state.turn - last.turn <= 1;
  return isRunning ? last.streak : 0;
};

/** What `move` costs right now: its base cost plus the shared streak. */
export const movementCost = (state: CombatState, move: MovementId): number =>
  isRushing(state)
    ? 0
    : MOVEMENTS[move].baseCost +
      // ENDURANCE discounts the shared streak surcharge, not Fatigue.
      Math.max(0, streakOf(state) * MOVEMENT_STREAK_COST - movementDiscountOf(state.player.skillPicks)) +
      // FATIGUE ALL Movement: Charge and Back Step cost more this turn.
      (state.movementFatigue ?? 0);

/** Spends one Rush stack (none left: nothing changes). */
const spendRush = (player: Combatant): Combatant => ({
  ...player,
  statuses: {
    ...player.statuses,
    rush: Math.max(0, player.statuses.rush - 1),
  },
});

/** True while Rush makes the next movement free (see Rush). */
const isRushing = (state: CombatState): boolean =>
  state.player.statuses.rush > 0;

/** True while the formation allows `move` (cost aside). */
const isFormationFor = (state: CombatState, move: MovementId): boolean =>
  state.heroes.length > 0 && MOVEMENTS[move].fitsFormation(state.heroes);

/** The movement the field offers right now, if any (cost aside). */
export const offeredMovement = (state: CombatState): MovementId | null =>
  MOVEMENT_IDS.find((move) => isFormationFor(state, move)) ?? null;

/**
 * Why an offered move can't be made at all (cost aside), or null. A
 * boss that reaches into the row behind it (see isDeep) moves as a
 * whole only when the field has a row for its reach. On a field too
 * shallow (two rows) the move would change nothing: shown but locked.
 */
export const movementBlockReason = (
  state: CombatState,
  move: MovementId
): string | null => {
  // PIN: a pinned villain can't move at all.
  if (state.player.statuses.pin > 0) return PINNED_REASON;
  const isBossHere = state.heroes.some(isDeep);
  const reshaped = MOVEMENTS[move].reshape(state.heroes);
  const isStuck = reshaped.every(
    (unit, index) => unit.row === state.heroes[index]?.row
  );
  return isBossHere && isStuck ? BLOCKED_BY_BOSS[move] : null;
};

/**
 * True when the field has room for `move`: fight on, the formation fits
 * and no boss holds the rows (cost aside).
 */
export const hasRoomFor = (state: CombatState, move: MovementId): boolean =>
  combatOutcome(state) === 'ongoing' &&
  isFormationFor(state, move) &&
  movementBlockReason(state, move) === null;

/** True when the villain can make `move`: there's room, and it's paid. */
export const canMove = (state: CombatState, move: MovementId): boolean =>
  hasRoomFor(state, move) && state.energy >= movementCost(state, move);

// --- ACTIONS ---
/** Measure the formation shift using the unit that travelled farthest. */
const shiftFormation = (state: CombatState, moveId: MovementId) => {
  const heroes = MOVEMENTS[moveId].reshape(
    state.heroes,
    state.player.statuses.move ?? 0
  );
  const previous = new Map(
    state.heroes.map((unit) => [unit.uid, rowDepth(unit.row)])
  );
  const distance = Math.max(
    0,
    ...heroes.map((unit) =>
      Math.abs(
        (previous.get(unit.uid) ?? rowDepth(unit.row)) - rowDepth(unit.row)
      )
    )
  );
  const travelRows =
    (state.travelRows ?? 0) + (moveId === 'charge' ? distance : -distance);
  return {
    heroes,
    travelRows,
    player: {
      ...state.player,
      statuses: { ...state.player.statuses, move: 0 },
    },
  };
};

/**
 * SKILL TREE GRANTS per move. SHIELD RUSH: every Charge adds Guard.
 * INVINCIBILITY FRAMES: every Back Step adds Invincible stacks.
 */
const skillGrant = (state: CombatState, moveId: MovementId): CombatState => {
  const guard =
    moveId === 'charge' ? chargeGuardOf(state.player.skillPicks) : 0;
  if (guard) return { ...state, player: addGuard(state.player, guard) };
  const stacks = moveId === 'backStep' ? iFramesOf(state.player.skillPicks) : 0;
  if (!stacks) return state;
  const { statuses } = state.player;
  return {
    ...state,
    player: {
      ...state.player,
      statuses: { ...statuses, invincible: statuses.invincible + stacks },
    },
  };
};

/** Refresh the on/off bonus without adding stacks. */
const grant = (
  state: CombatState,
  grants: MovementDef['grants']
): CombatState => {
  if (!grants) return state;
  const { statuses } = state.player;
  const raised = Math.max(statuses[grants.status], grants.amount);
  return {
    ...state,
    player: {
      ...state.player,
      statuses: { ...statuses, [grants.status]: raised },
    },
  };
};

/**
 * Makes `move`: pays its cost, extends the shared streak, reshapes the
 * field and grants its status. Does nothing if the move isn't allowed.
 */
export const move = (state: CombatState, moveId: MovementId): CombatState => {
  if (!canMove(state, moveId)) return state;
  const def = MOVEMENTS[moveId];
  const cost = movementCost(state, moveId);
  const paid: CombatState = {
    ...state,
    energy: state.energy - cost,
    playHistory: appendCombatHistory(state.playHistory, {
      turn: state.turn,
      move: moveId,
      cost,
    }),
    lastMovement: {
      move: moveId,
      turn: state.turn,
      streak: streakOf(state) + 1,
    },
    ...shiftFormation({ ...state, player: spendRush(state.player) }, moveId),
  };
  const moved = skillGrant(grant(paid, def.grants), moveId);
  return recordEffects(state, hexAfterPlayerAction(state, moved));
};

/** Rampage and Momentum cards grant the same non-stacking bonus as Charge. */
export const grantMomentum = (state: CombatState): CombatState =>
  grant(state, MOVEMENTS.charge.grants);

/** Makes a card's movement at its card cost without touching the button streak. */
export const moveFromCard = (
  state: CombatState,
  moveId: MovementId
): CombatState => {
  return moveFree(state, moveId);
};

/**
 * Makes `move` without a separate movement payment (card effect or keyword): only
 * when there's room, at no cost and outside the movement streak. Does
 * nothing when there's no room.
 */
export const moveFree = (
  state: CombatState,
  moveId: MovementId
): CombatState => {
  if (!hasRoomFor(state, moveId)) return state;
  const def = MOVEMENTS[moveId];
  const moved: CombatState = {
    ...state,
    freeMove: { move: moveId },
    ...shiftFormation(state, moveId),
  };
  return skillGrant(grant(moved, def.grants), moveId);
};

// --- TURN ---
/**
 * True while the villain still has something to do this turn: a card
 * in hand it can play (affordable, with a target), or a movement it can
 * make. When false the view ends the turn on its own.
 */
export const hasPlayLeft = (state: CombatState): boolean =>
  combatOutcome(state) === 'ongoing' &&
  (state.hand.some(
    (_, index) => canPlayCard(state, index) || canPlayCardOnSelf(state, index)
  ) ||
    MOVEMENT_IDS.some((moveId) => canMove(state, moveId)));
