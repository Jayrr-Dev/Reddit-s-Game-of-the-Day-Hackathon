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
 * - shock:  stacks; on the SHOCK_HITS-th hit it takes (any type,
 *           from anyone), it loses this much HP and clears (see
 *           Combatant.shockHits)
 * - bleed:  loses this much HP right after each of its actions (a hero
 *           move; the villain's whole turn), then drops by 1
 * - hex:    right before its turn, loses this much HP if it is odd
 *           (nothing when even), then hex drops by 1
 * - vex:    every affliction laid on it gets this many more stacks;
 *           drops by 1 at the end of its turn
 * - weaken: deals 25% less attack damage; drops by 1 at the end of its turn
 * - wrath: adds this much to every hit; lasts the whole fight
 * Buffs, gained from the villain's Buff cards, also last the whole fight:
 * - might:      adds this much to every Melee hit
 * - surge:      adds this much to every Magic hit
 * - hone:   adds this much to every Range hit
 * - reinforce: adds this much to every Guard a card gives
 * - instinct:  a chance to dodge each hero hit or affliction (Hex never;
 *              lasts through the heroes' turn, like Protection;
 *              see INSTINCT_DODGE_CHANCES)
 * - bane:      adds this much to every affliction your cards lay (Hex,
 *              Poison, Burn, Frost, Bleed, Shock; see BANE_AFFLICTIONS)
 * - sharpshooter: on or off; your shots ignore Out of Range and Range
 *   hits deal SHARPSHOOTER_DAMAGE_FACTOR times as much
 * Momentum comes from charging: while above 0 the next Melee card deals
 * 50% more damage (every hit of it), then it is spent; it is lost at
 * the end of the turn if no Melee card used it.
 * Aloft (heroes only): flown up into the sky. While above 0 Melee can't
 * reach the hero, Range and Magic hits mostly miss (ALOFT_EVASION) and
 * Curses always land; its next move comes down from the sky and clears it.
 */
export type BuffId =
  | 'might'
  | 'surge'
  | 'hone'
  | 'reinforce'
  | 'sharpshooter'
  | 'bane'
  | 'instinct';
export type StatusId =
  | 'hex'
  | 'poison'
  | 'burn'
  | 'frost'
  | 'shock'
  | 'bleed'
  /** Afflictions laid on it get this many more stacks; -1 a turn. */
  | 'vex'
  | 'weaken'
  | 'wrath'
  | 'momentum'
  | 'protection'
  /** Cuts the damage its bearer deals by tier; lapses unless reapplied. */
  | 'enfeeble'
  /** Keeps Guard from expiring, one turn per stack. */
  | 'brace'
  | 'aloft'
  /** Rush: the next this-many movements this turn cost 0. */
  | 'rush'
  | 'armor'
  | BuffId;
export type Statuses = Record<StatusId, number>;
/**
 * A boss's built-in trait: always on, never stacks or fades.
 * vigor      acts twice every heroes' turn
 * anchored   never moves and can't be moved (the Ballista)
 * longRange  its shots ignore Out of Range (see OUT_OF_RANGE_HIT_CHANCE)
 */
export type PassiveId = 'vigor' | 'longRange' | 'anchored';

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
  /**
   * Shots at it that missed this fight (Out of Range). Display only:
   * the view diffs it to pop "Miss". Missing on older saves (0).
   */
  missedShots?: number;
  /** Damage Armor has soaked in the fight, for the hit number's armor icon. */
  armorSoaked?: number;
  /** Hits and afflictions dodged (Instinct), for the "Dodge" pop. */
  dodgedHits?: number;
  /** Hits taken this turn while shocked (see Shock). */
  shockHits?: number;
  /** True when Protection was cast this turn (else it lapses at turn end). */
  protectionCast?: boolean;
  /** True when Enfeeble was laid on this unit this villain turn. */
  enfeebleApplied?: boolean;
};

// --- CARDS ---
/** Who a hostile card effect hits: the tapped hero or every hero. */
export type CardTarget = 'one' | 'all';

/** One step of a card (everything but Imbue, which grants these). */
export type BaseCardEffect =
  /**
   * Damage. `random` (Randomly): no aim; each hit lands on a random hero
   * it can reach, picked anew per hit on the fight's seeded rng.
   */
  | {
      kind: 'damage';
      amount: number;
      hits: number;
      target: CardTarget | 'random';
    }
  | { kind: 'hex'; amount: number; target: CardTarget }
  | { kind: 'vex'; amount: number; target: CardTarget }
  /** The next `amount` movements this turn cost 0 (see Rush). */
  | { kind: 'rush'; amount: number }
  /** Armor N: each physical (Melee, Range) hit on you is N lower. */
  | { kind: 'armor'; amount: number }
  | { kind: 'poison'; amount: number; target: CardTarget }
  | { kind: 'burn'; amount: number; target: CardTarget }
  | { kind: 'frost'; amount: number; target: CardTarget }
  | { kind: 'shock'; amount: number; target: CardTarget }
  | { kind: 'bleed'; amount: number; target: CardTarget }
  | { kind: 'weaken'; amount: number; target: CardTarget }
  /** Enfeebles the target: one tier up when reapplied turn after turn. */
  /** Enfeeble ×N: cast `times` times (default 1), a tier each, to III. */
  | { kind: 'enfeeble'; target: CardTarget; times?: number }
  /** Deals damage equal to the target's hex times `multiplier`. */
  | { kind: 'reap'; multiplier: number }
  | { kind: 'guard'; amount: number }
  /** Grants the villain Brace: its Guard lasts this many turns longer. */
  | { kind: 'brace'; amount: number }
  | { kind: 'wrath'; amount: number }
  /** Removes 1 random affliction from the villain (see STATUS_IS_AFFLICTION). */
  | { kind: 'cleanse' }
  /** Casts Protection on the villain (tiers up when cast turn after turn). */
  | { kind: 'protect' }
  /** Grants the villain a fight-long buff. */
  | { kind: 'buff'; buff: BuffId; amount: number; duration?: Duration }
  | { kind: 'draw'; amount: number }
  | { kind: 'energy'; amount: number }
  | { kind: 'heal'; amount: number }
  /** Pull N: drags the target up to `rows` rows nearer. */
  | { kind: 'pull'; rows: number }
  /** Knockback N: shoves the target up to `rows` rows farther. */
  | { kind: 'push'; rows: number }
  /** Multiplies a status already on the target (Overcharge: Shock ×2). */
  | { kind: 'amplify'; status: 'shock'; factor: number; target: CardTarget };

// --- DURATION ---
/**
 * How long a gift lasts, printed after it in italics ("this turn"):
 *   action  until the next card is played (that card still gets it)
 *   turn    until the end of this turn
 *   battle  for the whole fight
 * Without one, a buff lasts the fight. (Imbues always last the fight.)
 */
export type Duration = 'action' | 'turn' | 'battle';

/** A buff that wears off: taken back off the villain when it lapses. */
export type TimedBuff = {
  buff: BuffId;
  amount: number;
  duration: Exclude<Duration, 'battle'>;
};

// --- IMBUE ---
/** A keyword a card can be printed with or imbued with. */
export type CardKeyword =
  | 'hold'
  | 'piercing'
  | 'remove'
  | 'exhaust'
  | 'rampage'
  | 'distance'
  | 'longRange';
/**
 * Effects an imbue may grant. Pull and Push are left out: they change
 * who a card may aim at, and an imbue never changes a card's aim.
 */
export type ImbuableEffect = Exclude<
  BaseCardEffect,
  { kind: 'pull' | 'push' | 'amplify' }
>;
/** What an imbue grants a card: a keyword, or one more effect. */
export type ImbueGift =
  | { kind: 'keyword'; keyword: CardKeyword }
  | { kind: 'effect'; effect: ImbuableEffect };
/** A gift on one card. It stays with that card for the rest of the battle. */
export type Imbue = { gift: ImbueGift };

/** One step of a card. A card's effects resolve in order. */
export type CardEffect =
  | BaseCardEffect
  /** Grants another card in hand a keyword or an effect (see imbue.ts). */
  | ({ kind: 'imbue' } & Imbue);

/** Five tiers, rarest last; Basic is the starter deck (no gem). */
export type CardRarity = 'basic' | 'common' | 'uncommon' | 'rare' | 'legendary';

/**
 * A Magic card's element. It changes how the spell looks (its bolt,
 * its burst and the icon on its type pill), and some elements add to
 * every hit (see ELEMENT_ON_HIT in rules.ts: Ice lays Frost).
 */
export type MagicElement = 'fire' | 'ice' | 'healing' | 'lightning';

/**
 * A Melee card's edge: Sharp (blades: a slice lands) or Blunt (fists,
 * shields, hammers: a crushing thud lands). Cosmetic only: its icon on
 * the type ribbon and its hit effect; the rules never read it.
 */
export type MeleeEdge = 'sharp' | 'blunt';

/**
 * What kind of card it is. Shown on the card, and it decides reach:
 * Melee hits the front row only; Range, Magic and Curse reach any hero.
 * Defend and Buff cards act on the villain: Defend cards are mainly
 * Guard, Buff cards power the villain up (Wrath, buffs, energy, healing).
 * Utility cards are consumables (potions and tonics): they all Exhaust.
 */
export type CardType =
  'melee' | 'range' | 'magic' | 'defend' | 'buff' | 'curse' | 'utility';

export type CardDef = {
  name: string;
  type: CardType;
  cost: number;
  rarity: CardRarity;
  effects: readonly CardEffect[];
  /**
   * Its printed keywords: Hold stays in hand at the end of the turn;
   * Piercing hits also strike the hero right behind the target; Remove
   * goes to the Remove pile once played; Exhaust does too, and also
   * leaves the deck for the rest of the run.
   */
  keywords: readonly CardKeyword[];
  /** A Magic card's element (its look and on-hit rule), if any. */
  element?: MagicElement;
  /** A Melee card's edge (cosmetic: ribbon icon and hit effect). */
  edge?: MeleeEdge;
  /** An Exhaust card's own number of uses (default EXHAUST_USES). */
  uses?: number;
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
/** The afflictions a hero attack can lay on every hit (Thunder Talons). */
export type HeroHitAffliction = 'shock' | 'burn' | 'poison' | 'bleed';

export type HeroEffect =
  | {
      kind: 'attack';
      amount: number;
      hits: number;
      type: HeroAttackType;
      /** Homing: its hits can't be dodged (they skip Instinct). */
      isHoming?: boolean;
      /** An affliction laid on the villain by every hit that lands. */
      perHit?: { status: HeroHitAffliction; amount: number };
    }
  | { kind: 'hex'; amount: number }
  | { kind: 'poison'; amount: number }
  | { kind: 'burn'; amount: number }
  | { kind: 'frost'; amount: number }
  | { kind: 'shock'; amount: number }
  | { kind: 'bleed'; amount: number }
  | { kind: 'weaken'; amount: number }
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
  | { kind: 'soar' }
  /**
   * Knocks the villain back `lines` lines: every hero ends up that much
   * farther, as with a Back Step (and nobody walks in that turn).
   */
  | { kind: 'knockBack'; lines: number }
  /** Sets off the villain's Shock now, however many hits it has taken. */
  | { kind: 'detonate' };

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
  /** Cosmetic: a two-handed swipe (claws cross; see GriffonFigure). */
  isTwoHanded?: boolean;
};

export type HeroTier = 'grunt' | 'elite' | 'champion' | 'boss';

// --- BATTLEFIELD ---
/**
 * The heroes stand on a grid 3 columns wide and 3 rows deep (see
 * BATTLEFIELD_ROWS): the Front line, the Backline and the Horizon.
 * Fighters take the front; healers, buffers and archers the Backline.
 * The Horizon is where a new horde marches in from, and Out of Range.
 */
export type HeroRow = 'front' | 'back' | 'horizon';
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
  /** Built-in traits, e.g. Vigor: two moves a turn; Longrange. */
  passives?: readonly PassiveId[];
  /** Who acts first on the heroes' turn: higher goes earlier. */
  speed: number;
  /** Armor the hero starts every fight with (see the Armor status). */
  armor?: number;
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
  /** Which move it was (its speed lines show the way). */
  move: MovementId;
  turn: number;
  streak: number;
};

/** Battle imbues waiting in the piles for their card to be drawn. */
export type StowedImbue = { cardId: CardId; imbues: Imbue[] };

/**
 * Uses spent on the current copy of each Exhaust card, for the run.
 * Copies can't be told apart, so they wear one at a time: once a copy
 * is used up the count starts again for the next.
 */
export type UsesSpent = Partial<Record<CardId, number>>;

export type CombatState = {
  player: Combatant;
  heroes: HeroUnit[];
  energy: number;
  /** Unspent energy carried over from last turn (RESERVE_ENERGY_SLOTS). */
  reserve: number;
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
  /** Cards out of play for the rest of the fight (Remove, Exhaust). */
  removedPile: CardId[];
  /** Exhaust cards used up in this fight: the run drops them after. */
  exhausted: CardId[];
  /** Uses spent on each Exhaust card's current copy (see uses.ts). */
  usesSpent: UsesSpent;
  /** What each card in hand is imbued with, slot for slot with `hand`. */
  handImbues: Imbue[][];
  /**
   * Battle imbues of cards that left the hand for the piles. Copies of a
   * card can't be told apart there, so the next copy drawn takes them.
   */
  stowedImbues: StowedImbue[];
  /** Buffs that wear off after the next card or at the end of the turn. */
  timedBuffs: TimedBuff[];
  turn: number;
  /** Heroes defeated so far in this fight. */
  slain: number;
  rng: RngState;
  /** The last movement (its streak raises the next one's cost). */
  lastMovement: MovementRecord | null;
  /**
   * The last free move a keyword made (Rampage on kill, Distance on hit): a
   * fresh object each time, so the view can play its speed lines. It
   * costs nothing and never counts toward the movement streak.
   */
  freeMove: { move: MovementId } | null;
  /** The uid the next hero to join (a summon) gets; never reused. */
  nextUid: number;
  /** Heroes fallen this fight, as they fell (a revive brings them back). */
  fallen: HeroUnit[];
};

export type CombatOutcome = 'ongoing' | 'won' | 'lost';
