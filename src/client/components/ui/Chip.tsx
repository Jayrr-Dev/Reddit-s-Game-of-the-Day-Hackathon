// ===================================================================
// CHIP (ATOM)
// A small icon + value badge. Two looks so they read apart at a glance:
// what a hero is about to do (intents) are round white pills with a
// black rim; effects already in play (statuses such as Shroud, Hex,
// Wrath) are dark square tiles.
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

/**
 * Each shape's look. On the white pill the number is black and the icon
 * keeps its tone, darkened so the light ones (Magic sky, Range silver,
 * gold) still stand out against white.
 */
const SHAPE_CLASS: Record<ChipShape, string> = {
  pill: 'rounded-full px-1.5 bg-[#fbf8f1] text-black ring-black',
  square: 'rounded-[3px] px-1 bg-surface-sunken ring-edge',
};
const ICON_CLASS: Record<ChipShape, string> = {
  pill: 'brightness-[0.55] saturate-150',
  square: '',
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
    className={`inline-flex items-center gap-0.5 ${SHAPE_CLASS[shape]} py-0.5 text-[11px] font-bold ring-1 ${shape === 'square' ? toneClass : ''}`}
  >
    <span className={`inline-flex ${toneClass} ${ICON_CLASS[shape]}`}>
      <Glyph name={glyph} className="size-3" />
    </span>
    {text}
  </span>
);
