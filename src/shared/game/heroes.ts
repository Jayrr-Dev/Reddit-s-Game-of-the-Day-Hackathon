// ===================================================================
// HERO CATALOG
// The heroes who stand between the villain and the throne. Grunts make
// up the hordes, elites are optional harder fights, and each region of
// the kingdom is guarded by one champion. Moves cycle in order so the
// player can always read what is coming next.
// ===================================================================

import type {
  HeroAttackType,
  HeroDef,
  HeroEffect,
  HeroMove,
  HeroRow,
  HeroSize,
  HeroTier,
  PassiveId,
  SummonId,
} from './types.ts';

// --- EFFECT BUILDERS ---
type HeroAttack = Extract<HeroEffect, { kind: 'attack' }>;
/** Builds an attack of one type (see HeroAttackType for the reach rules). */
const attackOf =
  (type: HeroAttackType) =>
  (amount: number, hits = 1): HeroAttack => ({
    kind: 'attack',
    amount,
    hits,
    type,
  });
/** Homing: the attack's hits can't be dodged (Instinct). */
const homing = (effect: HeroAttack): HeroAttack => ({
  ...effect,
  isHoming: true,
});
/** A Melee attack: only from the front row. */
const strike = attackOf('melee');
/** A Range attack: +30% from the back row, plain (still Range) up close. */
const shoot = attackOf('range');
/** A Magic attack: the same from either row. */
const spell = attackOf('magic');
const hex = (amount: number): HeroEffect => ({ kind: 'hex', amount });
const poison = (amount: number): HeroEffect => ({ kind: 'poison', amount });
const burn = (amount: number): HeroEffect => ({ kind: 'burn', amount });
const weaken = (amount: number): HeroEffect => ({ kind: 'weaken', amount });
const bleed = (amount: number): HeroEffect => ({ kind: 'bleed', amount });
const guard = (
  amount: number,
  who: 'self' | 'allies' = 'self'
): HeroEffect => ({
  kind: 'guard',
  amount,
  who,
});
const wrath = (
  amount: number,
  who: 'self' | 'allies' = 'self'
): HeroEffect => ({
  kind: 'wrath',
  amount,
  who,
});
const heal = (
  amount: number,
  who: 'self' | 'allies' = 'allies'
): HeroEffect => ({
  kind: 'heal',
  amount,
  who,
});

const cleanse = (who: 'self' | 'allies' = 'allies'): HeroEffect => ({
  kind: 'cleanse',
  who,
});

/** Marks a move as the hero's signature (it gets its own animation). */
const signature = (heroMove: HeroMove): HeroMove => ({
  ...heroMove,
  isSignature: true,
});

/** Brings every fallen ally back at full HP. */
const revive = (): HeroEffect => ({ kind: 'revive' });

/** Calls `count` of a hero onto the field beside the summoner. */
const summon = (heroId: SummonId, count: number): HeroEffect => ({
  kind: 'summon',
  heroId,
  count,
});

/** Knocks the villain back `lines` lines (the heroes end up farther). */
const knockBack = (lines: number): HeroEffect => ({ kind: 'knockBack', lines });

/** Flies up out of reach; the next move dives back down. */
const soar = (): HeroEffect => ({ kind: 'soar' });

/** Builds a named move. */
const move = (name: string, ...effects: HeroEffect[]): HeroMove => ({
  name,
  effects,
});

/** Where a hero stands: its starting row and how many columns it fills. */
type Placement = {
  row: HeroRow;
  size: HeroSize;
  backCols?: readonly number[];
};

// --- PLACEMENTS ---
// Fighters hold the front; support and ranged heroes keep to the back.
const FRONT: Placement = { row: 'front', size: 1 };
const BACK: Placement = { row: 'back', size: 1 };
const WIDE_FRONT: Placement = { row: 'front', size: 2 };
const WIDE_BACK: Placement = { row: 'back', size: 2 };
/** A champion: two columns of the front row, leaving one open. */
const CHAMPION: Placement = WIDE_FRONT;
/**
 * A boss in a T: the whole front row plus the back row's centre,
 * leaving the back flanks for the heroes it summons.
 */
const BOSS_T: Placement = { row: 'front', size: 3, backCols: [1] };
/** A boss down the centre column: the front and back centre slots. */
const BOSS_COLUMN: Placement = { row: 'front', size: 1, backCols: [0] };

/**
 * Builds a hero definition. Speed sets the turn order (higher acts
 * first): nimble rogues and archers strike before armoured fighters.
 */
const hero = (
  name: string,
  tier: HeroTier,
  maxHp: number,
  hue: number,
  speed: number,
  placement: Placement,
  moves: HeroMove[],
  passives?: readonly PassiveId[]
): HeroDef => ({
  name,
  tier,
  maxHp,
  hue,
  speed,
  moves,
  ...placement,
  ...(passives === undefined ? {} : { passives }),
});

/** Gives a hero Armor N for every fight (see the Armor status). */
const armored = (def: HeroDef, armor: number): HeroDef => ({ ...def, armor });

// --- CATALOG ---
export const HEROES = {
  // GRUNTS (THE HORDE)
  squire: hero('Squire', 'grunt', 14, 210, 4, FRONT, [
    move('Swing', strike(5)),
    move('Raise Shield', guard(4), strike(3)),
  ]),
  bard: hero('Bard', 'grunt', 11, 300, 6, BACK, [
    move('Rousing Ballad', wrath(1, 'allies')),
    move('Mocking Verse', weaken(1), spell(2)),
  ]),
  archer: hero('Archer', 'grunt', 10, 110, 7, BACK, [
    move('Volley', shoot(2, 3)),
    move('Aimed Shot', shoot(7)),
  ]),
  priest: hero('Priest', 'grunt', 12, 50, 5, BACK, [
    move('Smite', spell(4)),
    move('Mend', heal(5), cleanse()),
  ]),
  shieldmaiden: hero('Shieldmaiden', 'grunt', 18, 190, 3, FRONT, [
    move('Brace', guard(7)),
    move('Shield Bash', strike(6)),
  ]),
  rogue: hero('Rogue', 'grunt', 12, 140, 9, BACK, [
    move('Poisoned Dart', poison(2), shoot(3)),
    move('Throwing Knives', shoot(3, 2)),
  ]),

  // SUMMONS (ONLY EVER CALLED ONTO THE FIELD BY ANOTHER HERO)
  /**
   * A Biblical Angel: an eye ringed by feathered wings. It looses arrows
   * of light, and every third move bathes every ally in Healing Light
   * (its summoner, Holy Dragon Unc, most of all needs it).
   */
  angelArcher: hero('Biblical Angel', 'grunt', 14, 50, 7, BACK, [
    move('Light Arrow', shoot(5)),
    move('Healing Light', heal(6)),
    move('Volley of Light', shoot(2, 3)),
  ]),

  // ELITES
  paladin: hero('Paladin', 'elite', 40, 45, 4, WIDE_FRONT, [
    move('Holy Shield', guard(10), strike(5)),
    move('Judgment', strike(13)),
    move('Consecrate', wrath(2)),
  ]),
  archmage: hero('Archmage', 'elite', 32, 260, 6, WIDE_BACK, [
    move('Arcane Bolts', homing(spell(4, 3))),
    move('Curse of Light', hex(4), weaken(1)),
    move('Mana Shield', guard(12)),
  ]),

  // A siege engine: one cell (drawn 1.5 wide, see CreatureFigure), Anchored where it stands (it never
  // moves and nothing moves it), and its bolts never fall short
  // (Longrange: it hits from Line 3 too).
  ballista: hero(
    'Ballista',
    'elite',
    100,
    30,
    2,
    BACK,
    [
      move('Heavy Bolt', shoot(9), knockBack(1)),
      move('Arrow Volley', shoot(4, 3)),
      move('Fire Bolt', shoot(7), burn(4)),
      move('Winch Back', guard(6)),
      move('Barbed Bolt', shoot(7), bleed(4)),
      signature(move('Siege Bolt', shoot(16), knockBack(2))),
    ],
    ['longRange', 'anchored']
  ),

  // CHAMPIONS (ONE PER REGION, IN REGION ORDER)
  holt: hero('Sergeant Holt', 'champion', 50, 20, 5, CHAMPION, [
    move('Rally', wrath(1), guard(6)),
    move('Halberd Sweep', strike(10)),
    move('Twin Thrust', strike(6, 2)),
  ]),
  lysa: hero('Ranger Lysa', 'champion', 46, 120, 8, CHAMPION, [
    move('Hail of Arrows', shoot(3, 4)),
    move('Snare', weaken(2), guard(6)),
    move('Piercing Shot', shoot(12)),
  ]),
  maren: hero('High Priestess Maren', 'champion', 55, 55, 4, CHAMPION, [
    move('Sanctuary', guard(10), heal(6, 'self')),
    move('Holy Fire', burn(5)),
    move('Smite the Wicked', spell(11)),
  ]),
  // The knight: Armor 3 blunts every Melee and Range blow.
  brannoc: armored(
    hero('Sir Brannoc', 'champion', 70, 220, 3, CHAMPION, [
      move('Iron Wall', guard(15)),
      move('Gatebreaker', strike(18)),
      move('Hammer Blows', strike(8, 2)),
    ]),
    3
  ),
  seris: hero("Seris, the Queen's Blade", 'champion', 58, 330, 9, CHAMPION, [
    move('Dance of Blades', strike(4, 4)),
    move('Feint', weaken(2), guard(8)),
    move('Execution', strike(20)),
  ]),
  valen: hero('Valen the Radiant', 'champion', 90, 48, 6, CHAMPION, [
    move('Radiance', wrath(2), guard(12)),
    move('Lightbringer', spell(9, 2)),
    move('Brand of Light', hex(6)),
    move('Final Verdict', strike(25)),
  ]),

  // BOSSES (TARGET DUMMY SCENARIOS ONLY UNTIL THEY JOIN A REGION)
  /**
   * A great ivory dragon boss in a T: the whole front row and the back
   * row's centre. Its Vigor (a boss passive) gives it
   * two moves a turn: it opens by calling two Biblical Angels to its
   * flanks (and calls more whenever a flank is empty when the call
   * comes round again), then breathes holy fire, shields itself, brings
   * down its signature Halo of Judgment (which also raises every fallen
   * ally) and roars itself into a Wrath.
   */
  holyDragon: hero(
    'Holy Dragon Unc',
    'boss',
    500,
    280,
    5,
    BOSS_T,
    [
      move('Call the Host', summon('angelArcher', 2)),
      move('Holy Breath', spell(8, 2)),
      move('Sanctuary Wings', guard(20)),
      signature(move('Halo of Judgment', revive(), spell(26))),
      move('Radiant Roar', wrath(2)),
    ],
    ['vigor']
  ),
  /**
   * A haloed griffon boss down the centre column, flanked by open
   * slots. One move a turn (only the dragon has Vigor), and it loves
   * its Triple Slice. Its signature Heavenly Drive takes two turns (both
   * signature moves): it flies up out of reach (Aloft), then the next
   * turn dives down with one crushing blow.
   */
  grandGriffon: hero('Grand Griffon Rio', 'boss', 420, 275, 8, BOSS_COLUMN, [
    move('Triple Slice', strike(6, 3)),
    signature(move('Heavenly Drive', soar())),
    signature(move('Heavenly Dive', strike(34))),
    move('Triple Slice', strike(6, 3)),
    move('Gale Wings', guard(18)),
    move('Proud Cry', wrath(2)),
  ]),
} as const satisfies Record<string, HeroDef>;

// --- DERIVED DATA ---
export type HeroId = keyof typeof HEROES;

/** Looks up a hero definition. */
export const getHero = (id: HeroId): HeroDef => HEROES[id];

export const GRUNT_IDS: readonly HeroId[] = [
  'squire',
  'bard',
  'archer',
  'priest',
  'shieldmaiden',
  'rogue',
];

export const ELITE_IDS: readonly HeroId[] = ['paladin', 'archmage', 'ballista'];

/** Champion of each region, in the order the villain conquers them. */
export const CHAMPION_IDS: readonly HeroId[] = [
  'holt',
  'lysa',
  'maren',
  'brannoc',
  'seris',
  'valen',
];
