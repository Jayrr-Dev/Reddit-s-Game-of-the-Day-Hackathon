// ===================================================================
// MOVEMENT
// The villain's moves on the battlefield itself, as data. Each move
// says which formation it needs, how it reshapes the field and what it
// grants. To add a move, add an entry to MOVEMENTS (and its id to
// MovementId); cost, availability and the action log handle it.
//
// SHARED COST: every movement counts toward one streak, whatever its
// kind. Each move costs its base cost plus MOVEMENT_STREAK_COST per
// move made in a row. The streak survives the turn it was made and the
// next one; it resets only after one full turn with no movement.
// Example: Charge on turn 3 (1), Back Step on turn 3 (2), Charge on
// turn 4 (3). Nothing on turn 5. Turn 6: back to 1.
// ===================================================================

import { fallBack, isDeep, stepForward } from './battlefield.ts';
import { canPlayCard, combatOutcome } from './combat.ts';
import {
  BACK_STEP_COST,
  BACK_STEP_ROWS,
  CHARGE_COST,
  CHARGE_ROWS,
  MOVEMENT_STREAK_COST,
} from './rules.ts';
import type { CombatState, HeroUnit, MovementId, StatusId } from './types.ts';

// --- TYPES ---
/** One movement's rules. */
export type MovementDef = {
  /** Energy it costs with no streak running. */
  baseCost: number;
  /** It is offered only while the heroes stand like this. */
  fitsFormation: (heroes: readonly HeroUnit[]) => boolean;
  /** How the heroes' places change when the villain moves. */
  reshape: (heroes: HeroUnit[]) => HeroUnit[];
  /**
   * A status the villain gains, raised to at least `amount` (moving
   * twice doesn't stack it).
   */
  grants?: { status: StatusId; amount: number };
};

// --- REGISTRY ---
export const MOVEMENTS: Record<MovementId, MovementDef> = {
  /**
   * Rush an empty front row: the field closes in up to CHARGE_ROWS rows
   * (until someone stands in front), and the next Melee card hits harder.
   */
  charge: {
    baseCost: CHARGE_COST,
    fitsFormation: (heroes) => heroes.every((unit) => unit.row !== 'front'),
    reshape: (heroes) => stepForward(heroes, CHARGE_ROWS),
    grants: { status: 'momentum', amount: 1 },
  },
  /** Fall back from a full front row: the field drops BACK_STEP_ROWS row. */
  backStep: {
    baseCost: BACK_STEP_COST,
    fitsFormation: (heroes) => heroes.every((unit) => unit.row === 'front'),
    reshape: (heroes) => fallBack(heroes, BACK_STEP_ROWS),
  },
};

/** What a locked move says while a boss reaches into the back row. */
const BLOCKED_BY_BOSS: Record<MovementId, string> = {
  charge: 'A boss holds the field: there is no line to rush.',
  backStep: 'A boss holds Line 2 too: there is no room to fall back.',
};

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
  MOVEMENTS[move].baseCost + streakOf(state) * MOVEMENT_STREAK_COST;

/** True while the formation allows `move` (cost aside). */
const isFormationFor = (state: CombatState, move: MovementId): boolean =>
  state.heroes.length > 0 && MOVEMENTS[move].fitsFormation(state.heroes);

/** The movement the field offers right now, if any (cost aside). */
export const offeredMovement = (state: CombatState): MovementId | null =>
  MOVEMENT_IDS.find((move) => isFormationFor(state, move)) ?? null;

/**
 * Why an offered move can't be made at all (cost aside), or null. A
 * boss that reaches into the back row (see isDeep) never moves row:
 * there is nowhere to fall back to, so Back Step is shown but locked.
 */
export const movementBlockReason = (
  state: CombatState,
  move: MovementId
): string | null => (state.heroes.some(isDeep) ? BLOCKED_BY_BOSS[move] : null);

/**
 * True when the field has room for `move`: fight on, the formation fits
 * and no boss holds the rows (cost aside).
 */
const hasRoomFor = (state: CombatState, move: MovementId): boolean =>
  combatOutcome(state) === 'ongoing' &&
  isFormationFor(state, move) &&
  movementBlockReason(state, move) === null;

/** True when the villain can make `move`: there's room, and it's paid. */
export const canMove = (state: CombatState, move: MovementId): boolean =>
  hasRoomFor(state, move) && state.energy >= movementCost(state, move);

// --- ACTIONS ---
/** Raises one villain status to at least `amount`. */
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
  const paid: CombatState = {
    ...state,
    energy: state.energy - movementCost(state, moveId),
    lastMovement: {
      move: moveId,
      turn: state.turn,
      streak: streakOf(state) + 1,
    },
    heroes: def.reshape(state.heroes),
  };
  return grant(paid, def.grants);
};

/**
 * Makes `move` for free (Rampage on a kill, Distance on a hit): only
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
    heroes: def.reshape(state.heroes),
  };
  return grant(moved, def.grants);
};

// --- TURN ---
/**
 * True while the villain still has something to do this turn: a card
 * in hand it can play (affordable, with a target), or a movement it can
 * make. When false the view ends the turn on its own.
 */
export const hasPlayLeft = (state: CombatState): boolean =>
  combatOutcome(state) === 'ongoing' &&
  (state.hand.some((_, index) => canPlayCard(state, index)) ||
    MOVEMENT_IDS.some((moveId) => canMove(state, moveId)));
