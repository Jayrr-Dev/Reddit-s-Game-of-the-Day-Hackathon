// ===================================================================
// GAME RULES
// Every tunable number in Villain Run. Balance changes happen here and
// nowhere else, so the engine, the UI and the server always agree.
// ===================================================================

import type { CardType, HeroRow, MagicElement, StatusId } from './types.ts';

// --- THE VILLAIN ---
export const PLAYER_MAX_HP = 60;
export const ENERGY_PER_TURN = 3;
export const CARDS_PER_TURN = 5;
/** Cards drawn beyond this are discarded instead of added to the hand. */
export const MAX_HAND_SIZE = 10;
/** The most imbues one card in hand can hold; a full card takes no more. */
export const MAX_IMBUES_PER_CARD = 3;
/**
 * Energy it costs the villain to Charge: when the front row is empty,
 * the field closes in (up to CHARGE_ROWS rows) when the villain charges.
 */
export const CHARGE_COST = 1;
/** Momentum (gained by charging) multiplies the next Melee card's damage. */
export const MOMENTUM_DAMAGE_FACTOR = 1.5;
/**
 * Energy it costs the villain to Back Step: with everyone in the front
 * row, the field falls back BACK_STEP_ROWS row (out of melee reach).
 */
export const BACK_STEP_COST = 1;
/**
 * Range attacks at their proper range (a villain card at a hero past
 * the front row, a hero shooting from past the front row) deal this
 * much damage.
 */
export const LONG_RANGE_DAMAGE_FACTOR = 1.3;
/**
 * Each movement in a row (Charge, Back Step ... all count together)
 * costs this much more energy. A full turn without moving resets it.
 */
export const MOVEMENT_STREAK_COST = 1;

// --- BATTLEFIELD ---
/** Columns in each row of the hero battlefield. */
export const BATTLEFIELD_COLUMNS = 3;
/**
 * The battlefield's rows, nearest to the villain first: Line 1, Line 2
 * and Line 3 (the Horizon). Every row rule (pulls, pushes, Charge, Back
 * Step, Piercing) walks this list (see activeRows in battlefield.ts),
 * so its length is the row count. With the three-row flag off (see
 * features.ts) only the first BASE_ROW_COUNT rows are in play.
 */
export const BATTLEFIELD_ROWS: readonly HeroRow[] = [
  'front',
  'back',
  'horizon',
];
export const BASE_ROW_COUNT = 2;
/**
 * OUT OF RANGE: the farthest row. A Range or Magic shot fired from it,
 * or into it, lands only this share of the time (rolled per hit on the
 * fight's seeded rng). Longrange ignores it, both ways.
 */
export const OUT_OF_RANGE_ROW: HeroRow = 'horizon';
export const OUT_OF_RANGE_HIT_CHANCE = 0.5;

// --- EXHAUST ---
/**
 * How many times an Exhaust card can be played in a run (unless the
 * card prints its own number) before it's gone from the deck.
 */
export const EXHAUST_USES = 3;
/** The shot types Out of Range applies to (Melee never fires that far). */
export const OUT_OF_RANGE_TYPES: ReadonlySet<CardType> = new Set([
  'range',
  'magic',
]);
/**
 * Most battlefield cells heroes may fill at once (of the 9), summons
 * and revivals included, so there is always room left to move. A big
 * hero counts every cell it fills. A summon or revival past it fizzles.
 */
export const MAX_HERO_CELLS = 6;
/** Rows a Charge closes at most (it stops once someone is in the front). */
export const CHARGE_ROWS = 2;
/** Rows a Back Step falls back. */
export const BACK_STEP_ROWS = 1;

// --- STATUSES ---
/** A combatant with weaken deals this fraction of its attack damage. */
export const WEAKEN_DAMAGE_FACTOR = 0.75;
/** Burn and Frost are divided by this after each action (a half rounds down). */
export const AFTER_ACTION_DIVISOR = 2;
/** Bleed bursts on this many non-Magic hits in a row. */
export const BLEED_HITS = 3;
/** Each stack of Frost takes this much off every hit its bearer deals. */
export const FROST_DAMAGE_PER_STACK = 1;
/**
 * Which statuses are AFFLICTIONS (harmful to whoever carries them).
 * Cleanse removes one of these at random; every status must say.
 */
export const STATUS_IS_AFFLICTION: Record<StatusId, boolean> = {
  hex: true,
  poison: true,
  burn: true,
  frost: true,
  bleed: true,
  weaken: true,
  enfeeble: true,
  brace: false,
  wrath: false,
  might: false,
  surge: false,
  hone: false,
  reinforce: false,
  momentum: false,
  protection: false,
  aloft: false,
};

/**
 * TIERED STATUSES (Protection, Enfeeble): the share of damage each tier
 * (I, II, III) cuts. Protection cuts hits taken; Enfeeble cuts the
 * damage its bearer deals. Renewed on back-to-back turns a tiered status
 * climbs a tier, up to TIERED_MAX_TIER; a turn without renewal and it
 * lapses.
 */
export const TIERED_CUT_BY_TIER = [0, 0.25, 0.5, 0.75] as const;
export const TIERED_MAX_TIER = 3;
/**
 * PIERCING: the share of each hit that also lands on the hero directly
 * behind the target (1 = full damage; lower it for a falloff).
 */
export const PIERCE_DAMAGE_FACTOR = 1;
/** An even Hex (it does not burn) grows by this much each turn. */
export const HEX_GROWTH = 1;
/** After an odd Hex burns, it loses this share of itself (rounded up). */
export const HEX_BURN_LOSS = 1 / 3;
/** An odd Hex whose last digit is this (3, 13, 23...) burns harder, then clears. */
export const HEX_EMPOWERED_DIGIT = 3;
/** How much harder that Hex burns (Hex 3 burns for 6). */
export const HEX_EMPOWERED_MULTIPLIER = 2;

// --- MAGIC ELEMENTS ---
/** A status an element lays on every hit, and how much. */
export type ElementOnHit = { status: StatusId; amount: number };

/**
 * What each Magic element adds to every hit its card lands (null: the
 * element is only a look). Ice chills: 1 Frost per hit.
 */
export const ELEMENT_ON_HIT: Record<MagicElement, ElementOnHit | null> = {
  fire: null,
  ice: { status: 'frost', amount: 1 },
  healing: null,
};

// --- THE KINGDOM ---
/** Regions in conquest order. Each ends with its champion (see heroes.ts). */
export const REGION_NAMES = [
  'Border Village',
  "King's Road",
  'Monastery',
  'Castle Gates',
  'Royal Court',
  'Throne Room',
] as const;
/** Stops per region. The last stop of every region is its champion. */
export const STOPS_PER_REGION = 5;

// --- ENDLESS SCALING ---
// Heroes get stronger the deeper the villain pushes, so every run ends.
/** Extra hero strength per region conquered (0.4 = +40%). */
export const MIGHT_PER_REGION = 0.4;
/** Extra hero strength per stop inside a region. */
export const MIGHT_PER_STOP = 0.06;

// --- REST AND REWARDS ---
/** "Mourn" at her grave heals this fraction of max HP. */
export const GRAVE_HEAL_FRACTION = 0.35;
/** "Swear vengeance" at her grave raises max HP by this much (and heals it). */
export const GRAVE_VOW_MAX_HP = 8;
/** HP restored after defeating a region's champion. */
export const CHAMPION_VICTORY_HEAL = 15;
/** Cards offered after a fight or at the dark altar. */
export const OFFER_SIZE = 3;

// --- SCORE ---
export const SCORE_PER_WAVE = 100;
export const SCORE_PER_HERO_SLAIN = 10;
export const SCORE_PER_REGION = 500;

// --- SAFETY LIMITS ---
/** The server refuses action logs longer than this. */
export const MAX_RUN_ACTIONS = 6000;
