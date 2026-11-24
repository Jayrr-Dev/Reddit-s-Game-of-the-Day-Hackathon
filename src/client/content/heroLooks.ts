// ===================================================================
// HERO LOOKS
// How each hero is drawn: flat, hard-edged shapes in a few bold colours
// (each face and robe split into a lit and a shadowed half), told apart
// at a glance by what is on their head and what is in their hand.
// Data only; HeroFigure turns it into SVG. To add a hero, add a look.
// ===================================================================

import type { HeroId } from '../../shared/game/heroes';

// --- TYPES ---
/** What a hero wears on (or instead of) its head. */
export type Headgear =
  | 'kettleHelm'
  | 'braids'
  | 'pointedHood'
  | 'maskedHood'
  | 'mitre'
  | 'featherCap'
  | 'greatHelm'
  | 'wizardHat'
  | 'combHelm'
  | 'leafCirclet'
  | 'veilHalo'
  | 'hornedHelm'
  | 'ponytailTiara'
  | 'sunCrown';

/** What a hero holds (it moves when the hero attacks). */
export type Prop =
  | 'sword'
  | 'kiteShield'
  | 'longbow'
  | 'daggers'
  | 'holyStaff'
  | 'lute'
  | 'greatsword'
  | 'orbStaff'
  | 'halberd'
  | 'crescentStaff'
  | 'warhammer'
  | 'rapier';

/** A lit / shadowed pair of one colour (any CSS colour). */
export type Tone = { lit: string; shade: string };

export type HeroLook = {
  headgear: Headgear;
  prop: Prop;
  /** Bare face, or a closed helm (metal face with a visor slit). */
  face: 'bare' | 'helm';
  skin: Tone;
  robe: Tone;
  /** Headgear, hair or trim. */
  gear: Tone;
  /** A small bright detail (gem, feather, halo, orb). */
  accent: string;
};

// --- PALETTE HELPERS ---
const tone = (lit: string, shade: string): Tone => ({ lit, shade });
const SKIN_FAIR = tone('#f3d2b3', '#dcae8c');
const SKIN_WARM = tone('#e0a77e', '#c3845c');
const SKIN_DEEP = tone('#a56d4b', '#83533a');
const STEEL = tone('#c9ced6', '#9aa2ad');
const GOLD = tone('#e8bb4c', '#c18f2a');

// --- CATALOG ---
export const HERO_LOOKS: Record<HeroId, HeroLook> = {
  // GRUNTS
  squire: {
    headgear: 'kettleHelm',
    prop: 'sword',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: tone('#4f7fb8', '#3a6293'),
    gear: STEEL,
    accent: '#e8bb4c',
  },
  shieldmaiden: {
    headgear: 'braids',
    prop: 'kiteShield',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: tone('#3f8f8a', '#2d6e6a'),
    gear: tone('#e9b25a', '#c98d38'),
    accent: '#d8dde4',
  },
  archer: {
    headgear: 'pointedHood',
    prop: 'longbow',
    face: 'bare',
    skin: SKIN_WARM,
    robe: tone('#5f8a3c', '#476b2b'),
    gear: tone('#4d7231', '#385523'),
    accent: '#c9a46a',
  },
  rogue: {
    headgear: 'maskedHood',
    prop: 'daggers',
    face: 'bare',
    skin: SKIN_DEEP,
    robe: tone('#3b4a52', '#29343a'),
    gear: tone('#2c3a40', '#1d272c'),
    accent: '#7fd3c4',
  },
  priest: {
    headgear: 'mitre',
    prop: 'holyStaff',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: tone('#efe6d2', '#cfc3a8'),
    gear: tone('#efe6d2', '#cfc3a8'),
    accent: '#e8bb4c',
  },
  bard: {
    headgear: 'featherCap',
    prop: 'lute',
    face: 'bare',
    skin: SKIN_WARM,
    robe: tone('#b0457f', '#8a3363'),
    gear: tone('#6b2b8a', '#52206b'),
    accent: '#f0d264',
  },

  // ELITES
  paladin: {
    headgear: 'greatHelm',
    prop: 'greatsword',
    face: 'helm',
    skin: STEEL,
    robe: tone('#e6dcc4', '#c4b897'),
    gear: STEEL,
    accent: '#d9443c',
  },
  archmage: {
    headgear: 'wizardHat',
    prop: 'orbStaff',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: tone('#5b3fa0', '#45307c'),
    gear: tone('#4a3388', '#36256a'),
    accent: '#8fe6ff',
  },

  // CHAMPIONS
  holt: {
    headgear: 'combHelm',
    prop: 'halberd',
    face: 'bare',
    skin: SKIN_WARM,
    robe: tone('#b3532f', '#8e3f22'),
    gear: STEEL,
    accent: '#e8bb4c',
  },
  lysa: {
    headgear: 'leafCirclet',
    prop: 'longbow',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: tone('#2f7a52', '#215a3c'),
    gear: tone('#c0562f', '#9a4122'),
    accent: '#9fdc6a',
  },
  maren: {
    headgear: 'veilHalo',
    prop: 'crescentStaff',
    face: 'bare',
    skin: SKIN_DEEP,
    robe: tone('#f4efe4', '#d6ccb8'),
    gear: tone('#ffffff', '#dcd6cc'),
    accent: '#f2cf5b',
  },
  brannoc: {
    headgear: 'hornedHelm',
    prop: 'warhammer',
    face: 'helm',
    skin: tone('#8f98a4', '#6c7480'),
    robe: tone('#5c6470', '#454b55'),
    gear: tone('#e6dcc4', '#c4b897'),
    accent: '#c8324a',
  },
  seris: {
    headgear: 'ponytailTiara',
    prop: 'rapier',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: tone('#b3263e', '#8a1c2f'),
    gear: tone('#1f1a22', '#121014'),
    accent: '#e8bb4c',
  },
  valen: {
    headgear: 'sunCrown',
    prop: 'greatsword',
    face: 'bare',
    skin: SKIN_WARM,
    robe: tone('#f2e4b5', '#d4c28c'),
    gear: GOLD,
    accent: '#fff3b0',
  },
};

/** How a hero's attack animates (the type of move it is making). */
export type HeroActionStyle = 'melee' | 'range' | 'magic' | 'support';
