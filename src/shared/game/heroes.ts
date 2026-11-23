// ===================================================================
// HERO CATALOG
// The heroes who stand between the villain and the throne. Grunts make
// up the hordes, elites are optional harder fights, and each region of
// the kingdom is guarded by one champion. Moves cycle in order so the
// player can always read what is coming next.
// ===================================================================

import type { HeroDef, HeroEffect, HeroMove, HeroTier } from './types.ts';

// --- EFFECT BUILDERS ---
const attack = (amount: number, hits = 1): HeroEffect => ({
  kind: 'attack',
  amount,
  hits,
});
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

/** Builds a hero definition. */
const hero = (
  name: string,
  tier: HeroTier,
  maxHp: number,
  hue: number,
  moves: HeroMove[]
): HeroDef => ({ name, tier, maxHp, hue, moves });

// --- CATALOG ---
export const HEROES = {
  // GRUNTS (THE HORDE)
  squire: hero('Squire', 'grunt', 14, 210, [
    move('Swing', attack(5)),
    move('Raise Shield', shroud(4), attack(3)),
  ]),
  bard: hero('Bard', 'grunt', 11, 300, [
    move('Rousing Ballad', wrath(1, 'allies')),
    move('Mocking Verse', dread(1), attack(2)),
  ]),
  archer: hero('Archer', 'grunt', 10, 110, [
    move('Volley', attack(2, 3)),
    move('Aimed Shot', attack(7)),
  ]),
  priest: hero('Priest', 'grunt', 12, 50, [
    move('Smite', attack(4)),
    move('Mend', heal(5)),
  ]),
  shieldmaiden: hero('Shieldmaiden', 'grunt', 18, 190, [
    move('Brace', shroud(7)),
    move('Shield Bash', attack(6)),
  ]),
  rogue: hero('Rogue', 'grunt', 12, 140, [
    move('Poisoned Blade', hex(2), attack(3)),
    move('Flurry', attack(3, 2)),
  ]),

  // ELITES
  paladin: hero('Paladin', 'elite', 40, 45, [
    move('Holy Shield', shroud(10), attack(5)),
    move('Judgment', attack(13)),
    move('Consecrate', wrath(2)),
  ]),
  archmage: hero('Archmage', 'elite', 32, 260, [
    move('Arcane Bolts', attack(4, 3)),
    move('Curse of Light', hex(4), dread(1)),
    move('Mana Shield', shroud(12)),
  ]),

  // CHAMPIONS (ONE PER REGION, IN REGION ORDER)
  holt: hero('Sergeant Holt', 'champion', 50, 20, [
    move('Rally', wrath(1), shroud(6)),
    move('Halberd Sweep', attack(10)),
    move('Twin Thrust', attack(6, 2)),
  ]),
  lysa: hero('Ranger Lysa', 'champion', 46, 120, [
    move('Hail of Arrows', attack(3, 4)),
    move('Snare', dread(2), shroud(6)),
    move('Piercing Shot', attack(12)),
  ]),
  maren: hero('High Priestess Maren', 'champion', 55, 55, [
    move('Sanctuary', shroud(10), heal(6, 'self')),
    move('Holy Fire', hex(5)),
    move('Smite the Wicked', attack(11)),
  ]),
  brannoc: hero('Sir Brannoc', 'champion', 70, 220, [
    move('Iron Wall', shroud(15)),
    move('Gatebreaker', attack(18)),
    move('Hammer Blows', attack(8, 2)),
  ]),
  seris: hero("Seris, the Queen's Blade", 'champion', 58, 330, [
    move('Dance of Blades', attack(4, 4)),
    move('Feint', dread(2), shroud(8)),
    move('Execution', attack(20)),
  ]),
  valen: hero('Valen the Radiant', 'champion', 90, 48, [
    move('Radiance', wrath(2), shroud(12)),
    move('Lightbringer', attack(9, 2)),
    move('Brand of Light', hex(6)),
    move('Final Verdict', attack(25)),
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
