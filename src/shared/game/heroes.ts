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
  HeroHitAffliction,
  HeroMove,
  HeroRow,
  HeroSize,
  HeroTier,
  PassiveId,
  SummonId,
  UnitType,
} from './types.ts';

import { cervielSecondPhase, cervielSummonMoves } from './heroPhases.ts';
import { applyUnitOverride, getUnitOverrides } from './unitOverrides.ts';

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
/** A Range attack: +25% from the back row, plain (still Range) up close. */
const shoot = attackOf('range');
/** A Magic attack: the same from either row. */
const spell = attackOf('magic');
const hex = (amount: number): HeroEffect => ({ kind: 'hex', amount });
const poison = (amount: number): HeroEffect => ({ kind: 'poison', amount });
const burn = (amount: number): HeroEffect => ({ kind: 'burn', amount });
const dispel = (amount = 1): HeroEffect => ({ kind: 'dispel', amount });
const weaken = (amount: number): HeroEffect => ({ kind: 'weaken', amount });
const bleed = (amount: number): HeroEffect => ({ kind: 'bleed', amount });
const shock = (amount: number): HeroEffect => ({ kind: 'shock', amount });
/** Pin N: the villain can't move for N turns. */
const pin = (amount: number): HeroEffect => ({ kind: 'pin', amount });
/** Fatigue N: N random cards in the villain's next hand cost 1 more. */
const fatigue = (amount: number): HeroEffect => ({ kind: 'fatigue', amount });
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

const protect = (who: 'self' | 'allies' = 'allies'): HeroEffect => ({
  kind: 'protect',
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
/** Sets off the villain's Shock at once (Smite). */
const detonate = (): HeroEffect => ({ kind: 'detonate' });

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
const WIDE_FRONT: Placement = { row: 'front', size: 1.5 };
const WIDE_BACK: Placement = { row: 'back', size: 1.5 };
/** A champion: half of the front row. */
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
    move('Smite', spell(4), fatigue(1)),
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
   * (its summoner, Holy Dragon Sol, most of all needs it).
   */
  angelArcher: hero('Biblical Angel', 'grunt', 14, 50, 7, BACK, [
    move('Light Arrow', shoot(1, 6)),
    move('Healing Light', heal(6)),
    // Purify: lifts an affliction off every hero (the dragon above all).
    move('Purify', cleanse()),
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
    move('Curse of Light', hex(4), weaken(1), dispel()),
    move('Mana Shield', guard(12)),
  ]),

  // A one-cell siege engine resists forced movement. Its bolts never fall short
  // (Longrange: it hits from Backline too).
  ballista: hero(
    'Ballista',
    'elite',
    100,
    30,
    2,
    { row: 'horizon', size: 1 },
    [
      move('Heavy Bolt', shoot(9), knockBack(1)),
      move('Arrow Volley', shoot(4, 3)),
      move('Fire Bolt', shoot(7), burn(4)),
      move('Winch Back', guard(6), { kind: 'pullPlayer', lines: 1 }),
      move('Barbed Bolt', shoot(7), bleed(4)),
      signature(move('Siege Bolt', shoot(16), knockBack(2))),
    ],
    ['longRange', 'anchored']
  ),

  // CHAMPIONS (ONE PER REGION, IN REGION ORDER)
  holt: hero('Sergeant Holt', 'champion', 50, 20, 5, CHAMPION, [
    move('Rally', wrath(1, 'allies'), guard(6)),
    move('Halberd Sweep', strike(10)),
    move('Twin Thrust', strike(6, 2)),
  ]),
  lysa: hero('Ranger Lysa', 'champion', 46, 120, 8, WIDE_BACK, [
    move('Hail of Arrows', shoot(3, 4)),
    move('Snare', weaken(2), guard(6)),
    move('Piercing Shot', shoot(12)),
  ]),
  maren: hero('High Priestess Maren', 'champion', 55, 55, 4, WIDE_BACK, [
    move('Sanctuary', guard(6, 'allies'), heal(6, 'self')),
    move('Holy Fire', burn(5), dispel()),
    move('Smite the Wicked', spell(11)),
  ]),
  // The knight: Armor 3 blunts every Melee and Range blow.
  brannoc: armored(
    hero('Sir Brannoc', 'champion', 70, 220, 3, CHAMPION, [
      move('Iron Wall', guard(15)),
      move('Gatebreaker', strike(18), pin(1)),
      move('Hammer Blows', strike(8, 2)),
    ]),
    3
  ),
  seris: hero("Seris, the Queen's Blade", 'champion', 58, 330, 9, CHAMPION, [
    move('Dance of Blades', strike(4, 4)),
    move('Feint', weaken(2), guard(8)),
    move('Execution', strike(20)),
  ]),
  valen: hero('Valen the Radiant', 'champion', 90, 48, 6, { row: 'horizon', size: 1.5 }, [
    move('Radiance', wrath(2), guard(12)),
    move('Lightbringer', spell(9, 2)),
    move('Brand of Light', hex(6)),
    move('Final Verdict', strike(25)),
  ]),

  // IVORY HOST (PRACTICE ROSTER; NOT PART OF THE RANKED ROUTE POOLS)
  /** An archer of the Angel Host (same order as the Angel Mage). */
  wingedArcher: hero('Angel Archer', 'grunt', 14, 290, 8, BACK, [
    move('Piercing Light', shoot(5), { kind: 'frost', amount: 2 }),
    move('Heaven\'s Tether', { kind: 'pullPlayer', lines: 1 }),
    move('Barbed Halo', shoot(4), bleed(2)),
  ]),
  swordPrelate: hero('Sword Prelate', 'elite', 34, 55, 5, BACK, [
    move('Absolution', cleanse(), guard(4, 'allies')),
    move('Oathbreaker', spell(6), dispel()),
    move('Penance', spell(8), hex(2)),
  ]),
  hornedSentinel: armored(
    hero('Horned Sentinel', 'elite', 43, 268, 3, WIDE_FRONT, [
      move('Plant the Hammer', guard(10)),
      move('Gate Slam', strike(11), knockBack(1)),
      move('Groundbreaker', strike(8), { kind: 'frost', amount: 2 }),
    ]),
    2
  ),
  stormLancer: hero('Storm Lancer', 'elite', 34, 47, 7, FRONT, [
    move('Conducting Thrust', strike(7), shock(3)),
    move('Forked Javelin', shoot(3, 2), shock(1)),
    move('Thunderclap', detonate()),
  ]),
  sevenEyedOracle: hero('Seven-Eyed Oracle', 'elite', 27, 278, 6, BACK, [
    move('Unravel', { kind: 'disrupt', amount: 2 }),
    move('Foreseen Wound', homing(spell(7)), hex(2)),
    move('Edict of Silence', { kind: 'malaise', amount: 1 }),
  ]),
  holyKing: hero('Holy King', 'boss', 165, 48, 5, BOSS_COLUMN, [
    move('Royal Aegis', guard(14), protect('self')),
    move('Crownfall', strike(18), knockBack(1)),
    move('King\'s Decree', { kind: 'malaise', amount: 1 }, guard(6)),
    move('Draw Near', { kind: 'pullPlayer', lines: 1 }, wrath(1)),
    move('Oath of Judgment', strike(16), dispel()),
  ]),

  ivoryWerewolf: hero('Ivory Werewolf', 'elite', 34, 268, 8, WIDE_FRONT, [
    move('Rend', strike(4, 2), bleed(2)),
    move('Blood Scent', wrath(2), guard(5)),
    move('Savage Bite', strike(10), bleed(3)),
  ]),
  wolfCentaur: hero('Wolf-Centaur', 'elite', 43, 260, 6, WIDE_FRONT, [
    move('Hunting Call', { kind: 'pullPlayer', lines: 1 }),
    move('Pounce', strike(12), weaken(1)),
    move('Pack Howl', wrath(1, 'allies')),
  ]),

  angelMage: hero('Angel Mage', 'grunt', 37, 55, 6, WIDE_BACK, [
    move('Borrowed Time', protect(), guard(5, 'allies')),
    { ...move('Stasis Pulse', spell(6), { kind: 'frost', amount: 3 }), element: 'ice' },
    move('Reverse Time', heal(10, 'self'), cleanse('self')),
    move('Clockhand Barrage', spell(4, 3)),
  ]),

  mageBorneAstra: hero('Mage Borne Astra', 'boss', 205, 50, 6, BACK, [
    move('Vow of Silence', guard(12), { kind: 'malaise', amount: 1 }),
    move('Astral Echo', homing(spell(6, 3))),
    move('Quiet Covenant', heal(10, 'self'), cleanse('self')),
    signature(move('The Last Word', homing(spell(16)), weaken(1))),
  ]),

  // Cerviel's three bodies are separate units so each can be targeted and defeated.
  grandangelCerviel: hero('Cerviel · Staff', 'elite', 55, 50, 6, BACK, [
    move('Staff of Accord', guard(10, 'allies'), protect()),
    move('Trinity Pulse', homing(spell(7, 2))),
    move('Seal of Concord', heal(8), cleanse()),
    signature(move('Covenant of Light', homing(spell(16)), dispel())),
  ]),
  cervielSword: { ...hero('Grandangel Cerviel', 'boss', 205, 50, 5, FRONT, [
    ...cervielSummonMoves('grandangelCerviel', 'cervielBow'),
    move('Twin Sabre Cuts', strike(6, 2)),
    move('Rending Oath', strike(10), bleed(2)),
    move('Distant Blade Arc', spell(8)),
  ]), secondPhase: cervielSecondPhase('grandangelCerviel', 'cervielBow') },
  cervielBow: hero('Cerviel • Bow', 'elite', 46, 50, 5, BACK, [
    move('Gilded Volley', shoot(4, 2)),
    move('Pinning Arrow', shoot(9), weaken(1)),
  ]),

  grandangelCambiel: hero('Grandangel Cambiel', 'boss', 230, 58, 6, FRONT, [
    move('Gilded Veil', guard(13), hex(3)),
    move('Crescent Cut', strike(10, 2)),
    move('Shadowbind', homing(spell(8)), weaken(1)),
    signature(move('Eclipse', homing(spell(16)), hex(5))),
  ]),

  archangelZeruel: hero('Archangel Zeruel', 'boss', 280, 64, 7, FRONT, [
    move('Halo of Resolve', guard(16), wrath(2)),
    move('Twin Halo Strike', strike(8, 2)),
    move('Violet Judgment', homing(spell(9, 2)), weaken(1)),
    signature(move('Sundering Halo', homing(spell(20)), dispel())),
  ]),

  zeruelRedSun: hero('Alpha', 'elite', 48, 4, 5, BACK, [
    { ...move('Crimson Flare', spell(5), burn(2)), element: 'fire' },
    move('Solar Prominence', guard(7, 'allies')),
  ]),
  zeruelBlueSun: hero('Omega', 'elite', 48, 212, 5, BACK, [
    move('Blue Radiance', spell(6)),
    move('Stellar Mantle', guard(7, 'allies')),
  ]),

  grandangelRaziel: hero('Grandangel Raziel', 'boss', 240, 53, 6, BACK, [
    move('Seal of Secrets', guard(14), protect('self')),
    move('Hidden Word', homing(spell(9, 2)), dispel()),
    move('Radiant Accord', guard(10), cleanse('self')),
    signature(move('Eightfold Revelation', homing(spell(3, 8)))),
  ]),

  grandangelGeonosis: hero('Grandangel Geonosis', 'boss', 245, 54, 6, BACK, [
    move('Glacial Mantle', guard(16), protect('self')),
    { ...move('Whitefall', homing(spell(7, 2))), element: 'ice' },
    move('Cold Silence', guard(10), weaken(2)),
    { ...signature(move('Absolute Winter', homing(spell(16)), dispel())), element: 'ice' },
  ]),

  zadkielOfDominations: hero('Grandangel Zadkiel', 'boss', 260, 56, 6, BACK, [
    move('Edict of Dominion', guard(16), protect('self')),
    move('Sovereign Gaze', homing(spell(8, 2)), weaken(1)),
    move('Mercy of the Host', heal(12, 'self'), cleanse('self')),
    signature(move('Final Edict', homing(spell(18)), dispel())),
  ]),

  fulgurDragonknight: hero('Fulgur Dragonknight', 'boss', 305, 66, 7, FRONT, [
    move('Gather the Storm', guard(14), shock(4)),
    move('Thunderclaw', strike(12), knockBack(1)),
    move('Forked Lightning', homing(spell(7, 3)), shock(2)),
    signature(move('Skybreaker', homing(spell(18)), detonate())),
  ]),

  grandangelCherubiel: hero('Grandangel Cherubiel', 'boss', 245, 52, 6, BACK, [
    move('Shattered Halo', guard(14), shock(3)),
    move('Seraphic Volley', spell(6, 3)),
    move('Sacred Aegis', guard(16), protect('self')),
    signature(move('Judgment of the Halo', homing(spell(14)), detonate())),
  ]),

  // THE SEVEN SINS
  greed: hero('Greed', 'boss', 220, 40, 5, BACK, [
    move('Hoard', guard(14)),
    move('Gilded Bolt', spell(9, 2)),
    move('Take What’s Yours', spell(12), dispel()),
    signature(move('Golden Tribute', spell(21), guard(8))),
  ]),

  envy: hero('Envy', 'boss', 195, 125, 4, FRONT, [
    move('Venom Spit', spell(6), poison(3)),
    move('Goo Lash', strike(13), weaken(2)),
    move('Reform', heal(12, 'self')),
    signature(move('Viridian Flood', spell(14), poison(5))),
  ]),

  sloth: armored(hero('Sloth', 'boss', 245, 25, 2, FRONT, [
    move('Basalt Layer', guard(20)),
    move('Heavy Drag', strike(12), weaken(1)),
    move('Stone Sleep', guard(12), protect('self')),
    signature(move('Mountain Breaker', strike(20), knockBack(1))),
  ]), 1),

  pride: hero('Pride', 'boss', 225, 310, 8, FRONT, [
    move('Royal Challenge', wrath(3)),
    move('Sovereign’s Cut', strike(12), bleed(2)),
    move('Imperious Guard', guard(12)),
    signature(move('Sovereign’s Verdict', strike(10, 2))),
  ]),

  lust: hero('Lust', 'boss', 190, 350, 6, BACK, [
    move('Beckon', spell(7), hex(3)),
    move('Veiled Favor', guard(11), protect('self')),
    move('Unwanted Gift', spell(10), dispel()),
    signature(move('Velvet Thrall', spell(13), { kind: 'malaise', amount: 1 })),
  ]),

  gluttony: hero('Gluttony', 'boss', 245, 16, 4, FRONT, [
    move('Ravenous Lash', strike(6, 2)),
    move('Hunger Gaze', spell(11), weaken(1)),
    move('Coil Inward', guard(15)),
    signature(move('Devour', strike(16), heal(18, 'self'))),
  ]),

  mageBorneAzula: hero('Mage Borne Azula', 'boss', 190, 49, 6, BACK, [
    move('Sevenfold Ward', guard(12), protect('self')),
    move('Oracle’s Hex', spell(7, 2), hex(3)),
    move('Unravel', homing(spell(10)), dispel()),
    signature(move('The Seventh Eye', homing(spell(15)), hex(5))),
  ]),

  lightLordMori: hero('Light Lord Mori', 'boss', 235, 42, 6, BACK, [
    move('Benediction', guard(8, 'allies'), protect()),
    move('Pale Radiance', spell(6, 2)),
    move('Restoration', heal(8), cleanse()),
    signature(move('Last Light', homing(spell(16)), dispel())),
  ]),

  // BOSSES (TARGET DUMMY SCENARIOS ONLY UNTIL THEY JOIN A REGION)
  apollyonSeraph: hero('Apollyon Seraph', 'elite', 220, 47, 5, FRONT, [
    move('Seal of the Host', guard(10), protect('self')),
    move('Radiant Gaze', spell(7, 2)),
    move('The Last Trumpet', homing(spell(14)), { kind: 'malaise', amount: 1 }),
    move('Scour the Unworthy', spell(10), dispel()),
  ]),

  /**
   * A great ivory dragon boss in a T: the whole front row and the back
   * row's centre. Its Vigor (a boss passive) gives it
   * two moves a turn: it opens by calling two Biblical Angels to its
   * flanks (and calls more whenever a flank is empty when the call
   * comes round again), then breathes holy fire, shields itself, brings
   * down its signature Halo of Judgment (which also raises every fallen
   * ally) and roars itself into a Wrath.
   */
  angelAssassin: hero('Angel Assassin', 'boss', 126, 280, 9, FRONT, [
    move('Veil', { kind: 'cloak', amount: 2 }),
    move('Silent Strike', strike(8, 2), bleed(2)),
    move('Dagger Cast', shoot(8), bleed(1)),
  ]),

  twinAxeKnight: armored(hero('Twin-Axe Knight', 'boss', 205, 42, 5, FRONT, [
    move('Twin Cleave', strike(9, 2), bleed(2)),
    move('Iron Brace', guard(19)),
    signature(move('Executioner’s Cross', strike(12, 2))),
  ]), 1),
  archangelUriel: hero('Archangel Uriel', 'boss', 195, 14, 7, FRONT, [
    move('Crimson Ward', guard(15), protect('self')),
    { ...move('Wingfire', spell(13), burn(3)), element: 'fire' },
    signature({ ...move('Radiant Verdict', spell(8, 3)), element: 'fire' }),
  ]),
  zeruelArmored: hero('Archangel Zeruel · Armored', 'boss', 210, 277, 6, FRONT, [
    move('Ivory Rebuke', strike(11)),
    move('Eclipse Guard', guard(18), protect('self')),
    signature(move('Divided Light', spell(7, 3))),
  ]),
  holyDragon: hero(
    'Holy Dragon Sol',
    'boss',
    500,
    280,
    5,
    BOSS_T,
    [
      move('Call the Host', summon('angelArcher', 2)),
      // A dragon breathes fire: its breaths lay Burn.
      { ...move('Holy Breath', spell(8, 2), burn(4)), element: 'fire' },
      move('Sanctuary Wings', guard(20)),
      { ...move('Dragonfire', {
        ...spell(5, 3),
        perHit: [{ status: 'burn', amount: 3 }],
      }), element: 'fire' },
      signature(move('Halo of Judgment', revive(), spell(26))),
      move('Radiant Roar', wrath(2)),
      // Blesses the whole host: Wrath and Protection on every hero.
      move('Blessing of the Host', wrath(2, 'allies'), protect()),
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
    // LIGHTNING: it lays Shock, and its own triple hits set it off
    move('Thunder Talons', {
      ...strike(5, 3),
      perHit: [{ status: 'shock', amount: 6 }],
    }),
    move('Smite', detonate()),
    move('Storm Wings', guard(18), shock(4)),
    { ...move('Crossed Talon', strike(3, 6)), isTwoHanded: true },
    move('Proud Cry', wrath(2)),
  ]),
  /**
   * A storm giant with a dragon's head, on a T like Sol (it fills the
   * front). Two moves a turn (Vigor). It drives Shock onto the villain
   * with its spear and wings, sets it off with Thunderhead, and its
   * signature Sky Breaker brings down one huge lightning strike.
   */
  tempestWyrm: hero(
    'Tempest Wyrm Vael',
    'boss',
    600,
    215,
    6,
    BOSS_T,
    [
      move('Storm Spear', {
        ...strike(9, 2),
        perHit: [{ status: 'shock', amount: 5 }],
      }),
      move('Tempest Wings', guard(22), shock(4)),
      move('Thunderhead', detonate()),
      signature({ ...move('Sky Breaker', spell(32)), element: 'lightning' }),
      move('Storm Roar', wrath(3)),
    ],
    ['vigor']
  ),
} as const satisfies Record<string, HeroDef>;

// --- DERIVED DATA ---
export type HeroId = keyof typeof HEROES;

/** A hero exactly as the catalog defines it, ignoring admin overrides. */
export const getCatalogHero = (id: HeroId): HeroDef => HEROES[id];

/** Looks up a hero definition, with any admin stat override applied. */
export const getHero = (id: HeroId): HeroDef =>
  applyUnitOverride(HEROES[id], getUnitOverrides()[id]);

// --- UNIT TYPES ---
/** The order unit type sections appear in. */
export const UNIT_TYPES: readonly UnitType[] = ['angel', 'dragon', 'beast', 'human', 'demiHuman', 'sin'];

/** Section headings for grouping heroes by unit type. */
export const UNIT_TYPE_LABELS: Readonly<Record<UnitType, string>> = {
  angel: 'Angels',
  dragon: 'Dragons',
  beast: 'Beasts',
  human: 'Humans',
  demiHuman: 'Demi-humans',
  sin: 'Seven Sins',
};

/**
 * What kind of being each hero is, judged from its art and name. Every
 * hero must have one (the satisfies check fails on a missing id), so a
 * new hero can't silently drop out of the grouped lists.
 */
const HERO_UNIT_TYPES = {
  // Humans: the kingdom's soldiers, champions, knights and mages.
  squire: 'human',
  bard: 'human',
  archer: 'human',
  priest: 'human',
  shieldmaiden: 'human',
  rogue: 'human',
  paladin: 'human',
  archmage: 'human',
  ballista: 'human',
  holt: 'human',
  lysa: 'human',
  maren: 'human',
  brannoc: 'human',
  seris: 'human',
  valen: 'human',
  swordPrelate: 'human',
  hornedSentinel: 'human',
  stormLancer: 'human',
  sevenEyedOracle: 'human',
  holyKing: 'human',
  twinAxeKnight: 'human',
  // Seven Sins.
  greed: 'sin',
  sloth: 'sin',
  pride: 'sin',
  lust: 'sin',
  gluttony: 'sin',
  envy: 'sin',
  // Demi-humans: human-shaped but born of magic, not of the kingdom.
  mageBorneAstra: 'demiHuman',
  mageBorneAzula: 'demiHuman',
  // Angels: winged heavenly host, plus the summons they bring.
  angelArcher: 'angel',
  wingedArcher: 'angel',
  angelMage: 'angel',
  grandangelCerviel: 'angel',
  cervielSword: 'angel',
  cervielBow: 'angel',
  grandangelCambiel: 'angel',
  archangelZeruel: 'angel',
  zeruelRedSun: 'angel',
  zeruelBlueSun: 'angel',
  grandangelRaziel: 'angel',
  grandangelGeonosis: 'angel',
  zadkielOfDominations: 'angel',
  grandangelCherubiel: 'angel',
  lightLordMori: 'angel',
  apollyonSeraph: 'angel',
  angelAssassin: 'angel',
  archangelUriel: 'angel',
  zeruelArmored: 'angel',
  // Dragons.
  fulgurDragonknight: 'dragon',
  holyDragon: 'dragon',
  tempestWyrm: 'dragon',
  // Beasts.
  ivoryWerewolf: 'beast',
  wolfCentaur: 'beast',
  grandGriffon: 'beast',
} as const satisfies Record<HeroId, UnitType>;

/** Looks up what kind of being a hero is. */
export const unitTypeOf = (id: HeroId): UnitType => HERO_UNIT_TYPES[id];

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

// --- AFFLICTIONS ON HIT ---
/** The hero effects that are afflictions laid on the villain. */
const HIT_AFFLICTIONS: ReadonlySet<HeroEffect['kind']> =
  new Set<HeroHitAffliction>([
    'hex',
    'poison',
    'burn',
    'frost',
    'bleed',
    'shock',
    'weaken',
  ]);

/** True for an affliction effect (Burn 4, Hex 2 ...) a move lays. */
const isHitAffliction = (
  effect: HeroEffect
): effect is Extract<HeroEffect, { kind: HeroHitAffliction }> =>
  HIT_AFFLICTIONS.has(effect.kind);

/**
 * A move's effects with its afflictions folded into its attack, so
 * they land on every hit that lands (Holy Breath 8x2, Burn 4: Burn 4 a
 * hit). A move with no attack keeps them as they are (laid once).
 */
export const foldPerHitAfflictions = (
  effects: readonly HeroEffect[]
): HeroEffect[] => {
  const attackAt = effects.findIndex((effect) => effect.kind === 'attack');
  const attack = effects[attackAt];
  if (attack?.kind !== 'attack') return [...effects];
  const procs = effects.filter(isHitAffliction).map((effect) => ({
    status: effect.kind,
    amount: effect.amount,
  }));
  const folded = { ...attack, perHit: [...(attack.perHit ?? []), ...procs] };
  return effects
    .map((effect) => (effect === attack ? folded : effect))
    .filter((effect) => !isHitAffliction(effect));
};
