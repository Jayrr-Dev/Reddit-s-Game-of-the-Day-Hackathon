// ===================================================================
// PICK MARK
// The red mark on a hero picked by a held Target N card, drawn over the
// body until the card fires:
//   crosshair  Range and Magic cards (a scope ring with four ticks)
//   slash      Melee cards (thin red offset slices: one per pick,
//              up to three)
// A hero picked more than once also shows "xN". Each new pick re-keys
// the mark, so it snaps in again.
// ===================================================================

import type { PickMarker } from '../../../hooks/useCombatControls';
import { Slice } from './Slice';

// --- CONSTANTS ---
/** Most slashes drawn; more picks than this show only in the count. */
const MAX_SLASHES = 3;
/** How far (px, down and right) each extra slash sits from the last. */
const SLASH_OFFSET_PX = 7;
/** Each pick's slice angle (deg), clearly apart so the cuts cross. */
const SLASH_ANGLES = [-40, 25, -5] as const;
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

/**
 * One thin red slice per pick, each offset down and to the side of
 * the last, at slightly different angles and lengths.
 */
const Slashes = ({ count }: { count: number }) => {
  const shown = Math.min(count, MAX_SLASHES);
  return (
    <div className="relative h-full w-full">
      {Array.from({ length: shown }, (_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2"
          style={{
            width: `${92 - index * 10}%`,
            transform: `translate(-50%, -50%) translate(${(index - (shown - 1) / 2) * SLASH_OFFSET_PX}px, ${(index - (shown - 1) / 2) * SLASH_OFFSET_PX}px) rotate(${SLASH_ANGLES[index] ?? 0}deg)`,
          }}
        >
          <Slice halfThickness={2.4 - index * 0.3} />
        </span>
      ))}
    </div>
  );
};

// --- COMPONENT ---
/** Renders one hero's pick mark and, for repeat picks, its count. */
export const PickMark = ({ marker }: { marker: PickMarker }) => (
  <div
    key={marker.count}
    className="pointer-events-none absolute left-1/2 top-[40%] z-10 aspect-square w-[min(60%,4rem)] -translate-x-1/2 -translate-y-1/2"
  >
    <div
      className={`h-full w-full animate-pick-mark ${marker.kind === 'crosshair' ? 'drop-shadow-[0_0_6px_var(--color-hp)]' : ''}`}
    >
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
