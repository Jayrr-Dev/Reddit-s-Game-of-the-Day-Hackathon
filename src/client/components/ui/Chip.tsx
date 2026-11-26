// ===================================================================
// CHIP (ATOM)
// A small icon + value badge. Two looks so they read apart at a glance:
// what a hero is about to do (intents) are arrowheads with a black
// rim, pointed on the left and flat on the right ("< |"), like a blow
// coming in, filled with the colour of what they do (black icon and
// number); effects already in play (statuses such as Guard,
// Hex, Wrath) are dark square tiles, and a boss passive (Vigor) is a
// gold one.
// ===================================================================

import type { ReactNode } from 'react';
import { toneVarOf } from '../../content/visuals';
import { Glyph, type GlyphName } from './Glyph';
import { Tooltip, type TooltipContent } from './Tooltip';

export type ChipProps = {
  glyph: GlyphName;
  text: string;
  hoverText?: string | undefined;
  /** Tailwind text colour class, e.g. "text-hex". */
  toneClass: string;
  /** What the chip means, shown in a popover when clicked or tapped. */
  info?: TooltipContent;
  /** "arrow" for intents (default), "square" for active effects. */
  shape?: ChipShape;
  /**
   * A fill (a CSS colour) with a black icon and number. An arrow takes
   * its tone's colour when left out; a square stays a dark tile.
   */
  fill?: string | undefined;
  /**
   * More icon + value pairs drawn inside the same badge, after the
   * first (an intent's secondary effects: one move, one arrow).
   */
  extras?: readonly ChipPart[];
  /** A drawing in place of the glyph (e.g. Shock's filling drop). */
  icon?: ReactNode;
  /** Turns left before this effect wears off, shown as an hourglass and a number. */
  turnsLeft?: number | undefined;
};

// --- TURNS LEFT ---
/** Where the countdown sits: inline at a chip's end, or a tile's top-left corner. */
type TurnsLeftPlacement = 'inline' | 'corner';

/**
 * PLACEMENT LOOKS: inline sits after a divider inside the chip; the
 * corner tab mirrors a tile's value tab (bottom-right) so both read as
 * labels on the tile rather than floating marks.
 */
const TURNS_LEFT_CLASS: Record<TurnsLeftPlacement, string> = {
  inline: 'border-l border-current/30 pl-0.5 text-[10px] opacity-80',
  corner: 'absolute left-0 top-0 rounded-br-sm bg-black/90 pr-px text-[9px] text-white',
};

/**
 * A timed effect's countdown: an hourglass and the turns left, e.g. "⌛2".
 * It replaced a column of 2px dots that read as a stray minus sign.
 */
export const TurnsLeft = ({ turns, placement = 'inline' }: { turns: number; placement?: TurnsLeftPlacement }) => (
  <span aria-hidden="true" data-turns-left={turns}
    className={`pointer-events-none inline-flex shrink-0 items-center leading-none font-bold tabular-nums ${TURNS_LEFT_CLASS[placement]}`}>
    <Glyph name="hourglass" className={placement === 'corner' ? 'size-2' : 'size-2.5'} />
    {turns}
  </span>
);

/** One icon + value inside a badge. */
export type ChipPart = { glyph: GlyphName; text: string; hoverText?: string | undefined; fill?: string | undefined };

export type ChipShape = 'arrow' | 'square';

/**
 * The arrowhead outline: a point on the left, flat on the right. The
 * rim is the black shape showing 1px past the white one inside it (a
 * clip-path cuts off borders and rings, so neither can follow it).
 */
const ARROW_CLIP = '[clip-path:polygon(7px_0,100%_0,100%_100%,7px_100%,0_50%)]';

/** The badge's content: the icon (or a drawing) in its tone, then the value. */
const BadgeContent = ({
  glyph,
  text,
  iconClass,
  icon,
  hoverText,
}: {
  glyph: GlyphName;
  text: string;
  iconClass: string;
  icon?: ReactNode;
  hoverText?: string | undefined;
}) => (
  <>
    <span className={`chip-icon inline-flex ${iconClass}`}>
      {icon ?? <Glyph name={glyph} className="size-3" />}
    </span>
    {hoverText ? (
      <span className="relative text-center tabular-nums" data-intent-damage>
        <span className="group-hover/intent:invisible group-focus-visible/intent:invisible">{text}</span>
        <span aria-hidden="true" className="invisible absolute inset-0 group-hover/intent:visible group-focus-visible/intent:visible">
          {hoverText}
        </span>
      </span>
    ) : text}
  </>
);

// --- ARROW SEGMENTS ---
/** Where a segment sits in its arrow; it decides the segment's padding. */
type SegmentPosition = 'only' | 'first' | 'middle' | 'last';

/**
 * PADDING PER POSITION: the point side leaves room for the arrowhead,
 * the flat side closes the badge, and inner edges sit on a divider.
 */
const SEGMENT_PADDING: Record<SegmentPosition, string> = {
  only: 'pl-[8px] pr-1.5',
  first: 'pl-[8px] pr-1',
  middle: 'border-l border-black/40 pl-1 pr-1',
  last: 'border-l border-black/40 pl-1 pr-1.5',
};

/**
 * One coloured part of an arrow (its lead effect or a follow-up). Each
 * segment paints its own padding, right to the badge's edges, so a
 * part's colour never shows behind another (the lead's blue used to
 * peek out past a red follow-up on the flat end).
 */
const ArrowSegment = ({ fill, position, children }: {
  fill: string;
  position: SegmentPosition;
  children: ReactNode;
}) => (
  <span
    className={`inline-flex items-center gap-0.5 py-px ${SEGMENT_PADDING[position]}`}
    style={{ backgroundColor: fill }}
  >
    {children}
  </span>
);

/** The lead segment's colour: the given fill, else the tone's own colour. */
const leadFillOf = (fill: string | undefined, glyph: GlyphName, toneClass: string): string =>
  fill ?? toneVarOf({ glyph, toneClass });

/** Renders one badge, with its tooltip when it has `info`. */
export const Chip = ({ info, ...badge }: ChipProps) =>
  info ? (
    <Tooltip content={info} opensOn="click">
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
  hoverText,
  toneClass,
  shape = 'arrow',
  fill,
  extras = [],
  icon,
  turnsLeft,
}: Omit<ChipProps, 'info'>) =>
  shape === 'square' ? (
    <span
      className={`inline-flex items-center gap-0.5 rounded-[3px] px-1 py-0.5 text-[11px] font-bold ring-1 ${fill ? 'text-black ring-black' : `bg-surface-sunken ring-edge ${toneClass}`}`}
      style={fill ? { backgroundColor: fill } : undefined}
    >
      <BadgeContent glyph={glyph} text={text} iconClass="" icon={icon} />
      {turnsLeft !== undefined && <TurnsLeft turns={turnsLeft} />}
    </span>
  ) : (
    <span
      className={`group/intent inline-flex bg-black p-px focus-visible:bg-accent ${ARROW_CLIP}`}
      tabIndex={hoverText || extras.some(part => part.hoverText) ? 0 : undefined}
    >
      <span className={`inline-flex items-stretch text-[11px] font-bold text-black ${ARROW_CLIP}`}>
        <ArrowSegment
          fill={leadFillOf(fill, glyph, toneClass)}
          position={extras.length ? 'first' : 'only'}
        >
          <BadgeContent glyph={glyph} text={text} hoverText={hoverText} iconClass="" />
        </ArrowSegment>
        {extras.map((part, index) => (
          <ArrowSegment
            key={`${part.glyph}-${index}`}
            fill={part.fill ?? leadFillOf(fill, glyph, toneClass)}
            position={index === extras.length - 1 ? 'last' : 'middle'}
          >
            <BadgeContent glyph={part.glyph} text={part.text} hoverText={part.hoverText} iconClass="" />
          </ArrowSegment>
        ))}
      </span>
    </span>
  );
