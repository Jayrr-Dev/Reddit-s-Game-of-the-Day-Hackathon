// ===================================================================
// VISUAL MAPPINGS
// Which icon and token colour each game concept uses. Components read
// these tables instead of choosing colours inline, so the look of a
// status or card type is defined once.
// ===================================================================

import type { IntentKind } from '../../shared/game/describe';
import type { StopKind } from '../../shared/game/kingdom';
import type {
  CardKeyword,
  CardRarity,
  CardType,
  MagicElement,
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
  bleed: { glyph: 'wound', toneClass: 'text-bleed' },
  weaken: { glyph: 'eye', toneClass: 'text-weaken' },
  enfeeble: { glyph: 'shatter', toneClass: 'text-enfeeble' },
  // Every buff wears the Buff card type's orange (one token, --color-buff);
  // the icon says which kind of card it boosts.
  wrath: { glyph: 'fist', toneClass: 'text-buff' },
  might: { glyph: 'sword', toneClass: 'text-buff' },
  surge: { glyph: 'swirl', toneClass: 'text-buff' },
  hone: { glyph: 'bow', toneClass: 'text-buff' },
  reinforce: { glyph: 'shield', toneClass: 'text-buff' },
  brace: { glyph: 'anchor', toneClass: 'text-buff' },
  momentum: { glyph: 'bolt', toneClass: 'text-energy' },
  protection: { glyph: 'aegis', toneClass: 'text-buff' },
  aloft: { glyph: 'wing', toneClass: 'text-accent' },
};

// --- KEYWORDS ---
/** Each keyword's icon (its words come from KEYWORD_INFO). */
export const KEYWORD_LOOK: Record<CardKeyword, Look> = {
  hold: { glyph: 'padlock', toneClass: 'text-accent' },
  piercing: { glyph: 'arrowhead', toneClass: 'text-accent' },
  remove: { glyph: 'cardBurn', toneClass: 'text-ink-muted' },
  exhaust: { glyph: 'ghost', toneClass: 'text-ink-muted' },
  rampage: { glyph: 'battleAxe', toneClass: 'text-hp' },
  distance: { glyph: 'sprint', toneClass: 'text-range' },
  longRange: { glyph: 'eye', toneClass: 'text-range' },
};

// --- OUT OF RANGE ---
/**
 * The chip on a hero standing in Out of Range (Line 3 without
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
  bleed: STATUS_LOOK.bleed,
  weaken: STATUS_LOOK.weaken,
  guard: { glyph: 'shield', toneClass: 'text-guard' },
  buff: STATUS_LOOK.wrath,
  heal: { glyph: 'heart', toneClass: 'text-heal' },
  cleanse: { glyph: 'drop', toneClass: 'text-heal' },
  summon: { glyph: 'eye', toneClass: 'text-accent' },
  revive: { glyph: 'altar', toneClass: 'text-accent' },
  soar: STATUS_LOOK.aloft,
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
    energy: 'var(--color-frost)',
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
};

/** The rarity gem on a card (starters have none). */
export const RARITY_GEM: Record<CardRarity, string | null> = {
  starter: null,
  common: 'bg-ink-muted',
  uncommon: 'bg-heal',
  rare: 'bg-accent',
};

// --- STOPS ---
export const STOP_LOOK: Record<StopKind, Look> = {
  horde: { glyph: 'sword', toneClass: 'text-hp' },
  elite: { glyph: 'skull', toneClass: 'text-wrath' },
  champion: { glyph: 'crown', toneClass: 'text-accent' },
  grave: { glyph: 'grave', toneClass: 'text-guard' },
  altar: { glyph: 'altar', toneClass: 'text-hex' },
};

// --- REGION BACKDROPS ---
/**
 * Backdrop hue for each region, in conquest order (dusk village, dusty
 * road, cold monastery, burning gates, violet court, golden throne).
 * Endless uprisings past the throne cycle through them again.
 */
const REGION_HUES: readonly number[] = [265, 25, 205, 355, 295, 42];

/** The backdrop hue for a region index. */
export const regionHue = (regionIndex: number): number =>
  REGION_HUES[regionIndex % REGION_HUES.length] ?? 265;

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
  reinforce: STATUS_LOOK.reinforce,
  brace: STATUS_LOOK.brace,
  momentum: STATUS_LOOK.momentum,
  protection: STATUS_LOOK.protection,
  hex: STATUS_LOOK.hex,
  poison: STATUS_LOOK.poison,
  burn: STATUS_LOOK.burn,
  frost: STATUS_LOOK.frost,
  bleed: STATUS_LOOK.bleed,
  bleedBurst: STATUS_LOOK.bleed,
  miss: { glyph: 'eye', toneClass: 'text-ink-muted' },
  weaken: STATUS_LOOK.weaken,
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
      'Closes in until a hero is in **Line 1**\nYour next **Melee** card deals **+50%**',
    speedLines: 'in',
    toneClass: 'bg-blood shadow-[0_0_14px_var(--color-blood)]',
  },
  backStep: {
    label: 'Back Step',
    glyph: 'march',
    description:
      'Sends every hero back **1** line, to **Line 2**\nOut of **Melee** reach',
    speedLines: 'out',
    toneClass:
      'bg-surface-raised shadow-[0_0_14px_var(--color-guard)] [&_svg]:rotate-180',
  },
};
