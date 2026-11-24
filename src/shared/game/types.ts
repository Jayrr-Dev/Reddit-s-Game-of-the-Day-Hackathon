// ===================================================================
// GAME TYPES
// The vocabulary of Villain Run. Catalogs (cards, heroes) are data that
// match these shapes, and every rule is a pure function over them.
// ===================================================================

import type { CardId } from './cards.ts';
import type { HeroId } from './heroes.ts';
import type { RngState } from './rng.ts';

// --- STATUSES ---
/**
 * Lingering effects on a combatant (shroud, the block value, shown to
 * players as "Guard", lives on the
 * combatant itself because it resets every turn):
 * - hex:   loses this much HP at the end of its turn, then hex drops by 1
 * - dread: deals 25% less attack damage; drops by 1 at the end of its turn
 * - wrath: adds this much to every hit; lasts the whole fight
 * Buffs, gained from the villain's Buff cards, also last the whole fight:
 * - might:      adds this much to every Melee hit
 * - surge:      adds this much to every Magic hit
 * - piercing:   adds this much to every Range hit
 * - protection: adds this much to every Shroud a card gives
 * Momentum comes from charging: while above 0 the next Melee card deals
 * 50% more damage (every hit of it), then it is spent; it is lost at
 * the end of the turn if no Melee card used it.
 */
export type BuffId = 'might' | 'surge' | 'piercing' | 'protection';
export type StatusId = 'hex' | 'dread' | 'wrath' | 'momentum' | BuffId;
export type Statuses = Record<StatusId, number>;

/** Anything with HP that fights: the villain or a hero. */
export type Combatant = {
  hp: number;
  maxHp: number;
  /** Absorbs damage before HP. Clears at the start of the owner's turn. */
  shroud: number;
  statuses: Statuses;
  /**
   * All damage that got past Guard this fight, overkill included (HP
   * stops at 0, this does not). Display only: hit numbers diff it, so a
   * 40-damage blow on a 10 HP hero still reads 40.
   */
  damageTaken: number;
};

// --- CARDS ---
/** Who a hostile card effect hits: the tapped hero or every hero. */
export type CardTarget = 'one' | 'all';

/** One step of a card. A card's effects resolve in order. */
export type CardEffect =
  | { kind: 'damage'; amount: number; hits: number; target: CardTarget }
  | { kind: 'hex'; amount: number; target: CardTarget }
  | { kind: 'dread'; amount: number; target: CardTarget }
  /** Deals damage equal to the target's hex times `multiplier`. */
  | { kind: 'reap'; multiplier: number }
  | { kind: 'shroud'; amount: number }
  | { kind: 'wrath'; amount: number }
  /** Grants the villain a fight-long buff. */
  | { kind: 'buff'; buff: BuffId; amount: number }
  | { kind: 'draw'; amount: number }
  | { kind: 'energy'; amount: number }
  | { kind: 'heal'; amount: number }
  /** Drags the target from the back row into the front row. */
  | { kind: 'pull' }
  /** Shoves the target from the front row into the back row. */
  | { kind: 'push' };

export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare';

/**
 * What kind of card it is. Shown on the card, and it decides reach:
 * Melee hits the front row only; Range, Magic and Curse reach any hero.
 * Buff cards act on the villain.
 */
export type CardType = 'melee' | 'range' | 'magic' | 'buff' | 'curse';

export type CardDef = {
  name: string;
  type: CardType;
  cost: number;
  rarity: CardRarity;
  effects: readonly CardEffect[];
  /** A fading card leaves the fight after it is played. */
  fades: boolean;
  /**
   * Reach cards can hit the back row. Without Reach, damage is melee and
   * only reaches the front row (curses and Hex always reach). Derived
   * from `type` when the card is built (see REACHING_TYPES in cards.ts).
   */
  reach: boolean;
  /**
   * Target N: how many picks the card takes. Each pick is a target the
   * player chooses (the same hero may be picked again), and the card's
   * effects resolve once per pick, in order. 1 for ordinary cards.
   */
  targets: number;
};

// --- HEROES ---
/**
 * How a hero attack lands. Melee only works from the front row; Range
 * hits harder from the back row and lands as plain Melee up close (front
 * row); Magic works anywhere.
 */
export type HeroAttackType = Extract<CardType, 'melee' | 'range' | 'magic'>;

/** One step of a hero's move. `allies` means every living hero. */
export type HeroEffect =
  | { kind: 'attack'; amount: number; hits: number; type: HeroAttackType }
  | { kind: 'hex'; amount: number }
  | { kind: 'dread'; amount: number }
  | { kind: 'shroud'; amount: number; who: 'self' | 'allies' }
  | { kind: 'wrath'; amount: number; who: 'self' | 'allies' }
  | { kind: 'heal'; amount: number; who: 'self' | 'allies' }
  /**
   * Calls `count` more of a hero onto the field, into open columns of
   * the summoner's own row, nearest first. Bound to the summoner: they
   * fall when it falls.
   */
  | { kind: 'summon'; heroId: SummonId; count: number };

/**
 * Heroes that only ever join a fight by being summoned. Named here, not
 * derived from the catalog, because the catalog's own moves use it
 * (each one must still be a HeroId: getHero checks that).
 */
export type SummonId = 'angelArcher';

export type HeroMove = {
  name: string;
  effects: readonly HeroEffect[];
  /** The hero's signature move: it plays its own special animation. */
  isSignature?: boolean;
};

export type HeroTier = 'grunt' | 'elite' | 'champion' | 'boss';

// --- BATTLEFIELD ---
/**
 * The heroes stand on a grid 3 columns wide and 2 rows deep. Fighters
 * take the front row; healers, buffers and archers keep to the back.
 */
export type HeroRow = 'front' | 'back';
/** How many columns a hero fills: grunts 1, elites 2, champions 3. */
export type HeroSize = 1 | 2 | 3;
/**
 * How many rows a hero fills: 1 for everyone but bosses. A 2-deep hero
 * stands in the front row and fills the back row behind it too; it can
 * never be pulled or pushed.
 */
export type HeroDepth = 1 | 2;

export type HeroDef = {
  name: string;
  tier: HeroTier;
  maxHp: number;
  /** Moves repeat in order, so players can read and plan around them. */
  moves: readonly HeroMove[];
  /** Portrait hue (0 to 360). Each hero gets its own heraldic colour. */
  hue: number;
  /** The row this hero takes when the fight starts. */
  row: HeroRow;
  size: HeroSize;
  /** The column it would rather start in (e.g. a boss takes the centre). */
  col?: number;
  /** Rows filled (see HeroDepth); 1 when left out. */
  depth?: HeroDepth;
  /** Moves made each heroes' turn, in cycle order; 1 when left out. */
  actions?: number;
  /** Who acts first on the heroes' turn: higher goes earlier. */
  speed: number;
};

// --- COMBAT STATE ---
/** A hero on the field. `uid` tells two Archers apart for targeting. */
export type HeroUnit = Combatant & {
  uid: number;
  heroId: HeroId;
  moveIndex: number;
  /** Strength multiplier from how deep into the kingdom this fight is. */
  might: number;
  row: HeroRow;
  /** Leftmost battlefield column (0 to 2) this hero stands in. */
  col: number;
  /** The hero that summoned this one: it falls when that hero falls. */
  summonerUid?: number;
};

/** The villain's moves on the battlefield itself (see movement.ts). */
export type MovementId = 'charge' | 'backStep';

/** The last movement: on what turn, and how many in a row so far. */
export type MovementRecord = {
  turn: number;
  streak: number;
};

export type CombatState = {
  player: Combatant;
  heroes: HeroUnit[];
  energy: number;
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
  fadedPile: CardId[];
  turn: number;
  /** Heroes defeated so far in this fight. */
  slain: number;
  rng: RngState;
  /** The last movement (its streak raises the next one's cost). */
  lastMovement: MovementRecord | null;
  /** The uid the next hero to join (a summon) gets; never reused. */
  nextUid: number;
};

export type CombatOutcome = 'ongoing' | 'won' | 'lost';
