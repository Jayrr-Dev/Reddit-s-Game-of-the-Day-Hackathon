// ===================================================================
// GAME RULES
// Every tunable number in Villain Arc. Balance changes happen here and
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
/** Range attacks made up close (at or from the front row) deal this share. */
export const CLOSE_RANGE_DAMAGE_FACTOR = 0.7;
/**
 * Each consecutive use of the same field move (this turn or the last)
 * costs this much more energy; a break in the streak resets it.
 */
export const FIELD_MOVE_STREAK_COST = 1;

// --- BATTLEFIELD ---
/** Columns in each row of the hero battlefield (rows are front and back). */
export const BATTLEFIELD_COLUMNS = 3;

// --- STATUSES ---
/** A combatant with dread deals this fraction of its attack damage. */
export const DREAD_DAMAGE_FACTOR = 0.75;

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
