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
 * Lingering effects on a combatant (guard, the block value, shown to
 * players as "Guard", lives on the
 * combatant itself because it resets every turn):
 * - poison: loses this much HP at the end of its turn, then drops by 1
 * - burn:   loses this much HP right after each of its actions (a hero
 *           move; the villain's whole turn), then halves (3 -> 1, 1 -> 0)
 * - frost:  every hit it deals is 1 lower per stack (never below 0);
 *           halves the same way after each of its actions
 * - bleed:  stacks; on the BLEED_HITS-th non-Magic hit in a row it
 *           takes, from anyone, it loses this much HP and clears (a
 *           Magic hit resets the count; see Combatant.bleedHits)
 * - hex:    right before its turn, loses this much HP if it is odd
 *           (nothing when even), then hex drops by 1
 * - dread: deals 25% less attack damage; drops by 1 at the end of its turn
 * - wrath: adds this much to every hit; lasts the whole fight
 * Buffs, gained from the villain's Buff cards, also last the whole fight:
 * - might:      adds this much to every Melee hit
 * - surge:      adds this much to every Magic hit
 * - piercing:   adds this much to every Range hit
 * - reinforce: adds this much to every Guard a card gives
 * Momentum comes from charging: while above 0 the next Melee card deals
 * 50% more damage (every hit of it), then it is spent; it is lost at
 * the end of the turn if no Melee card used it.
 * Aloft (heroes only): flown up out of reach. While above 0 no card can
 * aim at or hit the hero; its next move comes down from the sky and
 * clears it.
 */
export type BuffId = 'might' | 'surge' | 'piercing' | 'reinforce';
export type StatusId =
  | 'hex'
  | 'poison'
  | 'burn'
  | 'frost'
  | 'bleed'
  | 'dread'
  | 'wrath'
  | 'momentum'
  | 'protection'
  | 'aloft'
  | BuffId;
export type Statuses = Record<StatusId, number>;
/**
 * A boss's built-in trait: always on, never stacks or fades.
 * vigor  acts twice every heroes' turn
 */
export type PassiveId = 'vigor';

/** Anything with HP that fights: the villain or a hero. */
export type Combatant = {
  hp: number;
  maxHp: number;
  /** Absorbs damage before HP. Clears at the start of the owner's turn. */
  guard: number;
  statuses: Statuses;
  /**
   * All damage that got past Guard this fight, overkill included (HP
   * stops at 0, this does not). Display only: hit numbers diff it, so a
   * 40-damage blow on a 10 HP hero still reads 40.
   */
  damageTaken: number;
  /** Non-Magic hits taken in a row while bleeding (see Bleed). */
  bleedHits?: number;
  /** True when Protection was cast this turn (else it lapses at turn end). */
  protectionCast?: boolean;
};

// --- CARDS ---
/** Who a hostile card effect hits: the tapped hero or every hero. */
export type CardTarget = 'one' | 'all';

/** One step of a card. A card's effects resolve in order. */
export type CardEffect =
  | { kind: 'damage'; amount: number; hits: number; target: CardTarget }
  | { kind: 'hex'; amount: number; target: CardTarget }
  | { kind: 'poison'; amount: number; target: CardTarget }
  | { kind: 'burn'; amount: number; target: CardTarget }
  | { kind: 'frost'; amount: number; target: CardTarget }
  | { kind: 'bleed'; amount: number; target: CardTarget }
  | { kind: 'dread'; amount: number; target: CardTarget }
  /** Deals damage equal to the target's hex times `multiplier`. */
  | { kind: 'reap'; multiplier: number }
  | { kind: 'guard'; amount: number }
  | { kind: 'wrath'; amount: number }
  /** Removes 1 random affliction from the villain (see STATUS_IS_AFFLICTION). */
  | { kind: 'cleanse' }
  /** Casts Protection on the villain (tiers up when cast turn after turn). */
  | { kind: 'protect' }
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
 * Defend and Buff cards act on the villain: Defend cards are mainly
 * Guard, Buff cards power the villain up (Wrath, buffs, energy, healing).
 */
export type CardType =
  'melee' | 'range' | 'magic' | 'defend' | 'buff' | 'curse';

export type CardDef = {
  name: string;
  type: CardType;
  cost: number;
  rarity: CardRarity;
  effects: readonly CardEffect[];
  /** A fading card leaves the fight after it is played. */
  fades: boolean;
  /** A Hold card stays in hand at the end of the turn instead of being discarded. */
  holds: boolean;
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
 * hits harder from the back row and loses that bonus up close (front
 * row), but stays Range; Magic works anywhere.
 */
export type HeroAttackType = Extract<CardType, 'melee' | 'range' | 'magic'>;

/** One step of a hero's move. `allies` means every living hero. */
export type HeroEffect =
  | { kind: 'attack'; amount: number; hits: number; type: HeroAttackType }
  | { kind: 'hex'; amount: number }
  | { kind: 'poison'; amount: number }
  | { kind: 'burn'; amount: number }
  | { kind: 'frost'; amount: number }
  | { kind: 'bleed'; amount: number }
  | { kind: 'dread'; amount: number }
  | { kind: 'guard'; amount: number; who: 'self' | 'allies' }
  | { kind: 'wrath'; amount: number; who: 'self' | 'allies' }
  | { kind: 'heal'; amount: number; who: 'self' | 'allies' }
  /** Removes 1 random affliction from itself, or from each ally. */
  | { kind: 'cleanse'; who: 'self' | 'allies' }
  /**
   * Calls `count` more of a hero onto the field, into open columns of
   * the summoner's own row, nearest first. Bound to the summoner: they
   * fall when it falls.
   */
  | { kind: 'summon'; heroId: SummonId; count: number }
  /**
   * Brings every fallen ally back at full HP, into the spot it fell in
   * when that spot is free.
   */
  | { kind: 'revive' }
  /**
   * Flies up out of reach (Aloft) and ends the hero's turn. Its next
   * move, a turn later, is made from the sky and brings it back down.
   */
  | { kind: 'soar' };

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
  /**
   * For a hero that stands in the front row and reaches back (a boss):
   * the columns, as offsets from its own leftmost one, it also fills in
   * the back row. [0, 1, 2] on a size-3 hero fills the whole field;
   * [1] makes a T. Such a hero never changes row.
   */
  backCols?: readonly number[];
  /** Built-in traits (bosses only), e.g. Vigor: two moves a turn. */
  passives?: readonly PassiveId[];
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
  /** Summoned or revived during the fight (it arrives in holy light). */
  joinedMidFight?: boolean;
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
  /** Heroes fallen this fight, as they fell (a revive brings them back). */
  fallen: HeroUnit[];
};

export type CombatOutcome = 'ongoing' | 'won' | 'lost';
