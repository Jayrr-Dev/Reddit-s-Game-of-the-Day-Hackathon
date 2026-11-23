// ===================================================================
// CHIP (ATOM)
// A small icon + value badge (statuses, intents, energy).
// ===================================================================

import { Glyph, type GlyphName } from './Glyph';

export type ChipProps = {
  glyph: GlyphName;
  text: string;
  /** Tailwind text colour class, e.g. "text-hex". */
  toneClass: string;
  /** Tooltip explaining the chip. */
  title?: string;
};

/** Renders one badge. */
export const Chip = ({ glyph, text, toneClass, title }: ChipProps) => (
  <span
    title={title}
    className={`inline-flex items-center gap-0.5 rounded-full bg-surface-sunken px-1.5 py-0.5 text-[11px] font-bold ring-1 ring-edge ${toneClass}`}
  >
    <Glyph name={glyph} className="size-3" />
    {text}
  </span>
);
