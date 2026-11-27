// ===================================================================
// GAME RULES
// Every tunable number in Villain Run. Balance changes happen here and
// nowhere else, so the engine, the UI and the server always agree.
// ===================================================================

import type {
  BuffId,
  CardKeyword,
  CardType,
  HeroRow,
  MagicElement,
  StatusId,
} from './types.ts';

// --- THE VILLAIN ---
/** Starting max HP before any Vigor training. */
export const PLAYER_MAX_HP = 66;
/** Total max HP with the Vigor tree fully trained; Vigor's gains span the gap. */
export const LEGACY_PLAYER_HP_CAP = 333;
export const PLAYER_HP_CAP = 666;
export const ENERGY_PER_TURN = 3;
/**
 * RESERVE ENERGY: how much unspent energy can carry over when you end
 * your turn. It sits in the reserve slots through the heroes' turn and
 * is added on top of the next turn's ENERGY_PER_TURN.
 */
export const RESERVE_ENERGY_SLOTS = 0;
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
/** A Rampage card gets double Momentum's bonus: +50% becomes +100%. */
export const RAMPAGE_MOMENTUM_FACTOR = 1 + (MOMENTUM_DAMAGE_FACTOR - 1) * 2;
/** How many times Momentum's bonus a Rampage card gets. */
export const RAMPAGE_MOMENTUM_MULTIPLIER = 2;
/** Sharpshooter multiplies every Range hit (and its shots never miss). */
export const SHARPSHOOTER_DAMAGE_FACTOR = 1.2;
/** Sharpshooter adds this to every shot's chance to land (capped at 1). */
export const SHARPSHOOTER_ACCURACY_BONUS = 0.5;
/**
 * The afflictions Bane strengthens: those counted in stacks. (Weaken
 * counts turns and Enfeeble tiers, so Bane leaves them alone.)
 */
export const BANE_AFFLICTIONS: ReadonlySet<StatusId> = new Set([
  'hex',
  'poison',
  'burn',
  'frost',
  'bleed',
  'shock',
]);
/**
 * BLEED: a Melee or Range attack landed on a bleeding unit bites for this share of
 * its Bleed, rounded up (so even Bleed 1 bites for 1), then Bleed -1.
 */
export const BLEED_BITE_FACTOR = 1 / 3;
/** Buffs that are on or off: their stacks are never printed or shown. */
export const ON_OFF_BUFFS: ReadonlySet<BuffId> = new Set([
  'reflex',
  'berserker',
]);
/**
 * On/off buffs that give every card of a type a keyword while on, as if
 * imbued (see cardImbuesAt). Berserker: every Melee card has Rampage.
 */
export const BUFF_KEYWORDS: readonly {
  buff: BuffId;
  type: CardType;
  keyword: CardKeyword;
}[] = [{ buff: 'berserker', type: 'melee', keyword: 'rampage' }];
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
export const LONG_RANGE_DAMAGE_FACTOR = 1.25;
/**
 * Each movement in a row (Charge, Back Step ... all count together)
 * costs this much more energy. A full turn without moving resets it.
 */
export const MOVEMENT_STREAK_COST = 1;

// --- BATTLEFIELD ---
/** Columns in each row of the hero battlefield. */
export const BATTLEFIELD_COLUMNS = 3;
/**
 * RESERVE SPOTS: extra places in each line, used only when Knockback or
 * Pull forces a hero into a line that is full (walking never uses them).
 */
export const RESERVE_SPOTS_PER_LINE = 2;
/**
 * The battlefield's rows, nearest to the villain first: Frontline,
 * Midline and Backline (the Horizon). Every row rule (pulls, pushes, Charge, Back
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
 * ROW LABELS: the one place a row's player-facing name is written.
 * Every tooltip, help line and tutorial step reads these, so renaming a
 * line is a one-line change. The engine ids (front, back, horizon) and
 * save data never change.
 */
export const ROW_LABEL: Readonly<Record<HeroRow, string>> = {
  front: 'Frontline',
  back: 'Midline',
  horizon: 'Backline',
};
/**
 * OUT OF RANGE: the farthest row. A Range or Magic shot fired from it,
 * or into it, lands only this share of the time (rolled per hit on the
 * fight's seeded rng). Longrange ignores it, both ways.
 */
export const OUT_OF_RANGE_ROW: HeroRow = 'horizon';
export const OUT_OF_RANGE_HIT_CHANCE = 0.5;

// --- ALOFT ---
/**
 * A hero Aloft is out of Melee reach. Only these card types may aim at
 * or hit it: a Curse always lands (a hex can't be dodged), while a
 * Range or Magic shot (ALOFT_EVADING_TYPES) lands only 1 - ALOFT_EVASION
 * of the time, rolled per hit on the fight's seeded rng.
 */
export const ALOFT_REACHABLE_TYPES: ReadonlySet<CardType> = new Set([
  'range',
  'magic',
  'curse',
]);
export const ALOFT_EVADING_TYPES: ReadonlySet<CardType> = new Set([
  'range',
  'magic',
]);
export const ALOFT_EVASION = 0.85;

// --- ROUND BUFFS ---
/**
 * Buffs normally spent when the next turn starts, unless the card set
 * an explicit Stacked Buff duration.
 */
export const ROUND_BUFFS: readonly StatusId[] = ['protection', 'instinct'];

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
export const CHARGE_ROWS = 1;
/** Rows a Back Step falls back. */
export const BACK_STEP_ROWS = 1;

// --- STATUSES ---
/** A combatant with weaken deals this fraction of its attack damage. */
export const WEAKEN_DAMAGE_FACTOR = 0.75;
/** Burn and Frost are divided by this after each action (a half rounds down). */
export const AFTER_ACTION_DIVISOR = 2;
/** Shock bursts on this many hits (of any type) taken while shocked. */
export const SHOCK_HITS = 4;
/** A Shock that goes off deals its stacks times this. */
export const SHOCK_BURST_FACTOR = 2;
/** Each stack of Frost takes this much off every hit its bearer deals. */
export const FROST_DAMAGE_PER_STACK = 1;
/**
 * Statuses only enemy units deal in or carry: the Grand Griffon's Aloft,
 * and Fatigue (only units lay it, on the villain's cards). The Mechanics
 * library lists them under Unit Statuses.
 */
export const UNIT_ONLY_STATUSES: ReadonlySet<StatusId> = new Set(['aloft', 'fatigue', 'fatigueAll']);
/** Fatigue: each stack makes one random card in hand cost this much more. */
export const FATIGUE_COST_PER_STACK = 1;
/**
 * Which statuses are AFFLICTIONS (harmful to whoever carries them).
 * Cleanse removes one of these at random; every status must say.
 */
export const STATUS_IS_AFFLICTION: Record<StatusId, boolean> = {
  hex: true,
  poison: true,
  burn: true,
  frost: true,
  shock: true,
  bleed: true,
  vex: true,
  weaken: true,
  enfeeble: true,
  malaise: true,
  hitLimit: true,
  brace: false,
  wrath: false,
  might: false,
  surge: false,
  hone: false,
  reinforce: false,
  sharpshooter: false,
  berserker: false,
  bane: false,
  instinct: false,
  reflex: false,
  invincible: false,
  momentum: false,
  protection: false,
  aloft: false,
  cloak: false,
  move: false,
  rush: false,
  armor: false,
  pin: true,
  fatigue: true,
  fatigueAll: true,
  scramble: true,
};

/**
 * TIERED STATUSES (Protection, Enfeeble): the share of damage each tier
 * (I, II, III) cuts. Protection cuts hits taken; Enfeeble cuts the
 * damage its bearer deals. Reapplying raises the tier while active.
 */
/** Hit types Armor blunts: physical blows, not Magic or Curses. */
export const PHYSICAL_TYPES: ReadonlySet<CardType> = new Set([
  'melee',
  'range',
]);

/** Stacked Buff family: damage reduction or dodge chance by tier. */
export const TIERED_CUT_BY_TIER = [0, 0.25, 0.5, 0.75, 0.95] as const;
export const TIERED_MAX_TIER = TIERED_CUT_BY_TIER.length - 1;
/** Complete enemy turns covered by a member of the Stacked Buff family. */
export const STACKING_BUFF_TURNS = 2;
/** Flat dodge bonus from a successful Back Step; does not stack with itself. */
export const REFLEX_DODGE = 0.25;
/** Malaise duration from natural Tier IV expiry, not the explicit Malaise N keyword. */
export const MALAISE_TURNS = 1;
/**
 * PIERCING: the share of each hit that also lands on the hero directly
 * behind the target (1 = full damage; lower it for a falloff).
 */
export const PIERCE_DAMAGE_FACTOR = 1;
/** An even Hex (it does not burn) grows by this much each turn. */
export const HEX_GROWTH = 1;
/** After an odd Hex burns, it loses this share of itself (rounded up). */
export const HEX_BURN_LOSS = 1 / 3;
/** How much an odd Hex burns for, times its value (Hex 5 burns 10). */
export const HEX_ODD_MULTIPLIER = 2;
/** An odd Hex whose last digit is this (3, 13, 23...) burns harder, then clears. */
export const HEX_EMPOWERED_DIGIT = 3;
/** How much that Hex burns for, times its value (Hex 3 burns 9). */
export const HEX_EMPOWERED_MULTIPLIER = 3;

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
  lightning: null,
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
export const XP_PER_VICTORY = 100;
/** Cards offered after a fight or at the dark altar. */
export const OFFER_SIZE = 3;

// --- SCORE ---
export const SCORE_PER_WAVE = 100;
export const SCORE_PER_HERO_SLAIN = 10;
export const SCORE_PER_REGION = 500;

// --- SAFETY LIMITS ---
/** Longer multi-wave battles need room for a full campaign action log. */
export const MAX_RUN_ACTIONS = 18000;
