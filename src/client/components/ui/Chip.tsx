// ===================================================================
// CHIP (ATOM)
// A small icon + value badge. Two looks so they read apart at a glance:
// what a hero is about to do (intents) are arrowheads with a black
// rim, pointed on the left and flat on the right ("< |"), like a blow
// coming in, filled with the colour of what they do (black icon and
// number); effects already in play (statuses such as Shroud,
// Hex, Wrath) are dark square tiles.
// ===================================================================

import { toneVarOf } from '../../content/visuals';
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
  /** An arrow's fill (a CSS colour); its tone's colour when left out. */
  fill?: string;
  /**
   * More icon + value pairs drawn inside the same badge, after the
   * first (an intent's secondary effects: one move, one arrow).
   */
  extras?: readonly ChipPart[];
};

/** One icon + value inside a badge. */
export type ChipPart = { glyph: GlyphName; text: string };

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
 * The badge itself. A square keeps its icon and number in its tone on
 * a dark tile; an arrow is filled with its tone (or `fill`), its icon
 * and number solid black.
 */
const Badge = ({
  glyph,
  text,
  toneClass,
  shape = 'arrow',
  fill,
  extras = [],
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
        className={`inline-flex items-center gap-0.5 py-px pl-[8px] pr-1.5 text-[11px] font-bold text-black ${ARROW_CLIP}`}
        style={{ backgroundColor: fill ?? toneVarOf({ glyph, toneClass }) }}
      >
        <BadgeContent glyph={glyph} text={text} iconClass="" />
        {extras.map((part, index) => (
          <span
            key={`${part.glyph}-${index}`}
            className="ml-0.5 inline-flex items-center gap-0.5 border-l border-black/40 pl-1"
          >
            <BadgeContent glyph={part.glyph} text={part.text} iconClass="" />
          </span>
        ))}
      </span>
    </span>
  );
