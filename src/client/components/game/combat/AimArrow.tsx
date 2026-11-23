// ===================================================================
// AIM ARROW
// The targeting line drawn while a card is dragged: a curved, dashed
// arrow from the card to the finger. It turns gold when letting go
// would play the card, and stays grey when it would not.
// Drawn in viewport pixels on a fixed, click-through layer, so it
// lines up with the pointer however the scene is transformed.
// ===================================================================

import type { Point } from '../../../hooks/useCardDrag';

// --- TYPES ---
export type AimArrowProps = {
  from: Point;
  to: Point;
  /** True when dropping here would play the card. */
  isLive: boolean;
};

// --- CONSTANTS ---
const ARROW_MARKER_ID = 'aim-arrow-head';
const LIVE_COLOR = 'var(--color-accent)';
const IDLE_COLOR = 'var(--color-ink-muted)';

// --- HELPERS ---
/**
 * A quadratic curve whose bend sits straight above the card, so the
 * line rises out of the hand before swinging toward the target.
 */
const curvePath = (from: Point, to: Point): string =>
  `M ${from.x} ${from.y} Q ${from.x} ${to.y} ${to.x} ${to.y}`;

// --- COMPONENT ---
/** Renders the arrow, or nothing until the drag has moved. */
export const AimArrow = ({ from, to, isLive }: AimArrowProps) => {
  const color = isLive ? LIVE_COLOR : IDLE_COLOR;
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <marker
          id={ARROW_MARKER_ID}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill={color} />
        </marker>
      </defs>
      <path
        d={curvePath(from, to)}
        fill="none"
        stroke="black"
        strokeOpacity="0.5"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={curvePath(from, to)}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="10 7"
        markerEnd={`url(#${ARROW_MARKER_ID})`}
      />
      {isLive && (
        <circle
          cx={to.x}
          cy={to.y}
          r="14"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
        />
      )}
    </svg>
  );
};
