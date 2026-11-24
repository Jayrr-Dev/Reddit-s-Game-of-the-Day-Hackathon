// ===================================================================
// IMBUE BADGES
// The gifts a card in hand carries from Imbue cards, stacked at the top
// of its art window: a teal pill per imbue with a short tag ("Hold",
// "3 Poison") and how long it lasts (a dot for this turn, a ring for
// the whole battle, spelled out for screen readers).
// ===================================================================

import { imbueTag, DURATION_LABEL } from '../../../shared/game/describe';
import type { Imbue, ImbueDuration } from '../../../shared/game/types';

// --- CONSTANTS ---
/** The mark for each duration: a dot wears off, a ring lasts. */
const DURATION_MARK: Record<ImbueDuration, string> = {
  turn: 'size-1 bg-imbue',
  battle: 'size-1.5 ring-1 ring-imbue',
};

// --- COMPONENT ---
/** Renders a card's imbues, or nothing when it has none. */
export const ImbueBadges = ({ imbues }: { imbues: readonly Imbue[] }) =>
  imbues.length === 0 ? null : (
    <span className="pointer-events-none absolute inset-x-0.5 top-0.5 z-10 flex flex-col items-center gap-px">
      {imbues.map(({ gift, duration }, index) => (
        <span
          key={index}
          className="flex max-w-full items-center gap-0.5 truncate rounded-full bg-surface-sunken/90 px-1 font-bold leading-tight text-imbue ring-1 ring-imbue/70 text-[6px]"
        >
          <span
            className={`shrink-0 rounded-full ${DURATION_MARK[duration]}`}
          />
          {imbueTag(gift)}
          <span className="sr-only"> {DURATION_LABEL[duration]}</span>
        </span>
      ))}
    </span>
  );
