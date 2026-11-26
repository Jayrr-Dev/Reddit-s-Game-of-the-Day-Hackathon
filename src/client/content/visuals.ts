// ===================================================================
// VISUAL MAPPINGS
// Which icon and token colour each game concept uses. Components read
// these tables instead of choosing colours inline, so the look of a
// status or card type is defined once.
// ===================================================================

import type { IntentKind } from '../../shared/game/describe';
import type { StopKind } from '../../shared/game/kingdom';
import { ROW_LABEL } from '../../shared/game/rules';
import type {
  CardKeyword,
  CardRarity,
  CardType,
  HeroTier,
  MagicElement,
  MeleeEdge,
  MovementId,
  PassiveId,
  StatusId,
} from '../../shared/game/types';
import type { GlyphName } from '../components/ui/Glyph';
import type { PopKind } from '../hooks/useHitPops';

// --- TYPES ---
export type Look = { glyph: GlyphName; toneClass: string };

// --- HELPERS ---
/** A look's colour as a CSS value (its text-* class names the token). */
export const toneVarOf = (look: Look): string =>
  `var(--color-${look.toneClass.replace(/^text-/, '')})`;

// --- STATUSES ---
export const STATUS_LOOK: Record<StatusId | 'guard', Look> = {
  guard: { glyph: 'shield', toneClass: 'text-guard' },
  hex: { glyph: 'skull', toneClass: 'text-hex' },
  poison: { glyph: 'drop', toneClass: 'text-poison' },
  burn: { glyph: 'flame', toneClass: 'text-burn' },
  frost: { glyph: 'snowflake', toneClass: 'text-frost' },
  shock: { glyph: 'bolt', toneClass: 'text-shock' },
  bleed: { glyph: 'drop', toneClass: 'text-bleed' },
  weaken: { glyph: 'eye', toneClass: 'text-weaken' },
  vex: { glyph: 'crackedShield', toneClass: 'text-vex' },
  enfeeble: { glyph: 'shatter', toneClass: 'text-enfeeble' },
  hitLimit: { glyph: 'padlock', toneClass: 'text-hex' },
  malaise: { glyph: 'padlock', toneClass: 'text-hex' },
  // Each buff wears the colour of what it boosts: Melee red, Range
  // silver, Magic sky blue, Guard and defence blue. Wrath boosts every
  // hit, so it keeps the Buff card type's orange.
  wrath: { glyph: 'fist', toneClass: 'text-buff' },
  might: { glyph: 'sword', toneClass: 'text-hp' },
  surge: { glyph: 'swirl', toneClass: 'text-magic' },
  hone: { glyph: 'bow', toneClass: 'text-range' },
  sharpshooter: { glyph: 'targeting', toneClass: 'text-range' },
  // Berserker boosts Melee, so it wears the Melee red (like Might).
  berserker: { glyph: 'battleAxe', toneClass: 'text-hp' },
  // Bane boosts afflictions, so it wears the Curse colour (Hex purple).
  bane: { glyph: 'flask', toneClass: 'text-hex' },
  // Instinct is defence (it turns hits aside): Guard blue.
  instinct: { glyph: 'dodging', toneClass: 'text-guard' },
  reflex: { glyph: 'dodging', toneClass: 'text-accent' },
  invincible: { glyph: 'aegis', toneClass: 'text-accent' },
  reinforce: { glyph: 'shield', toneClass: 'text-guard' },
  brace: { glyph: 'anchor', toneClass: 'text-guard' },
  momentum: { glyph: 'bolt', toneClass: 'text-hp' },
  protection: { glyph: 'aegis', toneClass: 'text-guard' },
  aloft: { glyph: 'wing', toneClass: 'text-accent' },
  cloak: { glyph: 'ghost', toneClass: 'text-hex' },
  // Rush makes movements free, so it wears the energy colour.
  move: { glyph: 'heartbeat', toneClass: 'text-energy' },
  rush: { glyph: 'heartbeat', toneClass: 'text-energy' },
  armor: { glyph: 'breastplate', toneClass: 'text-guard' },
};

// --- KEYWORDS ---
/** Each keyword's icon (its words come from KEYWORD_INFO). */
export const KEYWORD_LOOK: Record<CardKeyword, Look> = {
  hold: { glyph: 'padlock', toneClass: 'text-accent' },
  piercing: { glyph: 'arrowhead', toneClass: 'text-accent' },
  remove: { glyph: 'cardBurn', toneClass: 'text-ink-muted' },
  exhaust: { glyph: 'ghost', toneClass: 'text-ink-muted' },
  charge: { glyph: 'sword', toneClass: 'text-movement' },
  rampage: { glyph: 'battleAxe', toneClass: 'text-hp' },
  distance: { glyph: 'sprint', toneClass: 'text-range' },
  longRange: { glyph: 'eye', toneClass: 'text-range' },
};

// --- OUT OF RANGE ---
/**
 * The chip on a hero standing in Out of Range (Backline without
 * Longrange): its shots, and shots at it, land only some of the time.
 */
export const OUT_OF_RANGE_LOOK: Look = {
  glyph: 'arrowhead',
  toneClass: 'text-range',
};

// --- BOSS PASSIVES ---
/** Boss passives are gold tiles (see StatusRow), so they read as innate. */
export const PASSIVE_LOOK: Record<PassiveId, Look & { text: string }> = {
  vigor: { glyph: 'crown', toneClass: 'text-accent', text: '×2' },
  longRange: { glyph: 'eye', toneClass: 'text-range', text: '' },
  anchored: { glyph: 'anchor', toneClass: 'text-ink', text: '' },
};

// --- HERO INTENTS ---
export const INTENT_LOOK: Record<IntentKind, Look> = {
  attack: { glyph: 'sword', toneClass: 'text-hp' },
  // Hero attacks wear their type's colour, like the villain's cards.
  range: { glyph: 'bow', toneClass: 'text-range' },
  magic: { glyph: 'swirl', toneClass: 'text-magic' },
  advance: { glyph: 'march', toneClass: 'text-ink' },
  curse: { glyph: 'skull', toneClass: 'text-hex' },
  poison: STATUS_LOOK.poison,
  burn: STATUS_LOOK.burn,
  frost: STATUS_LOOK.frost,
  shock: STATUS_LOOK.shock,
  bleed: STATUS_LOOK.bleed,
  weaken: STATUS_LOOK.weaken,
  malaise: STATUS_LOOK.malaise,
  cloak: STATUS_LOOK.cloak,
  guard: { glyph: 'shield', toneClass: 'text-guard' },
  buff: STATUS_LOOK.wrath,
  heal: { glyph: 'heart', toneClass: 'text-heal' },
  dispel: { glyph: 'swirl', toneClass: 'text-magic' },
  disrupt: { glyph: 'swirl', toneClass: 'text-hex' },
  cleanse: { glyph: 'drop', toneClass: 'text-heal' },
  protect: STATUS_LOOK.protection,
  summon: { glyph: 'eye', toneClass: 'text-accent' },
  revive: { glyph: 'altar', toneClass: 'text-accent' },
  soar: STATUS_LOOK.aloft,
  pullPlayer: { glyph: 'march', toneClass: 'text-accent' },
  knockBack: { glyph: 'march', toneClass: 'text-guard' },
};

// --- CARDS ---
/**
 * One look per card type: the art glyph, the type shown on the
 * ribbon, the frame and banner colour, and the outer glow (a CSS colour
 * var, so the glow can be built with a shadow).
 */
export const CARD_LOOK: Record<
  CardType,
  { glyph: GlyphName; typeName: string; frameClass: string; glowVar: string }
> = {
  melee: {
    glyph: 'sword',
    typeName: 'Melee',
    frameClass: 'bg-card-melee',
    glowVar: 'var(--color-hp)',
  },
  range: {
    glyph: 'bow',
    typeName: 'Range',
    frameClass: 'bg-card-range',
    glowVar: 'var(--color-range)',
  },
  magic: {
    glyph: 'swirl',
    typeName: 'Magic',
    frameClass: 'bg-card-magic',
    glowVar: 'var(--color-magic)',
  },
  defend: {
    glyph: 'shield',
    typeName: 'Defend',
    frameClass: 'bg-card-defend',
    glowVar: 'var(--color-defend)',
  },
  imbue: {
    glyph: 'cards',
    typeName: 'Imbue',
    frameClass: 'bg-card-imbue',
    glowVar: 'var(--color-card-imbue)',
  },
  buff: {
    glyph: 'flame',
    typeName: 'Buff',
    frameClass: 'bg-card-buff',
    glowVar: 'var(--color-buff)',
  },
  curse: {
    glyph: 'skull',
    typeName: 'Curse',
    frameClass: 'bg-card-curse',
    glowVar: 'var(--color-hex)',
  },
  utility: {
    glyph: 'potion',
    typeName: 'Utility',
    frameClass: 'bg-card-utility',
    glowVar: 'var(--color-heal)',
  },
  movement: {
    glyph: 'march',
    typeName: 'Movement',
    frameClass: 'bg-card-movement',
    glowVar: 'var(--color-movement)',
  },
};

// --- STATUS CHIPS ---
/** Lines a hero's status chips wrap onto before folding into "+N". */
export const HERO_STATUS_ROWS = 2;

// --- MAGIC ELEMENTS ---
/**
 * How a Magic element looks: its icon on the type pill, and the colours
 * and shape of its bolt and burst.
 *   energy  the bolt's trail and the burst's strokes
 *   core    the bolt's head and the burst's white-hot centre
 *   burst   'curls' (wavy wisps, like flame) or 'ring' (a crown of
 *           short shards, like ice); a plain spell picks either
 */
export type ElementLook = Look & {
  energy: string;
  core: string;
  burst: 'curls' | 'ring';
};

/** A Melee card's edge icon on its type ribbon (cosmetic). */
export const EDGE_LOOK: Record<MeleeEdge, Look> = {
  sharp: { glyph: 'dagger', toneClass: 'text-range' },
  blunt: { glyph: 'hammer', toneClass: 'text-burn' },
};

/**
 * The art-window glyph a Melee edge swaps in for the type's sword
 * (null keeps it): Blunt cards show a hammer.
 */
export const EDGE_ART: Record<MeleeEdge, GlyphName | null> = {
  sharp: null,
  blunt: 'hammer',
};

export const ELEMENT_LOOK: Record<MagicElement, ElementLook> = {
  fire: {
    glyph: 'flame',
    toneClass: 'text-burn',
    energy: 'var(--color-burn)',
    core: 'color-mix(in oklab, var(--color-burn) 25%, white)',
    burst: 'curls',
  },
  ice: {
    glyph: 'snowflake',
    toneClass: 'text-frost',
    energy: 'white',
    core: 'white',
    burst: 'ring',
  },
  healing: {
    glyph: 'plus',
    toneClass: 'text-heal',
    energy: 'var(--color-heal)',
    core: 'color-mix(in oklab, var(--color-heal) 25%, white)',
    burst: 'ring',
  },
  lightning: {
    glyph: 'bolt',
    toneClass: 'text-shock',
    energy: 'var(--color-shock)',
    core: 'white',
    burst: 'ring',
  },
};

/**
 * The rarity gem on a card, one colour per tier: Basic (the starter
 * deck) has none, then Common grey, Uncommon green, Rare blue,
 * Legendary orange.
 */
export const RARITY_GEM: Record<CardRarity, string | null> = {
  basic: null,
  common: 'bg-ink-muted',
  uncommon: 'bg-heal',
  rare: 'bg-guard',
  legendary: 'bg-burn',
};

// --- STOPS ---
export const STOP_LOOK: Record<StopKind, Look> = {
  horde: { glyph: 'sword', toneClass: 'text-hp' },
  elite: { glyph: 'skull', toneClass: 'text-wrath' },
  champion: { glyph: 'crown', toneClass: 'text-accent' },
  grave: { glyph: 'grave', toneClass: 'text-guard' },
  altar: { glyph: 'altar', toneClass: 'text-hex' },
};

// --- POPS ---
/**
 * Icon and colour of each kind of gain or debuff, from the shared look
 * tables (also the glow colour in ImpactOverlay).
 */
export const POP_LOOK: Record<Exclude<PopKind, 'hit'>, Look> = {
  heal: INTENT_LOOK.heal,
  guard: STATUS_LOOK.guard,
  wrath: STATUS_LOOK.wrath,
  might: STATUS_LOOK.might,
  surge: STATUS_LOOK.surge,
  hone: STATUS_LOOK.hone,
  sharpshooter: STATUS_LOOK.sharpshooter,
  berserker: STATUS_LOOK.berserker,
  bane: STATUS_LOOK.bane,
  instinct: STATUS_LOOK.instinct,
  reflex: STATUS_LOOK.reflex,
  invincible: STATUS_LOOK.invincible,
  reinforce: STATUS_LOOK.reinforce,
  brace: STATUS_LOOK.brace,
  armor: STATUS_LOOK.armor,
  momentum: STATUS_LOOK.momentum,
  protection: STATUS_LOOK.protection,
  hex: STATUS_LOOK.hex,
  poison: STATUS_LOOK.poison,
  burn: STATUS_LOOK.burn,
  frost: STATUS_LOOK.frost,
  shock: STATUS_LOOK.shock,
  bleed: STATUS_LOOK.bleed,
  shockBurst: STATUS_LOOK.shock,
  bleedBite: STATUS_LOOK.bleed,
  miss: { glyph: 'eye', toneClass: 'text-ink-muted' },
  dodge: { glyph: 'dodging', toneClass: 'text-guard' },
  weaken: STATUS_LOOK.weaken,
  vex: STATUS_LOOK.vex,
  enfeeble: STATUS_LOOK.enfeeble,
};

// --- MOVEMENTS ---
/** How one movement's pill looks, its tooltip, and its speed lines. */
type MovementLook = {
  label: string;
  glyph: GlyphName;
  /** What the move does, for its tooltip (the label is its title). */
  description: string;
  toneClass: string;
  /** Speed lines rush in (toward the heroes) or fly out (away). */
  speedLines: 'in' | 'out';
};

export const MOVEMENT_LOOK: Record<MovementId, MovementLook> = {
  charge: {
    label: 'Charge',
    glyph: 'bolt',
    description:
      'You move **1** line closer\nYour next **Melee** card deals **+50%**',
    speedLines: 'in',
    toneClass: 'bg-blood shadow-[0_0_14px_var(--color-blood)]',
  },
  backStep: {
    label: 'Back Step',
    glyph: 'march',
    description:
      `You move back **1** line\nEvery hero ends up 1 line farther, up to the **${ROW_LABEL.horizon}**\nOut of **Melee** reach`,
    speedLines: 'out',
    toneClass:
      'bg-surface-raised shadow-[0_0_14px_var(--color-guard)] [&_svg]:rotate-180',
  },
};

// --- HERO TIER NAMES ---
/**
 * Name colour by hero tier, shared by the battlefield plates and the
 * Illusion Training scenario cards: bosses gold, elites blue, the rest
 * plain ink. The colours are theme tokens (--color-boss, --color-elite).
 */
export const TIER_NAME_CLASS: Record<HeroTier, string> = {
  boss: 'text-boss',
  elite: 'text-elite',
  champion: 'text-ink',
  grunt: 'text-ink',
};
