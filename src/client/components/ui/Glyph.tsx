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
  | 'eyeOff'
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
export const Glyph = ({ name, className = 'size-4' }: GlyphProps) => name === 'eyeOff' ? (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M3 3 21 21M6.6 6.6C4.5 8 2.7 10 2 12c2 4 5.7 6.5 10 6.5 1.8 0 3.6-.5 5.1-1.4M10.6 5.6c.5-.1.9-.1 1.4-.1 4.3 0 8 2.5 10 6.5-.5 1.1-1.2 2-2 2.8M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
) : (
  <svg
    viewBox="0 0 512 512"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d={GAME_ICONS[name].path} />
  </svg>
);
