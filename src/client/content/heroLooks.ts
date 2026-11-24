// ===================================================================
// HERO LOOKS
// How each hero is drawn: flat, hard-edged shapes (each face, robe and
// cape split into a lit and a shadowed half) in a muted, earthy palette
// of mauve-grey steel, oxblood, burnt orange, olive and slate, with one
// bright accent each. Heroes are told apart at a glance by what is on
// their head and in their hand, then by armour (mail is a fine dotted
// texture, plate adds pauldrons) and by a ragged cape.
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

/**
 * What covers the arms and neck:
 *   cloth  plain sleeves in the robe colour
 *   mail   a mail coif round the neck and mail sleeves
 *   plate  mail plus steel pauldrons on the shoulders
 */
export type Armor = 'cloth' | 'mail' | 'plate';

/** A lit / shadowed pair of one colour (any CSS colour). */
export type Tone = { lit: string; shade: string };

/**
 * A face's personality, drawn in flat shapes (see HeroFace):
 *   eyes   round (eager), narrow (squinting), sharp (cat-eye, upturned),
 *          droopy (kind, outer corners down), wide (big, with a glint),
 *          hooded (heavy lids, calm)
 *   brow   thin, flat, heavy (thick), arched (peaked), stern (angled in)
 *   mouth  line, smile, smirk (one corner up), frown, small
 */
export type EyeCut =
  'round' | 'narrow' | 'sharp' | 'droopy' | 'wide' | 'hooded';
export type BrowStyle = 'thin' | 'flat' | 'heavy' | 'arched' | 'stern';
export type MouthStyle = 'line' | 'smile' | 'smirk' | 'frown' | 'small';
export type FaceFeatures = { eyes: EyeCut; brow: BrowStyle; mouth: MouthStyle };

/**
 * How a hero feels right now, layered over its features:
 *   calm     its own resting face
 *   fierce   attacking: brows slam down, teeth bared
 *   worried  low on HP: brows up, frowning
 *   wince    just hit: eyes squeezed shut, teeth gritted
 */
export type HeroMood = 'calm' | 'fierce' | 'worried' | 'wince';

export type HeroLook = {
  headgear: Headgear;
  prop: Prop;
  /** Bare face, or a closed helm (metal face with a visor slit). */
  face: 'bare' | 'helm';
  skin: Tone;
  robe: Tone;
  /** Headgear, hair or trim. */
  gear: Tone;
  /** A small bright detail (gem, feather, halo, orb, shield sigil). */
  accent: string;
  armor: Armor;
  /** A ragged-hemmed cape hanging behind, if the hero wears one. */
  cape?: Tone;
  /** True for heavy weapons held in both hands (the off hand joins). */
  isTwoHanded?: true;
  /** Eyes, brows and mouth of a bare face (helms show none). */
  features?: FaceFeatures;
};

// --- PALETTE ---
// Muted and slightly desaturated so the one accent per hero pops.
const tone = (lit: string, shade: string): Tone => ({ lit, shade });
const SKIN_FAIR = tone('#e6c7ab', '#c9a587');
const SKIN_WARM = tone('#d09e7c', '#b07f60');
const SKIN_DEEP = tone('#9a6a4e', '#7a523b');
/** Mauve-grey steel, as in old painted armour. */
const STEEL = tone('#b4abb4', '#8b818c');
const GOLD = tone('#d2a64c', '#a9822f');
const OXBLOOD = tone('#86302c', '#652320');
const BURNT_ORANGE = tone('#b85d2e', '#924822');
const OLIVE = tone('#666b43', '#4e5233');
const SLATE = tone('#5b6b7d', '#455262');
const PARCHMENT = tone('#d9cdb3', '#b7a98c');

/** Pauldron steel, shared by every plate-armoured hero. */
export const ARMOR_STEEL = STEEL;
/** Mail texture: a ring colour dotted over a base, lit and shadowed. */
export const MAIL = {
  lit: { base: '#a69da7', ring: '#7d7380' },
  shade: { base: '#7b717e', ring: '#5c535f' },
} as const;

// --- CREATURES ---
/**
 * Heroes that are not people (no headgear, prop or armour) and get a
 * drawing of their own instead of the shared humanoid figure.
 */
export const CREATURE_IDS = ['holyDragon'] as const satisfies readonly HeroId[];
export type CreatureId = (typeof CREATURE_IDS)[number];
/** Every hero drawn by the shared humanoid figure. */
export type HumanoidId = Exclude<HeroId, CreatureId>;

/** True for a hero with a drawing of its own (see CREATURE_IDS). */
export const isCreature = (id: HeroId): id is CreatureId =>
  (CREATURE_IDS as readonly HeroId[]).includes(id);

/** The humanoid look of a hero, or null for a creature. */
export const humanoidLookOf = (id: HeroId): HeroLook | null =>
  isCreature(id) ? null : HERO_LOOKS[id];

// --- CATALOG (HUMANOIDS) ---
export const HERO_LOOKS: Record<HumanoidId, HeroLook> = {
  // GRUNTS
  squire: {
    headgear: 'kettleHelm',
    prop: 'sword',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: SLATE,
    gear: STEEL,
    accent: '#d1a04e',
    armor: 'mail',
    features: { eyes: 'round', brow: 'arched', mouth: 'smile' },
  },
  shieldmaiden: {
    headgear: 'braids',
    prop: 'kiteShield',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: OLIVE,
    gear: tone('#c98f4a', '#a3703a'),
    accent: '#d9b25a',
    armor: 'mail',
    cape: OXBLOOD,
    features: { eyes: 'sharp', brow: 'heavy', mouth: 'line' },
  },
  archer: {
    headgear: 'pointedHood',
    prop: 'longbow',
    face: 'bare',
    skin: SKIN_WARM,
    robe: tone('#52603b', '#3e492d'),
    gear: OLIVE,
    accent: '#c19a62',
    armor: 'cloth',
    features: { eyes: 'narrow', brow: 'flat', mouth: 'smirk' },
  },
  rogue: {
    headgear: 'maskedHood',
    prop: 'daggers',
    face: 'bare',
    skin: SKIN_DEEP,
    robe: tone('#433d46', '#2f2b32'),
    gear: tone('#2f2b33', '#211e24'),
    accent: '#8fc4b6',
    armor: 'cloth',
    cape: tone('#3a3036', '#282126'),
    features: { eyes: 'sharp', brow: 'stern', mouth: 'line' },
  },
  priest: {
    headgear: 'mitre',
    prop: 'holyStaff',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: PARCHMENT,
    gear: PARCHMENT,
    accent: '#d1a04e',
    armor: 'cloth',
    features: { eyes: 'droopy', brow: 'thin', mouth: 'small' },
  },
  bard: {
    headgear: 'featherCap',
    prop: 'lute',
    face: 'bare',
    skin: SKIN_WARM,
    robe: tone('#8c3f5c', '#6e2f47'),
    gear: tone('#5a3466', '#45274e'),
    accent: '#e3bd5e',
    armor: 'cloth',
    cape: BURNT_ORANGE,
    features: { eyes: 'wide', brow: 'arched', mouth: 'smile' },
  },

  // ELITES
  paladin: {
    headgear: 'greatHelm',
    prop: 'greatsword',
    face: 'helm',
    skin: STEEL,
    robe: PARCHMENT,
    gear: STEEL,
    accent: '#c0392f',
    armor: 'plate',
    cape: OXBLOOD,
    isTwoHanded: true,
  },
  archmage: {
    headgear: 'wizardHat',
    prop: 'orbStaff',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: tone('#4c3c78', '#3a2d5d'),
    gear: tone('#3f3266', '#2f254d'),
    accent: '#8fd6ec',
    armor: 'cloth',
    features: { eyes: 'hooded', brow: 'heavy', mouth: 'line' },
  },

  // CHAMPIONS
  holt: {
    headgear: 'combHelm',
    prop: 'halberd',
    face: 'bare',
    skin: SKIN_WARM,
    robe: BURNT_ORANGE,
    gear: STEEL,
    accent: '#d1a04e',
    armor: 'plate',
    isTwoHanded: true,
    features: { eyes: 'narrow', brow: 'heavy', mouth: 'frown' },
  },
  lysa: {
    headgear: 'leafCirclet',
    prop: 'longbow',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: tone('#3f5f47', '#2f4836'),
    gear: tone('#b0532f', '#8a3f22'),
    accent: '#a6cc70',
    armor: 'cloth',
    cape: OLIVE,
    features: { eyes: 'sharp', brow: 'thin', mouth: 'smirk' },
  },
  maren: {
    headgear: 'veilHalo',
    prop: 'crescentStaff',
    face: 'bare',
    skin: SKIN_DEEP,
    robe: tone('#e6dfd0', '#c4bba8'),
    gear: tone('#f2eee6', '#d2cbbd'),
    accent: '#e5c25c',
    armor: 'cloth',
    cape: tone('#7d6d8f', '#5f526e'),
    features: { eyes: 'hooded', brow: 'arched', mouth: 'small' },
  },
  brannoc: {
    headgear: 'hornedHelm',
    prop: 'warhammer',
    face: 'helm',
    skin: STEEL,
    robe: tone('#4f4a55', '#3b3740'),
    gear: PARCHMENT,
    accent: '#c0392f',
    armor: 'plate',
    cape: OXBLOOD,
    isTwoHanded: true,
  },
  seris: {
    headgear: 'ponytailTiara',
    prop: 'rapier',
    face: 'bare',
    skin: SKIN_FAIR,
    robe: OXBLOOD,
    gear: tone('#1f1a22', '#121014'),
    accent: '#ddb04e',
    armor: 'mail',
    cape: tone('#2a2329', '#1b161a'),
    features: { eyes: 'sharp', brow: 'arched', mouth: 'smirk' },
  },
  valen: {
    headgear: 'sunCrown',
    prop: 'greatsword',
    face: 'bare',
    skin: SKIN_WARM,
    robe: tone('#e4d6a8', '#c2b383'),
    gear: GOLD,
    accent: '#fff0b0',
    armor: 'plate',
    cape: BURNT_ORANGE,
    isTwoHanded: true,
    features: { eyes: 'round', brow: 'stern', mouth: 'line' },
  },
};

/** How a hero's attack animates (the type of move it is making). */
export type HeroActionStyle = 'melee' | 'range' | 'magic' | 'support';

/**
 * The ways a melee weapon can be swung, so close-up attacks vary:
 *   slash  a wide sideways sweep
 *   chop   raised high behind, brought hard down
 *   stab   levelled, pulled back, then thrust forward
 *   upcut    from low, swept up and across
 *   forward       raised over the shoulder, then cut diagonally down
 *                 toward the camera (the villain), top right to bottom
 *                 left: the hero lunges in, the blade grows as it comes
 *                 closer, and a streak marks the cut
 *   forwardRight  the same cut mirrored: top left to bottom right
 */
export type MeleeSwing =
  'slash' | 'chop' | 'stab' | 'upcut' | 'forward' | 'forwardRight';
export const MELEE_SWINGS: readonly MeleeSwing[] = [
  'forward',
  'forwardRight',
  'slash',
  'chop',
  'stab',
  'upcut',
];

/** A move playing on a hero: its style and, for melee, which swing. */
export type HeroAction = { style: HeroActionStyle; swing: MeleeSwing };
