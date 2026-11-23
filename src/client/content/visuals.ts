// ===================================================================
// VISUAL MAPPINGS
// Which icon and token colour each game concept uses. Components read
// these tables instead of choosing colours inline, so the look of a
// status or card type is defined once.
// ===================================================================

import type { CardCategory, IntentKind } from '../../shared/game/describe';
import type { StopKind } from '../../shared/game/kingdom';
import type { CardRarity, StatusId } from '../../shared/game/types';
import type { GlyphName } from '../components/ui/Glyph';

// --- TYPES ---
export type Look = { glyph: GlyphName; toneClass: string };

// --- STATUSES ---
export const STATUS_LOOK: Record<StatusId | 'shroud', Look> = {
  shroud: { glyph: 'shield', toneClass: 'text-shroud' },
  hex: { glyph: 'skull', toneClass: 'text-hex' },
  dread: { glyph: 'eye', toneClass: 'text-dread' },
  wrath: { glyph: 'flame', toneClass: 'text-wrath' },
};

// --- HERO INTENTS ---
export const INTENT_LOOK: Record<IntentKind, Look> = {
  attack: { glyph: 'sword', toneClass: 'text-hp' },
  curse: { glyph: 'skull', toneClass: 'text-hex' },
  guard: { glyph: 'shield', toneClass: 'text-shroud' },
  buff: { glyph: 'flame', toneClass: 'text-wrath' },
  heal: { glyph: 'heart', toneClass: 'text-heal' },
};

// --- CARDS ---
/**
 * One look per card family: the art glyph, the type shown on the
 * ribbon, the frame and banner colour, and the outer glow (a CSS colour
 * var, so the glow can be built with a shadow).
 */
export const CARD_LOOK: Record<
  CardCategory,
  { glyph: GlyphName; typeName: string; frameClass: string; glowVar: string }
> = {
  strike: {
    glyph: 'sword',
    typeName: 'Strike',
    frameClass: 'bg-card-strike',
    glowVar: 'var(--color-hp)',
  },
  curse: {
    glyph: 'skull',
    typeName: 'Curse',
    frameClass: 'bg-card-curse',
    glowVar: 'var(--color-hex)',
  },
  guard: {
    glyph: 'shield',
    typeName: 'Guard',
    frameClass: 'bg-card-guard',
    glowVar: 'var(--color-shroud)',
  },
  power: {
    glyph: 'flame',
    typeName: 'Power',
    frameClass: 'bg-card-power',
    glowVar: 'var(--color-wrath)',
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
  'Shroud',
  'Wrath',
  'Reach',
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
