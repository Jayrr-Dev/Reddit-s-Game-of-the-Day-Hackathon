// ===================================================================
// CARD BADGES
// A column of small round icon badges under a card's cost coin: its
// keywords and Imbue gifts (see content/cardBadges.ts). A gift's number
// sits on its badge's bottom corner, and a timed gift ("this turn") has
// a small hourglass on the top corner; an imbued badge has a teal rim.
// Hover (with no button held) or long-press one for its tooltip.
// ===================================================================

import type { CardBadge } from '../../content/cardBadges';
import { Glyph } from '../ui/Glyph';
import { Tooltip } from '../ui/Tooltip';

// --- TYPES ---
/** Badge sizes for a fan card and a full-size card. */
export type BadgeSize = 'fan' | 'offer';

// --- CONSTANTS ---
/** Where the column sits (under the coin) and how big each badge is. */
const SIZE_LOOK: Record<
  BadgeSize,
  {
    column: string;
    badge: string;
    icon: string;
    count: string;
    timer: string;
  }
> = {
  fan: {
    column: '-left-1.5 top-4 gap-0.5',
    badge: 'size-4',
    icon: 'size-2.5',
    count: 'text-[7px] -right-1 -bottom-0.5',
    timer: 'size-2 -right-1 -top-0.5',
  },
  offer: {
    column: '-left-2 top-6 gap-1',
    badge: 'size-5',
    icon: 'size-3',
    count: 'text-[9px] -right-1 -bottom-0.5',
    timer: 'size-2.5 -right-1 -top-0.5',
  },
};

// --- SUBCOMPONENTS ---
/** One badge: its icon in its tone, its number on the corner. */
const Badge = ({ badge, size }: { badge: CardBadge; size: BadgeSize }) => {
  const look = SIZE_LOOK[size];
  return (
    <span
      className={`relative grid ${look.badge} place-items-center rounded-full bg-surface-sunken ring-1 ${badge.isImbued ? 'ring-imbue shadow-[0_0_6px_var(--color-imbue)]' : 'ring-edge'} ${badge.toneClass}`}
    >
      <Glyph name={badge.glyph} className={look.icon} />
      {badge.duration && (
        <span
          className={`absolute ${look.timer} grid place-items-center rounded-full bg-surface-sunken text-imbue`}
        >
          <Glyph name="hourglass" className="size-full p-px" />
        </span>
      )}
      {badge.count !== undefined && (
        <span
          className={`absolute ${look.count} rounded-sm bg-surface-sunken px-px font-display font-black leading-none text-ink`}
        >
          {badge.count}
        </span>
      )}
    </span>
  );
};

// --- COMPONENT ---
/** Renders a card's badges, or nothing when it has none. */
export const CardBadges = ({
  badges,
  size,
}: {
  badges: readonly CardBadge[];
  size: BadgeSize;
}) =>
  badges.length === 0 ? null : (
    <span className={`absolute z-10 flex flex-col ${SIZE_LOOK[size].column}`}>
      {badges.map((badge) => (
        <Tooltip
          key={badge.key}
          content={{ title: badge.title, description: badge.description }}
        >
          <Badge badge={badge} size={size} />
        </Tooltip>
      ))}
    </span>
  );
