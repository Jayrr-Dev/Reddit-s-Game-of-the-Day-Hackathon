import type { Equipment, TraitNodes, Traits } from './character.ts';
// ===================================================================
// GAME TYPES
// The vocabulary of Villain Run. Catalogs (cards, heroes) are data that
// match these shapes, and every rule is a pure function over them.
// ===================================================================

import type { CardId } from './cards.ts';
import type { HeroId } from './heroes.ts';
import type { RngState } from './rng.ts';
import type { SkillPick } from './skills.ts';

// --- STATUSES ---
/**
 * Lingering effects on a combatant (guard, the block value, shown to
 * players as "Guard", lives on the
 * combatant itself because it resets every turn):
 * - poison: loses this much HP right before each of its actions (a hero
 *           move; the villain's turn start); grows by 1 whenever anyone acts or this unit takes a direct hit
 * - burn:   deals damage on application and right after each of its actions (a hero
 *           move; the villain's whole turn), then halves (3 -> 1, 1 -> 0)
 * - frost:  every hit it deals is 1 lower per stack (never below 0);
 *           halves the same way after each of its actions
 * - shock:  the next landed attack bursts these stacks once and halves them
 * - bleed:  each landed Melee/Range hit adds damage past Guard; total lands
 *           after the attack, then Bleed drops by 1 (see Combatant.bleedTaken)
 * - hex:    grows after player actions (also enemy actions when on the player); odd stacks burst at player turn start and against enemies after each player action.
 *           The enemy turn does not tick Hex.
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
 *              lasts through two enemy turns; Stacked Buff tiers I–IV)
 * - bane:      adds this much to every affliction your cards lay (Hex,
 *              Poison, Burn, Frost, Bleed, Shock; see BANE_AFFLICTIONS)
 * - sharpshooter: lasts N turns (-1 each turn end); +50% hit chance on every shot, and Range
 *   hits deal SHARPSHOOTER_DAMAGE_FACTOR times as much
 * - berserker: on or off; every Melee card has Rampage (BUFF_KEYWORDS)
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
  | 'berserker'
  | 'bane'
  | 'reflex'
  | 'invincible'
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
  /** Remaining player turns on which Buff cards are locked. */
  | 'malaise'
  /** Turns during which an attack can hit only once. */
  | 'hitLimit'
  /** Keeps Guard from expiring, one turn per stack. */
  | 'brace'
  | 'aloft'
  /** Remaining opposing turns during which this unit cannot be targeted directly. */
  | 'cloak'
  /** Rush: the next this-many movements this turn cost 0. */
  | 'move'
  | 'rush'
  | 'armor'
  /** Pin: this unit can't move (Charge, Back Step, Pull, Knockback, march) for this many of its turns. */
  | 'pin'
  /** Fatigue: at the villain's turn start, this many random cards in hand cost 1 more this turn. */
  | 'fatigue'
  /** Fatigue ALL: at the villain's turn start, every card (of fatigueAllType, if set) costs this much more this turn. */
  | 'fatigueAll'
  /** Scramble N, for N of its turns: an enemy makes a random move; the villain auto-plays a random card at turn start. */
  | 'scramble'
  | BuffId;
export type Statuses = Record<StatusId, number>;
/**
 * A boss's built-in trait: always on, never stacks or fades.
 * vigor      acts twice every heroes' turn
 * anchored   resists forced movement (the Ballista)
 * longRange  its shots ignore Out of Range (see OUT_OF_RANGE_HIT_CHANCE)
 */
export type PassiveId = 'vigor' | 'longRange' | 'anchored';

/** Anything with HP that fights: the villain or a hero. */
export type Combatant = {
  borrowedStats?: import('./borrowedPowers.ts').BorrowedStats;
  traits?: Traits;
  traitNodes?: TraitNodes;
  /** The villain's skill tree ranks (see skills.ts SKILL_EFFECTS). */
  skillPicks?: readonly SkillPick[];
  equipment?: Equipment;
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
  /** HP Bleed has cost in the fight, for the bleed number on a hit. */
  bleedTaken?: number;
  /** Cumulative HP damage from Hex, even when the stacks do not drop. */
  hexDamageTaken?: number;
  /** Cumulative HP lost to Burn applications and later ticks. */
  burnDamageTaken?: number;
  /** Cumulative HP lost to Poison ticks. */
  poisonDamageTaken?: number;
  /** Legacy hit count from saves written before Shock burst on the next hit. */
  shockHits?: number;
  /**
   * Times Shock has gone off this fight. The view watches this to show a
   * burst: Shock can also reach 0 by fading, which is not a burst.
   */
  shockBursts?: number;
  shockDamageTaken?: number;
  /** True when Protection was cast this turn (else it lapses at turn end). */
  protectionCast?: boolean;
  /** Opposing turns remaining for timed Protection. */
  cardProtectionTurns?: number;
  /** The only card type Fatigue ALL raises (none: every card). */
  fatigueAllType?: CardType | undefined;
  /** Full duration this Protection was applied with, including any trait extension. */
  cardProtectionDuration?: number;
  /** Enemy turns remaining for Instinct. */
  instinctTurns?: number;
  /** Enemy turns remaining for Enfeeble. */
  enfeebleTurns?: number;
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
  | { kind: 'move'; amount: number }
  | { kind: 'rush'; amount: number }
  /** Move as if using the battlefield button, or gain Momentum. */
  | { kind: 'charge' | 'backStep' | 'momentum' }
  /** Armor N: each physical (Melee, Range) hit on you is N lower. */
  | { kind: 'armor'; amount: number }
  /** Hide the player from direct targeting until this duration or their next attack. */
  | { kind: 'cloak'; amount: number }
  | { kind: 'poison'; amount: number; target: CardTarget }
  | { kind: 'burn'; amount: number; target: CardTarget }
  | { kind: 'frost'; amount: number; target: CardTarget }
  | { kind: 'shock'; amount: number; target: CardTarget }
  | { kind: 'bleed'; amount: number; target: CardTarget }
  | { kind: 'weaken'; amount: number; target: CardTarget }
  /** Locks the target's buffs for this many turns. */
  | { kind: 'malaise'; amount: number; target: CardTarget }
  /** Pin N: the target can't move for N of its turns. */
  | { kind: 'pin'; amount: number; target: CardTarget }
  /** Scramble N: the hero's next move becomes a random one, for N turns. */
  | { kind: 'scramble'; amount: number; target: CardTarget }
  /** Enfeebles the target: one tier up when reapplied turn after turn. */
  /** Enfeeble ×N: cast `times` times (default 1), a tier each, to IV. */
  | { kind: 'enfeeble'; target: CardTarget; times?: number }
  /** Deals damage equal to the target's hex times `multiplier`. */
  | { kind: 'reap'; multiplier: number }
  | { kind: 'guard'; amount: number }
  /** Grants the villain Brace: its Guard lasts this many turns longer. */
  | { kind: 'brace'; amount: number }
  | { kind: 'wrath'; amount: number }
  /** Removes 1 random affliction from the villain (see STATUS_IS_AFFLICTION). */
  | { kind: 'cleanse' }
  /** Strips this many distinct random buffs from each target. */
  | { kind: 'dispel'; amount: number; target: CardTarget }
  /** Removes this many stacks or tiers from one random active status. */
  | {
      kind: 'disrupt';
      amount: number;
      target: CardTarget;
      allAfflictions?: boolean;
      hitLimitTurns?: number;
    }
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
  | { kind: 'push'; rows: number; target?: 'all' }
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
  | 'charge'
  | 'hold'
  | 'piercing'
  | 'remove'
  | 'exhaust'
  | 'rampage'
  | 'distance'
  | 'longRange'
  | 'unique';
/**
 * Effects an imbue may grant. Pull and Push are left out: they change
 * who a card may aim at, and an imbue never changes a card's aim.
 */
export type ImbuableEffect = Exclude<
  BaseCardEffect,
  { kind: 'pull' | 'push' | 'amplify' | 'charge' | 'backStep' | 'momentum' }
>;
/** What an imbue grants a card: a keyword, or one more effect. */
export type ImbueGift =
  | { kind: 'keyword'; keyword: CardKeyword }
  | { kind: 'effect'; effect: ImbuableEffect };
/** A gift on one card. It stays with that card for the rest of the battle. */
export type Imbue = { gift: ImbueGift };
/** Run deck positions distinguish otherwise identical copies through every pile. */
export type CopyImbues = Partial<Record<number, Imbue[]>>;
export type BattleCardCopies = { hand: number[]; draw: number[]; discard: number[]; destroyed: number[]; gifts: CopyImbues };

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
 * Utility cards generally grant energy, restore HP, or draw cards. Some are consumables.
 */
export type CardType =
  | 'melee'
  | 'range'
  | 'magic'
  | 'defend'
  | 'buff'
  | 'imbue'
  | 'curse'
  | 'utility'
  | 'movement';

/** Acquisition category, independent of how the card plays. */
export type CardPool = 'player' | 'neutral' | 'unit';

export type CardDef = {
  costReductionPerKill?: number;
  requiredKillsInOneHit?: number;
  name: string;
  type: CardType;
  pool: CardPool;
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
   * Retired cards stay defined (old saves and decks still load) but leave
   * the pool: no rewards, test decks or deck editor.
   */
  retired?: boolean;
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
/** The afflictions a hero attack can lay on every hit that lands. */
export type HeroHitAffliction =
  'hex' | 'poison' | 'burn' | 'frost' | 'bleed' | 'shock' | 'weaken';

/** One affliction an attack lays on each hit that lands. */
export type HeroHitProc = { status: HeroHitAffliction; amount: number };

export type HeroEffect =
  | {
      kind: 'attack';
      amount: number;
      hits: number;
      type: HeroAttackType;
      /** Homing: its hits can't be dodged (they skip Instinct). */
      isHoming?: boolean;
      /** Farthest lane this attack reaches, including the front lane. */
      maxRange?: 1 | 2 | 3;
      /**
       * Afflictions laid on the villain by every hit that lands. A move's
       * own affliction effects join these (see foldPerHitAfflictions).
       */
      perHit?: readonly HeroHitProc[];
    }
  | { kind: 'hex'; amount: number }
  | { kind: 'poison'; amount: number }
  | { kind: 'burn'; amount: number }
  | { kind: 'frost'; amount: number }
  | { kind: 'shock'; amount: number }
  | { kind: 'bleed'; amount: number }
  | { kind: 'weaken'; amount: number }
  /** Locks the villain's Buff cards for this many turns. */
  | { kind: 'malaise'; amount: number }
  /** Pin N on the villain: no Charge, Back Step or forced movement for N turns. */
  | { kind: 'pin'; amount: number }
  /** Scramble N on the villain: a random playable card auto-plays at its turn start, for N turns. */
  | { kind: 'scramble'; amount: number }
  /**
   * Fatigue N on the villain: N random cards in its next hand cost 1
   * more. With `all`, every card in that hand costs N more instead
   * (only cards of `cardType` when given: "Fatigue 1 ALL Movement").
   */
  | { kind: 'fatigue'; amount: number; all?: true; cardType?: CardType }
  | { kind: 'guard'; amount: number; who: 'self' | 'allies' }
  /** Hide the acting hero from direct targeting until this duration or their next attack. */
  | { kind: 'cloak'; amount: number }
  | { kind: 'wrath'; amount: number; who: 'self' | 'allies' }
  | { kind: 'heal'; amount: number; who: 'self' | 'allies' }
  /** Casts Protection (a tier up); untimed casts expire at the start of the next hero turn. */
  | { kind: 'protect'; who: 'self' | 'allies'; turns?: number }
  | { kind: 'dispel'; amount: number }
  | { kind: 'disrupt'; amount: number }
  /** Removes 1 random affliction from itself, or from each ally. */
  | { kind: 'cleanse'; who: 'self' | 'allies' }
  /**
   * Calls `count` more of a hero onto the field, into open columns of
   * the summoner's own row, nearest first. Bound to the summoner: they
   * fall when it falls.
   */
  | { kind: 'summon'; heroId: HeroId; count: number; onceAt?: { row: 'back'; col: number } }
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
  | { kind: 'knockBack' | 'pullPlayer' | 'advanceSelf'; lines: number }
  /** Sets off the villain's Shock now, however many hits it has taken. */
  | { kind: 'detonate' };

/**
 * Heroes that only ever join a fight by being summoned. Named here, not
 * derived from the catalog, because the catalog's own moves use it
 * (each one must still be a HeroId: getHero checks that).
 */
export type SummonId = 'angelArcher';

export type HeroMove = {
  element?: MagicElement;
  name: string;
  effects: readonly HeroEffect[];
  /** The hero's signature move: it plays its own special animation. */
  isSignature?: boolean;
  /** Cosmetic: a two-handed swipe (claws cross; see GriffonFigure). */
  isTwoHanded?: boolean;
  visual?: 'cervielBladeVolley';
};

export type HeroTier = 'grunt' | 'elite' | 'officer' | 'boss' | 'summon';
/** What kind of being a hero is (Illusion Training groups scenarios by it). */
export type UnitType = 'angel' | 'dragon' | 'beast' | 'human' | 'demiHuman' | 'sin';

// --- BATTLEFIELD ---
/**
 * The heroes stand on a grid 3 columns wide and 3 rows deep (see
 * BATTLEFIELD_ROWS): the Front line, the Backline and the Horizon.
 * Fighters take the front; healers, buffers and archers the Backline.
 * The Horizon is where a new horde marches in from, and Out of Range.
 */
export type HeroRow = 'front' | 'back' | 'horizon';
/** How many columns a hero fills: grunts 1, elites 2, champions 3. */
export type HeroSize = 1 | 1.5 | 2 | 3;
export type HeroDef = {
  name: string;
  tier: HeroTier;
  maxHp: number;
  /** Moves repeat in order, so players can read and plan around them. */
  moves: readonly HeroMove[];
  secondPhase?: {
    restoreHpFraction: number;
    triggerHpFraction?: number;
    row?: HeroRow;
    moves: readonly HeroMove[];
    visual: 'cervielBladeVolley' | 'mikhaelSpear';
  };
  /** A narrative defeat: do not drop a corpse or credit a kill. */
  survivesDefeat?: true;
  /** Portrait hue (0 to 360). Each hero gets its own heraldic colour. */
  hue: number;
  /** Preferred fighting row. After acting, the hero tries to return here. */
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
  /** Flat reduction of the next enemy turn's outgoing buffs and afflictions. */
  disruptedOutput?: number;
  uid: number;
  heroId: HeroId;
  moveIndex: number;
  phase?: 2;
  summonedOnceIds?: readonly HeroId[];
  onceSummoned?: true;
  /** Strength multiplier from how deep into the kingdom this fight is. */
  might: number;
  row: HeroRow;
  /** Leftmost battlefield column (0 to 2) this hero stands in. */
  col: number;
  /**
   * In one of its line's reserve spots: Knockback or Pull forced it into
   * a full line (see RESERVE_SPOTS_PER_LINE). It is in that line for
   * reach and targeting, but blocks no seat; it leaves on its next move.
   */
  inReserve?: boolean;
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

/** A committed player play, with the cost and card upgrades at that moment. */
export type CardPlayRecord = { turn: number; cost: number } & (
  | { cardId: CardId; imbues?: readonly Imbue[]; usesSpent?: number }
  | { move: MovementId }
);

export type EnemyAttackRecord = {
  heroId: HeroId;
  turn: number;
  attackName: string;
  attackType: HeroAttackType;
  hpLost: number;
  guardLost: number;
};

export type CombatHistoryRecord =
  | CardPlayRecord
  | EnemyAttackRecord
  | {
      turn: number;
      event: 'death' | 'heal' | 'guard' | 'status' | 'arrival' | 'dodge';
      subject: string;
      detail: string;
      status?: StatusId;
    };

export type CombatState = {
  borrowedPowers?: readonly import('./borrowedPowers.ts').BorrowedPower[];
  /** Replacement wave spends its first enemy phase entering the battlefield. */
  waveArrival?: boolean;
  playHistory?: readonly CombatHistoryRecord[];
  player: Combatant;
  heroes: HeroUnit[];
  energy: number;
  /** Unspent energy carried over from last turn. */
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
  /** Extra energy each hand slot costs this turn (Fatigue); slot for slot with hand. */
  handFatigue?: number[];
  /** Extra energy Charge and Back Step cost this turn (Fatigue ALL on Movement). */
  movementFatigue?: number;
  /** The card Scramble auto-played at the start of this turn (the view shows a scramble first). */
  scrambledPlay?: { cardId: CardId; turn: number };
  /**
   * Battle imbues of cards that left the hand for the piles. Copies of a
   * card can't be told apart there, so the next copy drawn takes them.
   */
  stowedImbues: StowedImbue[];
  copies?: BattleCardCopies;
  /** Buffs that wear off after the next card or at the end of the turn. */
  timedBuffs: TimedBuff[];
  turn: number;
  /** Heroes defeated so far in this fight. */
  slain: number;
  killsThisTurn?: number;
  rng: RngState;
  /** Net rows the villain has travelled toward the enemy since combat began. */
  travelRows?: number;
  forcedMovement?: { count: number; move: MovementId; distance: number };
  followUpReady?: boolean;
  mostKillsInOneHit?: number;
  /** The last movement-button use (its streak raises the next button's cost). */
  lastMovement: MovementRecord | null;
  /**
   * The last move from a card effect or keyword: a fresh object each time
   * for speed lines, with no separate button cost or streak increase.
   */
  freeMove: { move: MovementId } | null;
  /** The uid the next hero to join (a summon) gets; never reused. */
  nextUid: number;
  /** Heroes fallen this fight, as they fell (a revive brings them back). */
  fallen: HeroUnit[];
};

export type CombatOutcome = 'ongoing' | 'won' | 'lost';
