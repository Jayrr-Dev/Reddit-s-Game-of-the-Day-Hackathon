// ===================================================================
// PICK MARK
// The red mark on a hero picked by a held Target N card, drawn over the
// body until the card fires:
//   crosshair  Range and Magic cards (a scope ring with four ticks)
//   slash      Melee cards (offset slashes: two, plus one per repeat
//              pick, up to three)
// A hero picked more than once also shows "xN". Each new pick re-keys
// the mark, so it snaps in again.
// ===================================================================

import type { PickMarker } from '../../../hooks/useCombatControls';

// --- CONSTANTS ---
/** Most slashes drawn; more picks than this show only in the count. */
const MAX_SLASHES = 3;
/** How far (in viewBox units) each extra slash sits from the last. */
const SLASH_OFFSET = 9;
const STROKE = 'var(--color-hp)';

// --- SUBCOMPONENTS ---
/** A scope ring with a dot and four ticks. */
const Crosshair = () => (
  <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
    <circle
      cx="20"
      cy="20"
      r="12"
      fill="none"
      stroke={STROKE}
      strokeWidth="3"
    />
    <circle cx="20" cy="20" r="2.2" fill={STROKE} />
    {/* TICKS: top, bottom, left, right; each crosses the ring */}
    <path
      d="M20 2v10M20 28v10M2 20h10M28 20h10"
      stroke={STROKE}
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

/** Diagonal slashes, each shifted down-right of the one before. */
const Slashes = ({ count }: { count: number }) => {
  // Two slashes read as a cut even for one pick; repeats add one more.
  const shown = Math.min(count + 1, MAX_SLASHES);
  // Centre the group: shift back by half the total spread.
  const start = -((shown - 1) * SLASH_OFFSET) / 2;
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
      {Array.from({ length: shown }, (_, index) => {
        const shift = start + index * SLASH_OFFSET;
        return (
          <path
            key={index}
            d={`M${6 + shift} ${32 + shift / 2}L${34 + shift} ${8 + shift / 2}`}
            stroke={STROKE}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

// --- COMPONENT ---
/** Renders one hero's pick mark and, for repeat picks, its count. */
export const PickMark = ({ marker }: { marker: PickMarker }) => (
  <div
    key={marker.count}
    className="pointer-events-none absolute left-1/2 top-[40%] z-10 aspect-square w-[min(60%,4rem)] -translate-x-1/2 -translate-y-1/2"
  >
    <div className="h-full w-full animate-pick-mark drop-shadow-[0_0_6px_var(--color-hp)]">
      {marker.kind === 'crosshair' ? (
        <Crosshair />
      ) : (
        <Slashes count={marker.count} />
      )}
    </div>
    {marker.count > 1 && (
      <span className="absolute -right-2 -top-1 rounded-full bg-hp px-1.5 font-display text-xs font-bold leading-tight text-white shadow">
        ×{marker.count}
      </span>
    )}
  </div>
);
