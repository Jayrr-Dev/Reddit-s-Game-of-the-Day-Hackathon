// ===================================================================
// CARD BADGES
// A column of round sockets hanging from a card's cost coin on short
// gold stems, like gem settings, each holding one icon: the card's
// Imbue gifts (see content/cardBadges.ts). A gift's number sits in a
// gold corner badge, and each socket glows faintly teal inside.
// Hover (with no button held) or long-press one for its tooltip.
// ===================================================================

import type { CardBadge } from '../../content/cardBadges';
import { Glyph } from '../ui/Glyph';
import { Tooltip } from '../ui/Tooltip';

// --- TYPES ---
/** Badge sizes for a fan card and a full-size card. */
export type BadgeSize = 'fan' | 'offer';

// --- CONSTANTS ---
/**
 * Where the column hangs and how big each socket is. The column is
 * centred under the cost coin (fan coin: 20 px, centre 4 px in from
 * the card's left edge; offer coin: 28 px, centre 6 px in), so `column`
 * puts its middle there and starts just below the coin.
 */
const SIZE_LOOK: Record<
  BadgeSize,
  {
    column: string;
    /** The stem above each socket: long enough to clear the badge above. */
    stem: string;
    socket: string;
    icon: string;
    count: string;
  }
> = {
  fan: {
    column: 'left-1 top-3.5 w-[18px] -translate-x-1/2',
    stem: 'h-[7px]',
    socket: 'size-[18px]',
    icon: 'size-3',
    count: 'min-w-2.5 h-2.5 text-[7px] -right-1 -bottom-1',
  },
  offer: {
    column: 'left-1.5 top-5 w-[22px] -translate-x-1/2',
    stem: 'h-[8px]',
    socket: 'size-[22px]',
    icon: 'size-3.5',
    count: 'min-w-3 h-3 text-[8px] -right-1 -bottom-1',
  },
};

// --- SUBCOMPONENTS ---
/** The short gold stem a socket hangs from (from the coin or the one above). */
const Stem = ({ heightClass }: { heightClass: string }) => (
  <span aria-hidden className={`${heightClass} w-0.5 bg-energy/80`} />
);

/**
 * One socket: a dark gem setting with a gold rim, its icon centred in
 * its tone, a faint teal glow inside, and a gift's number in a gold
 * corner badge.
 */
const Socket = ({ badge, size }: { badge: CardBadge; size: BadgeSize }) => {
  const look = SIZE_LOOK[size];
  const glow =
    'shadow-[inset_0_0_5px_var(--color-imbue),0_1px_2px_rgb(0_0_0/0.6)]';
  return (
    <span
      className={`relative grid ${look.socket} place-items-center rounded-full bg-surface-sunken ring-[1.5px] ring-energy ${glow} ${badge.toneClass}`}
    >
      <Glyph name={badge.glyph} className={look.icon} />
      {badge.count !== undefined && (
        <span
          className={`absolute ${look.count} grid place-items-center rounded-full bg-energy px-0.5 font-display font-black leading-none text-on-accent ring-1 ring-surface-sunken`}
        >
          <span className="num-center">{badge.count}</span>
        </span>
      )}
    </span>
  );
};

// --- COMPONENT ---
/** Renders a card's sockets under its cost coin, or nothing without any. */
export const CardBadges = ({
  badges,
  size,
}: {
  badges: readonly CardBadge[];
  size: BadgeSize;
}) =>
  badges.length === 0 ? null : (
    <span
      className={`absolute z-10 flex flex-col items-center ${SIZE_LOOK[size].column}`}
    >
      {badges.map((badge) => (
        <span key={badge.key} className="flex flex-col items-center">
          <Stem heightClass={SIZE_LOOK[size].stem} />
          <Tooltip
            content={{
              title: badge.title,
              description: badge.description,
              look: badge,
            }}
          >
            <Socket badge={badge} size={size} />
          </Tooltip>
        </span>
      ))}
    </span>
  );
