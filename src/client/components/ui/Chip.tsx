// ===================================================================
// CHIP (ATOM)
// A small icon + value badge. Two shapes so they read apart at a glance:
// round pills for what a hero is about to do (intents), square tiles for
// effects already in play (statuses such as Shroud, Hex, Wrath).
// ===================================================================

import { Glyph, type GlyphName } from './Glyph';
import { Tooltip, type TooltipContent } from './Tooltip';

export type ChipProps = {
  glyph: GlyphName;
  text: string;
  /** Tailwind text colour class, e.g. "text-hex". */
  toneClass: string;
  /** What the chip means, shown in a tooltip on hover or long press. */
  info?: TooltipContent;
  /** "pill" for intents (default), "square" for active effects. */
  shape?: ChipShape;
};

export type ChipShape = 'pill' | 'square';

const SHAPE_CLASS: Record<ChipShape, string> = {
  pill: 'rounded-full px-1.5',
  square: 'rounded-[3px] px-1',
};

/** Renders one badge, with its tooltip when it has `info`. */
export const Chip = ({ info, ...badge }: ChipProps) =>
  info ? (
    <Tooltip content={info}>
      <Badge {...badge} />
    </Tooltip>
  ) : (
    <Badge {...badge} />
  );

/** The badge itself: icon and value. */
const Badge = ({
  glyph,
  text,
  toneClass,
  shape = 'pill',
}: Omit<ChipProps, 'info'>) => (
  <span
    className={`inline-flex items-center gap-0.5 bg-surface-sunken ${SHAPE_CLASS[shape]} py-0.5 text-[11px] font-bold ring-1 ring-edge ${toneClass}`}
  >
    <Glyph name={glyph} className="size-3" />
    {text}
  </span>
);
