// ===================================================================
// CHIP (ATOM)
// A small icon + value badge. Two shapes so they read apart at a glance:
// round pills for what a hero is about to do (intents), square tiles for
// effects already in play (statuses such as Shroud, Hex, Wrath).
// ===================================================================

import { Glyph, type GlyphName } from './Glyph';

export type ChipProps = {
  glyph: GlyphName;
  text: string;
  /** Tailwind text colour class, e.g. "text-hex". */
  toneClass: string;
  /** Tooltip explaining the chip. */
  title?: string;
  /** "pill" for intents (default), "square" for active effects. */
  shape?: ChipShape;
};

export type ChipShape = 'pill' | 'square';

const SHAPE_CLASS: Record<ChipShape, string> = {
  pill: 'rounded-full px-1.5',
  square: 'rounded-[3px] px-1',
};

/** Renders one badge. */
export const Chip = ({
  glyph,
  text,
  toneClass,
  title,
  shape = 'pill',
}: ChipProps) => (
  <span
    title={title}
    className={`inline-flex items-center gap-0.5 bg-surface-sunken ${SHAPE_CLASS[shape]} py-0.5 text-[11px] font-bold ring-1 ring-edge ${toneClass}`}
  >
    <Glyph name={glyph} className="size-3" />
    {text}
  </span>
);
