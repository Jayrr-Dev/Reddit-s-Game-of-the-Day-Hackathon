// ===================================================================
// GLYPH (ATOM)
// The game's icon set: game-icons.net artwork (CC BY 3.0, see
// content/gameIcons.ts), drawn as inline SVG so it inherits the current
// text colour and needs no image assets.
// ===================================================================

import { GAME_ICONS } from '../../content/gameIcons';

// --- TYPES ---
export type GlyphName =
  | 'sword'
  | 'bow'
  | 'swirl'
  | 'shield'
  | 'skull'
  | 'flame'
  | 'heart'
  | 'crown'
  | 'grave'
  | 'altar'
  | 'bolt'
  | 'eye'
  | 'cog'
  | 'hourglass'
  | 'march'
  | 'wing'
  | 'drop'
  | 'fist'
  | 'snowflake'
  | 'wound'
  | 'aegis'
  | 'shatter'
  | 'anchor'
  | 'padlock'
  | 'arrowhead'
  | 'ghost'
  | 'cards'
  | 'cardBurn'
  | 'battleAxe'
  | 'sprint'
  | 'potion'
  | 'plus'
  | 'targeting'
  | 'flask'
  | 'crackedShield'
  | 'heartbeat'
  | 'breastplate'
  | 'dagger'
  | 'hammer'
  | 'dodging'
  | 'back'
  | 'speaker'
  | 'close'
  | 'book'
  | 'trash';

export type GlyphProps = {
  name: GlyphName;
  /** Tailwind size classes, e.g. "size-4". */
  className?: string;
};

// --- COMPONENT ---
/** Renders one icon from the set, filled with the current text colour. */
export const Glyph = ({ name, className = 'size-4' }: GlyphProps) => (
  <svg
    viewBox="0 0 512 512"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d={GAME_ICONS[name].path} />
  </svg>
);
