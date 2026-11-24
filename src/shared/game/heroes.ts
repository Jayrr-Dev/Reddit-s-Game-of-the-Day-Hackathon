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
} from './types.ts';

// --- EFFECT BUILDERS ---
/** Builds an attack of one type (see HeroAttackType for the reach rules). */
const attackOf =
  (type: HeroAttackType) =>
  (amount: number, hits = 1): HeroEffect => ({
    kind: 'attack',
    amount,
    hits,
    type,
  });
/** A Melee attack: only from the front row. */
const strike = attackOf('melee');
/** A Range attack: +30% from the back row, plain Melee up close. */
const shoot = attackOf('range');
/** A Magic attack: the same from either row. */
const spell = attackOf('magic');
const hex = (amount: number): HeroEffect => ({ kind: 'hex', amount });
const dread = (amount: number): HeroEffect => ({ kind: 'dread', amount });
const shroud = (
  amount: number,
  who: 'self' | 'allies' = 'self'
): HeroEffect => ({
  kind: 'shroud',
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

/** Builds a named move. */
const move = (name: string, ...effects: HeroEffect[]): HeroMove => ({
  name,
  effects,
});

/** Where a hero stands: its starting row and how many columns it fills. */
type Placement = { row: HeroRow; size: HeroSize };

// --- PLACEMENTS ---
// Fighters hold the front; support and ranged heroes keep to the back.
const FRONT: Placement = { row: 'front', size: 1 };
const BACK: Placement = { row: 'back', size: 1 };
const WIDE_FRONT: Placement = { row: 'front', size: 2 };
const WIDE_BACK: Placement = { row: 'back', size: 2 };
/** A champion fills the whole front row on its own. */
const HUGE: Placement = { row: 'front', size: 3 };

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
  moves: HeroMove[]
): HeroDef => ({ name, tier, maxHp, hue, speed, moves, ...placement });

// --- CATALOG ---
export const HEROES = {
  // GRUNTS (THE HORDE)
  squire: hero('Squire', 'grunt', 14, 210, 4, FRONT, [
    move('Swing', strike(5)),
    move('Raise Shield', shroud(4), strike(3)),
  ]),
  bard: hero('Bard', 'grunt', 11, 300, 6, BACK, [
    move('Rousing Ballad', wrath(1, 'allies')),
    move('Mocking Verse', dread(1), spell(2)),
  ]),
  archer: hero('Archer', 'grunt', 10, 110, 7, BACK, [
    move('Volley', shoot(2, 3)),
    move('Aimed Shot', shoot(7)),
  ]),
  priest: hero('Priest', 'grunt', 12, 50, 5, BACK, [
    move('Smite', spell(4)),
    move('Mend', heal(5)),
  ]),
  shieldmaiden: hero('Shieldmaiden', 'grunt', 18, 190, 3, FRONT, [
    move('Brace', shroud(7)),
    move('Shield Bash', strike(6)),
  ]),
  rogue: hero('Rogue', 'grunt', 12, 140, 9, BACK, [
    move('Poisoned Dart', hex(2), shoot(3)),
    move('Throwing Knives', shoot(3, 2)),
  ]),

  // ELITES
  paladin: hero('Paladin', 'elite', 40, 45, 4, WIDE_FRONT, [
    move('Holy Shield', shroud(10), strike(5)),
    move('Judgment', strike(13)),
    move('Consecrate', wrath(2)),
  ]),
  archmage: hero('Archmage', 'elite', 32, 260, 6, WIDE_BACK, [
    move('Arcane Bolts', spell(4, 3)),
    move('Curse of Light', hex(4), dread(1)),
    move('Mana Shield', shroud(12)),
  ]),

  // CHAMPIONS (ONE PER REGION, IN REGION ORDER)
  holt: hero('Sergeant Holt', 'champion', 50, 20, 5, HUGE, [
    move('Rally', wrath(1), shroud(6)),
    move('Halberd Sweep', strike(10)),
    move('Twin Thrust', strike(6, 2)),
  ]),
  lysa: hero('Ranger Lysa', 'champion', 46, 120, 8, HUGE, [
    move('Hail of Arrows', shoot(3, 4)),
    move('Snare', dread(2), shroud(6)),
    move('Piercing Shot', shoot(12)),
  ]),
  maren: hero('High Priestess Maren', 'champion', 55, 55, 4, HUGE, [
    move('Sanctuary', shroud(10), heal(6, 'self')),
    move('Holy Fire', hex(5)),
    move('Smite the Wicked', spell(11)),
  ]),
  brannoc: hero('Sir Brannoc', 'champion', 70, 220, 3, HUGE, [
    move('Iron Wall', shroud(15)),
    move('Gatebreaker', strike(18)),
    move('Hammer Blows', strike(8, 2)),
  ]),
  seris: hero("Seris, the Queen's Blade", 'champion', 58, 330, 9, HUGE, [
    move('Dance of Blades', strike(4, 4)),
    move('Feint', dread(2), shroud(8)),
    move('Execution', strike(20)),
  ]),
  valen: hero('Valen the Radiant', 'champion', 90, 48, 6, HUGE, [
    move('Radiance', wrath(2), shroud(12)),
    move('Lightbringer', spell(9, 2)),
    move('Brand of Light', hex(6)),
    move('Final Verdict', strike(25)),
  ]),

  // TEST CREATURES (SANDBOX ONLY UNTIL THEY JOIN A REGION)
  /**
   * A great ivory dragon that fills the whole front row: it shields
   * the horde, breathes holy fire on you, and rouses everyone's Wrath.
   */
  holyDragon: hero('Holy Dragon', 'champion', 70, 280, 5, HUGE, [
    move('Sanctuary Wings', shroud(8, 'allies')),
    move('Holy Breath', spell(7, 2)),
    move('Rending Claws', strike(16)),
    move('Radiant Roar', wrath(2, 'allies')),
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

export const ELITE_IDS: readonly HeroId[] = ['paladin', 'archmage'];

/** Champion of each region, in the order the villain conquers them. */
export const CHAMPION_IDS: readonly HeroId[] = [
  'holt',
  'lysa',
  'maren',
  'brannoc',
  'seris',
  'valen',
];

/**
 * New units being tried out: they turn up only as target dummies (and
 * in the practice menu's scenarios) until they join a run.
 */
export const TEST_CREATURE_IDS: readonly HeroId[] = ['holyDragon'];
