// ===================================================================
// GLYPH (ATOM)
// The game's icon set, drawn as tiny stroke SVGs so they inherit the
// current text colour and need no image assets.
// ===================================================================

// --- TYPES ---
export type GlyphName =
  | 'sword'
  | 'shield'
  | 'skull'
  | 'flame'
  | 'heart'
  | 'crown'
  | 'grave'
  | 'altar'
  | 'bolt'
  | 'eye';

export type GlyphProps = {
  name: GlyphName;
  /** Tailwind size classes, e.g. "size-4". */
  className?: string;
};

// --- PATHS (24 x 24 VIEWBOX) ---
const GLYPH_PATHS: Record<GlyphName, string[]> = {
  sword: ['M14.5 3H21v6.5L10 20.5 3.5 14z', 'M7 13.5l3.5 3.5', 'M3 21l3-3'],
  shield: ['M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z'],
  skull: [
    'M12 3a8 8 0 0 0-8 8c0 2.6 1.3 4.4 3 5.5V20h10v-3.5c1.7-1.1 3-2.9 3-5.5a8 8 0 0 0-8-8z',
    'M9 11h.01',
    'M15 11h.01',
    'M10 20v-2',
    'M14 20v-2',
  ],
  flame: [
    'M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 .8 1.5 1.5 2 2.5 2C11 6 11 4 12 2z',
  ],
  heart: [
    'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  ],
  crown: ['M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z'],
  grave: ['M6 21V10a6 6 0 0 1 12 0v11z', 'M12 9v7', 'M9 12h6', 'M3 21h18'],
  altar: [
    'M4 21h16',
    'M6 21v-7h12v7',
    'M12 14V9',
    'M12 9c-2-1.5-2-4 0-6 2 2 2 4.5 0 6z',
  ],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  eye: [
    'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
};

// --- COMPONENT ---
/** Renders one icon from the set. */
export const Glyph = ({ name, className = 'size-4' }: GlyphProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {GLYPH_PATHS[name].map((path) => (
      <path key={path} d={path} />
    ))}
  </svg>
);
