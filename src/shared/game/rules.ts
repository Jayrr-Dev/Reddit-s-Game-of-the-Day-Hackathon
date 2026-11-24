// ===================================================================
// GAME RULES
// Every tunable number in Villain Run. Balance changes happen here and
// nowhere else, so the engine, the UI and the server always agree.
// ===================================================================

// --- THE VILLAIN ---
export const PLAYER_MAX_HP = 60;
export const ENERGY_PER_TURN = 3;
export const CARDS_PER_TURN = 5;
/** Cards drawn beyond this are discarded instead of added to the hand. */
export const MAX_HAND_SIZE = 10;
/**
 * Energy it costs the villain to Charge: when the front row is empty,
 * the back row only steps up when the villain charges at them.
 */
export const CHARGE_COST = 1;
/** Momentum (gained by charging) multiplies the next Melee card's damage. */
export const MOMENTUM_DAMAGE_FACTOR = 1.5;
/**
 * Energy it costs the villain to Back Step: with the back row empty, the
 * whole front row is pushed back to the back row (out of melee reach).
 */
export const BACK_STEP_COST = 1;
/**
 * Range attacks at their proper range (a villain card at a back-row
 * hero, a hero shooting from the back row) deal this much damage.
 */
export const LONG_RANGE_DAMAGE_FACTOR = 1.3;
/**
 * Each movement in a row (Charge, Back Step ... all count together)
 * costs this much more energy. A full turn without moving resets it.
 */
export const MOVEMENT_STREAK_COST = 1;

// --- BATTLEFIELD ---
/** Columns in each row of the hero battlefield (rows are front and back). */
export const BATTLEFIELD_COLUMNS = 3;

// --- STATUSES ---
/** A combatant with dread deals this fraction of its attack damage. */
export const DREAD_DAMAGE_FACTOR = 0.75;
/** Burn and Frost are divided by this after each action (a half rounds down). */
export const AFTER_ACTION_DIVISOR = 2;
/** Bleed bursts on this many non-Magic hits in a row. */
export const BLEED_HITS = 3;
/** Each stack of Frost takes this much off every hit its bearer deals. */
export const FROST_DAMAGE_PER_STACK = 1;
/** Hex drops by this much every turn (it burns only on odd counts). */
export const HEX_DECAY = 1;
/** An odd Hex whose last digit is this (3, 13, 23...) burns harder. */
export const HEX_EMPOWERED_DIGIT = 3;
/** How much harder that Hex burns (Hex 3 burns for 6). */
export const HEX_EMPOWERED_MULTIPLIER = 2;

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
