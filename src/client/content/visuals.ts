// ===================================================================
// VISUAL MAPPINGS
// Which icon and token colour each game concept uses. Components read
// these tables instead of choosing colours inline, so the look of a
// status or card type is defined once.
// ===================================================================

import type { IntentKind } from '../../shared/game/describe';
import type { StopKind } from '../../shared/game/kingdom';
import type { CardRarity, CardType, StatusId } from '../../shared/game/types';
import type { GlyphName } from '../components/ui/Glyph';
import type { PopKind } from '../hooks/useHitPops';

// --- TYPES ---
export type Look = { glyph: GlyphName; toneClass: string };

// --- HELPERS ---
/** A look's colour as a CSS value (its text-* class names the token). */
export const toneVarOf = (look: Look): string =>
  `var(--color-${look.toneClass.replace(/^text-/, '')})`;

// --- STATUSES ---
export const STATUS_LOOK: Record<StatusId | 'shroud', Look> = {
  shroud: { glyph: 'shield', toneClass: 'text-shroud' },
  hex: { glyph: 'skull', toneClass: 'text-hex' },
  dread: { glyph: 'eye', toneClass: 'text-dread' },
  wrath: { glyph: 'flame', toneClass: 'text-wrath' },
  // Buffs wear their card type's icon and colour (see CARD_LOOK).
  might: { glyph: 'sword', toneClass: 'text-hp' },
  surge: { glyph: 'swirl', toneClass: 'text-shroud' },
  piercing: { glyph: 'bow', toneClass: 'text-heal' },
  protection: { glyph: 'shield', toneClass: 'text-accent' },
  momentum: { glyph: 'bolt', toneClass: 'text-energy' },
};

// --- HERO INTENTS ---
export const INTENT_LOOK: Record<IntentKind, Look> = {
  attack: { glyph: 'sword', toneClass: 'text-hp' },
  curse: { glyph: 'skull', toneClass: 'text-hex' },
  dread: STATUS_LOOK.dread,
  guard: { glyph: 'shield', toneClass: 'text-shroud' },
  buff: { glyph: 'flame', toneClass: 'text-wrath' },
  heal: { glyph: 'heart', toneClass: 'text-heal' },
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
    glowVar: 'var(--color-heal)',
  },
  magic: {
    glyph: 'swirl',
    typeName: 'Magic',
    frameClass: 'bg-card-magic',
    glowVar: 'var(--color-shroud)',
  },
  buff: {
    glyph: 'shield',
    typeName: 'Buff',
    frameClass: 'bg-card-buff',
    glowVar: 'var(--color-energy)',
  },
  curse: {
    glyph: 'skull',
    typeName: 'Curse',
    frameClass: 'bg-card-curse',
    glowVar: 'var(--color-hex)',
  },
};

/** The rarity gem on a card's ribbon (starters have none). */
export const RARITY_GEM: Record<CardRarity, string | null> = {
  starter: null,
  common: 'bg-ink-muted',
  uncommon: 'bg-heal',
  rare: 'bg-accent',
};

/** Words drawn bold in rules text (statuses and card keywords). */
export const RULES_KEYWORDS = [
  'Hex',
  'Dread',
  'Guard',
  'Wrath',
  'Might',
  'Surge',
  'Piercing',
  'Protection',
  'ALL',
] as const;

// --- STOPS ---
export const STOP_LOOK: Record<StopKind, Look> = {
  horde: { glyph: 'sword', toneClass: 'text-hp' },
  elite: { glyph: 'skull', toneClass: 'text-wrath' },
  champion: { glyph: 'crown', toneClass: 'text-accent' },
  grave: { glyph: 'grave', toneClass: 'text-shroud' },
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
  shroud: STATUS_LOOK.shroud,
  wrath: STATUS_LOOK.wrath,
  might: STATUS_LOOK.might,
  surge: STATUS_LOOK.surge,
  piercing: STATUS_LOOK.piercing,
  protection: STATUS_LOOK.protection,
  momentum: STATUS_LOOK.momentum,
  hex: STATUS_LOOK.hex,
  dread: STATUS_LOOK.dread,
};
