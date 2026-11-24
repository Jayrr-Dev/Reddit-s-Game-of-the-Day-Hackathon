// ===================================================================
// AIM ARROW
// The targeting line drawn while a card is dragged: a curved arrow from
// the dragged card to the aim tip. It starts thin at the card and grows
// thicker toward the head, drawn as a chain of dashes whose width
// increases along the curve. It turns gold (with a lock ring) when
// letting go would play the card, and stays grey when it would not.
// When the play would kill the locked hero, a skull replaces the ring.
// When the locked hero boosts the card's damage (a long-range shot), the
// bonus ("×1.3") shows just right of the tip.
// Drawn in viewport pixels on a fixed, click-through layer.
// ===================================================================

import type { Point } from '../../../hooks/useCardDrag';

// --- TYPES ---
export type AimArrowProps = {
  from: Point;
  to: Point;
  /** True when dropping here would play the card. */
  isLive: boolean;
  /** True when dropping here would kill the hero (skull, not ring). */
  isLethal?: boolean;
  /** The damage multiplier this target gives (1 = none, no label). */
  damageFactor?: number;
  /** 0 = full arrow; toward 1 it shrinks into the card and fades out. */
  retract?: number;
};

type Dash = { start: Point; end: Point; width: number };

// --- CONSTANTS ---
const LIVE_COLOR = 'var(--color-accent)';
const IDLE_COLOR = 'var(--color-ink-muted)';
/** Number of steps the curve is cut into (every other one is drawn). */
const STEPS = 22;
/** Line width (px) at the card and at the head. */
const WIDTH_AT_CARD = 1.5;
const WIDTH_AT_HEAD = 9;
/** Arrow head length and half-width (px). */
const HEAD_LENGTH = 20;
const HEAD_HALF_WIDTH = 12;
/** How thin a fully pulled-back arrow gets (share of its width). */
const RETRACT_MIN_SCALE = 0.3;
/** Radius of the lock ring drawn on a live target (px). */
const LOCK_RING_RADIUS = 16;
/** Gap (px) between the tip's ring and the bonus label. */
const BONUS_GAP_PX = 6;

// --- GEOMETRY ---
/** How far along the rise (share of the height) the bend sits. */
const BEND_RISE = 0.6;
/** How far toward the target's side (share of the width) it sits. */
const BEND_SIDE = 0.25;

/**
 * The curve's control point. It sits mostly above the card and only a
 * little toward the target's side, so the bend grows with the sideways
 * offset: a target straight above gets a straight line, one off to the
 * side gets a gentle arc. (Putting it level with the target made the
 * line rise then turn sharply sideways, with the head coming in flat.)
 */
const controlOf = (from: Point, to: Point): Point => ({
  x: from.x + (to.x - from.x) * BEND_SIDE,
  y: from.y + (to.y - from.y) * BEND_RISE,
});

/** A point on the quadratic curve at t (0..1). */
const curveAt = (from: Point, to: Point, t: number): Point => {
  const control = controlOf(from, to);
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
};

/** Linear blend between two numbers. */
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Linear blend between two points. */
const lerpPoint = (a: Point, b: Point, t: number): Point => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
});

/** Where the body stops (t), so it ends at the head's base. */
const bodyEndT = (from: Point, to: Point): number => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return length > HEAD_LENGTH ? 1 - HEAD_LENGTH / length : 0;
};

/**
 * The dashes along the curve, stopping at the head. Every other step is
 * a gap; each dash is wider than the one before.
 */
const dashesFor = (from: Point, to: Point, scale: number): Dash[] => {
  const endT = bodyEndT(from, to);
  return Array.from({ length: STEPS }, (_, step) => step)
    .filter((step) => step % 2 === 0)
    .map((step) => {
      const t0 = step / STEPS;
      const t1 = (step + 1) / STEPS;
      return {
        start: curveAt(from, to, t0 * endT),
        end: curveAt(from, to, t1 * endT),
        width: lerp(WIDTH_AT_CARD, WIDTH_AT_HEAD, t1) * scale,
      };
    });
};

/**
 * The arrow head: a triangle along the curve's final tangent, which for
 * a quadratic curve runs from the control point to the end point.
 */
const headPoints = (from: Point, to: Point, scale: number): string => {
  const control = controlOf(from, to);
  const angle = Math.atan2(to.y - control.y, to.x - control.x);
  const base = {
    x: to.x - Math.cos(angle) * HEAD_LENGTH * scale,
    y: to.y - Math.sin(angle) * HEAD_LENGTH * scale,
  };
  const side = { x: -Math.sin(angle), y: Math.cos(angle) };
  const left = {
    x: base.x + side.x * HEAD_HALF_WIDTH * scale,
    y: base.y + side.y * HEAD_HALF_WIDTH * scale,
  };
  const right = {
    x: base.x - side.x * HEAD_HALF_WIDTH * scale,
    y: base.y - side.y * HEAD_HALF_WIDTH * scale,
  };
  return [to, left, right].map((p) => `${p.x},${p.y}`).join(' ');
};

// --- SUBCOMPONENTS ---
/** One pass of the dashed body (used for the shadow and the colour). */
const ArrowBody = ({
  dashes,
  color,
  extraWidth = 0,
  opacity = 1,
}: {
  dashes: Dash[];
  color: string;
  extraWidth?: number;
  opacity?: number;
}) => (
  <g stroke={color} strokeLinecap="round" strokeOpacity={opacity}>
    {dashes.map((dash, index) => (
      <line
        key={index}
        x1={dash.start.x}
        y1={dash.start.y}
        x2={dash.end.x}
        y2={dash.end.y}
        strokeWidth={dash.width + extraWidth}
      />
    ))}
  </g>
);

/**
 * A skull centred on the tip, in place of the lock ring: a round cranium
 * over a narrower jaw, dark eye sockets and nose, and tooth gaps. Drawn
 * on a 32-unit box and scaled to the ring's size.
 */
const LethalSkull = ({ at, color }: { at: Point; color: string }) => {
  const size = LOCK_RING_RADIUS * 2.2;
  return (
    <g
      transform={`translate(${at.x - size / 2} ${at.y - size / 2}) scale(${size / 32})`}
    >
      <path
        d="M16 2C8.8 2 4 7 4 13.5c0 3.6 1.6 6 3.8 7.4V26a2 2 0 0 0 2 2h12.4a2 2 0 0 0 2-2v-5.1c2.2-1.4 3.8-3.8 3.8-7.4C28 7 23.2 2 16 2Z"
        fill={color}
        stroke="black"
        strokeOpacity="0.6"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g fill="#1b1022">
        <ellipse cx="11" cy="14" rx="3.4" ry="3.8" />
        <ellipse cx="21" cy="14" rx="3.4" ry="3.8" />
        <path d="M16 18.5l-2 3.5h4Z" />
        <rect x="12.6" y="24" width="1.4" height="4" />
        <rect x="15.3" y="24" width="1.4" height="4" />
        <rect x="18" y="24" width="1.4" height="4" />
      </g>
    </g>
  );
};

/** The target's damage bonus beside the tip, e.g. "×1.3". */
const BonusLabel = ({ at, factor }: { at: Point; factor: number }) => (
  <text
    x={at.x + LOCK_RING_RADIUS + BONUS_GAP_PX}
    y={at.y}
    dominantBaseline="central"
    className="fill-range font-display text-base font-black [paint-order:stroke_fill]"
    stroke="black"
    strokeWidth="3"
    strokeLinejoin="round"
  >
    {`×${factor}`}
  </text>
);

// --- COMPONENT ---
/** Renders the tapered arrow, its head and (when live) a ring or skull. */
export const AimArrow = ({
  from,
  to,
  isLive,
  isLethal = false,
  damageFactor = 1,
  retract = 0,
}: AimArrowProps) => {
  if (retract >= 1) return null;
  // PULL-BACK: the tip slides back toward the card while the arrow thins
  // and fades, all by the same share.
  const end = lerpPoint(from, to, 1 - retract);
  const scale = lerp(1, RETRACT_MIN_SCALE, retract);
  const color = isLive ? LIVE_COLOR : IDLE_COLOR;
  const dashes = dashesFor(from, end, scale);
  const head = headPoints(from, end, scale);
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      style={{ opacity: 1 - retract }}
      aria-hidden="true"
    >
      <ArrowBody dashes={dashes} color="black" extraWidth={3} opacity={0.5} />
      <polygon
        points={head}
        fill="black"
        fillOpacity="0.5"
        stroke="black"
        strokeOpacity="0.5"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <ArrowBody dashes={dashes} color={color} />
      <polygon points={head} fill={color} />
      {isLive && isLethal && <LethalSkull at={to} color={color} />}
      {isLive && damageFactor !== 1 && (
        <BonusLabel at={to} factor={damageFactor} />
      )}
      {isLive && !isLethal && (
        <circle
          cx={to.x}
          cy={to.y}
          r={LOCK_RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
        />
      )}
    </svg>
  );
};
