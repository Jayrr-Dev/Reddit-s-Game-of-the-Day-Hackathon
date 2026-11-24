// ===================================================================
// CHIP (ATOM)
// A small icon + value badge. Two looks so they read apart at a glance:
// what a hero is about to do (intents) are yellow arrowheads with a
// black rim, pointed on the left and flat on the right ("< |"), like a
// blow coming in; effects already in play (statuses such as Shroud,
// Hex, Wrath) are dark square tiles.
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
  /** "arrow" for intents (default), "square" for active effects. */
  shape?: ChipShape;
};

export type ChipShape = 'arrow' | 'square';

/**
 * The arrowhead outline: a point on the left, flat on the right. The
 * rim is the black shape showing 1px past the white one inside it (a
 * clip-path cuts off borders and rings, so neither can follow it).
 */
const ARROW_CLIP = '[clip-path:polygon(7px_0,100%_0,100%_100%,7px_100%,0_50%)]';

/** The badge's content: the icon in its tone, then the value. */
const BadgeContent = ({
  glyph,
  text,
  iconClass,
}: {
  glyph: GlyphName;
  text: string;
  iconClass: string;
}) => (
  <>
    <span className={`inline-flex ${iconClass}`}>
      <Glyph name={glyph} className="size-3" />
    </span>
    {text}
  </>
);

/** Renders one badge, with its tooltip when it has `info`. */
export const Chip = ({ info, ...badge }: ChipProps) =>
  info ? (
    <Tooltip content={info}>
      <Badge {...badge} />
    </Tooltip>
  ) : (
    <Badge {...badge} />
  );

/**
 * The badge itself. An intent's icon keeps its tone, darkened so the
 * light ones (Magic sky, Range silver, gold) stand out on yellow; its
 * number is black.
 */
const Badge = ({
  glyph,
  text,
  toneClass,
  shape = 'arrow',
}: Omit<ChipProps, 'info'>) =>
  shape === 'square' ? (
    <span
      className={`inline-flex items-center gap-0.5 rounded-[3px] bg-surface-sunken px-1 py-0.5 text-[11px] font-bold ring-1 ring-edge ${toneClass}`}
    >
      <BadgeContent glyph={glyph} text={text} iconClass="" />
    </span>
  ) : (
    <span className={`inline-flex bg-black p-px ${ARROW_CLIP}`}>
      <span
        className={`inline-flex items-center gap-0.5 bg-[#f6d24a] py-px pl-[8px] pr-1.5 text-[11px] font-bold text-black ${ARROW_CLIP}`}
      >
        <BadgeContent
          glyph={glyph}
          text={text}
          iconClass={`${toneClass} brightness-[0.45] saturate-150`}
        />
      </span>
    </span>
  );
