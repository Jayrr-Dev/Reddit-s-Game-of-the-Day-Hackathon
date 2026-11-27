// ===================================================================
// GROUND SHADOW
// The shadow a unit casts on the spot it is stationed on. It is drawn
// apart from the unit: never inside the body's animated wrappers (sway,
// lunge, flinch, flight), so it stays on the ground while the body
// moves. It reads one number, the unit's lift (index.css, UNIT LIFT),
// and shrinks and fades as the unit rises off its spot for any reason.
// ===================================================================

import type { CSSProperties } from 'react';
import type { HeroUnit } from '../../../../shared/game/types';
import { groundShadowOf, isBoss } from '../../../content/heroLooks';

// --- TYPES ---
export type GroundShadowProps = {
  unit: HeroUnit;
  /**
   * The body's box at rest (HeroOnField, bodyStyleOf): its bottom edge
   * is the ground point the unit is stationed on, its width sizes the
   * shadow.
   */
  restStyle: CSSProperties;
  /** When a marching hero sets off (ms); the shadow walks in with it. */
  marchDelayMs: number;
};

// --- HELPERS ---
/**
 * The shadow's size and how it answers lift, as CSS variables read by
 * .ground-shadow (index.css).
 */
const shadowVars = (unit: HeroUnit): CSSProperties => {
  const { halfWidthShare, opacity, liftedScale, liftedFade } = groundShadowOf(
    unit.heroId
  );
  return {
    width: `${halfWidthShare * 200}%`,
    ['--shadow-opacity' as string]: opacity,
    ['--shadow-lifted-scale' as string]: liftedScale,
    ['--shadow-lifted-fade' as string]: liftedFade,
  };
};

// --- COMPONENT ---
/**
 * The unit's ground shadow. A boss's lands with it (its entrance is a
 * lift); a hero's walks in with its march, which travels the ground.
 */
export const GroundShadow = ({
  unit,
  restStyle,
  marchDelayMs,
}: GroundShadowProps) => {
  const isMarching = !isBoss(unit);
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 origin-bottom ${isMarching ? 'animate-hero-march' : ''}`}
      style={isMarching ? { animationDelay: `${marchDelayMs}ms` } : undefined}
    >
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={restStyle}
      >
        <div
          className="ground-shadow absolute bottom-0 left-1/2 h-[9%] -translate-x-1/2"
          style={shadowVars(unit)}
        />
      </div>
    </div>
  );
};

/** The Citadel floor sits below the visible combat lanes. The pool glides
 * with Mikhael's lane, but never inherits his body's lift or action poses. */
export const MikhaelFloorShadow = ({
  unit,
  slot,
  top,
}: {
  unit: HeroUnit;
  slot: CSSProperties;
  top: number;
}) => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute h-0 transition-[top,left,width] duration-500 ease-in-out motion-reduce:transition-none"
    style={{ left: slot.left, width: slot.width, top: `${top}%` }}
  >
    <div
      data-mikhael-floor-shadow=""
      className="ground-shadow absolute left-1/2 -translate-1/2"
      style={{
        ...shadowVars(unit),
        width: 'min(72%, 13rem)',
        aspectRatio: '7 / 1',
        minHeight: '5px',
        maxHeight: '21px',
        ['--aloft-height' as string]: 1,
      }}
    />
  </div>
);
