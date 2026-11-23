// ===================================================================
// VISUAL MAPPINGS
// Which icon and token colour each game concept uses. Components read
// these tables instead of choosing colours inline, so the look of a
// status or card type is defined once.
// ===================================================================

import type { CardCategory, IntentKind } from '../../shared/game/describe';
import type { StopKind } from '../../shared/game/kingdom';
import type { StatusId } from '../../shared/game/types';
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
export const CARD_LOOK: Record<
  CardCategory,
  { glyph: GlyphName; frameClass: string }
> = {
  strike: { glyph: 'sword', frameClass: 'bg-card-strike' },
  curse: { glyph: 'skull', frameClass: 'bg-card-curse' },
  guard: { glyph: 'shield', frameClass: 'bg-card-guard' },
  power: { glyph: 'flame', frameClass: 'bg-card-power' },
};

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
