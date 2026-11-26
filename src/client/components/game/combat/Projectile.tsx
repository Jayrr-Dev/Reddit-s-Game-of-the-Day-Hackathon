// ===================================================================
// PROJECTILE (ATOM)
// One shot flying in a straight line, drawn in viewport pixels on a
// fixed layer: an arrow (Range) or a glowing bolt with a trail (Magic),
// sky-cyan, or in its element's colours (ELEMENT_LOOK). It points along its path and lands at `to`. Used by
// the heroes' arrows (HeroShots) and your own shots (PlayerShots).
// Transform and opacity only (see hero-shot in index.css).
// ===================================================================

import type { CSSProperties } from 'react';
import type { MagicElement } from '../../../../shared/game/types';
import { ELEMENT_LOOK } from '../../../content/visuals';
import type { Point } from '../../../hooks/useCardDrag';
import { CombatFx } from './CombatFx';
import './projectile.css';

// --- TYPES ---
export type ProjectileKind = 'arrow' | 'bolt' | 'lightning';

export type ProjectileFlight = {
  id: number;
  kind: ProjectileKind;
  from: Point;
  to: Point;
  /** Wait before it leaves (ms). */
  delayMs: number;
  /** The bow is facing the camera at release. */
  frontOnRelease?: boolean;
  /** A Magic bolt's element (its colours), if it has one. */
  element?: MagicElement | undefined;
};

// --- CONSTANTS ---
/** A plain (elementless) bolt's trail and head. */
const ARCANE_BOLT = {
  energy: 'var(--color-magic)',
  core: '#eafaff',
};

// --- HELPERS ---
/** Lays the shot along its path (CSS animates the flight). */
const flightStyle = ({ from, to, delayMs }: ProjectileFlight): CSSProperties =>
  ({
    left: from.x,
    top: from.y,
    '--shot-dx': `${to.x - from.x}px`,
    '--shot-dy': `${to.y - from.y}px`,
    '--shot-angle': `${Math.atan2(to.y - from.y, to.x - from.x)}rad`,
    animationDelay: `${delayMs}ms`,
  }) as CSSProperties;

// --- SUBCOMPONENTS ---
/** A wooden arrow with a steel head, pointing right (its tip at 100%). */
const Arrow = () => (
  <svg
    viewBox="0 0 40 8"
    className="h-2.5 w-10 -translate-x-full -translate-y-1/2 [transform-origin:100%_50%] [rotate:var(--shot-angle)]"
    aria-hidden="true"
  >
    <g className="projectile-arrow-shaft">
      <path d="M2 4h30" stroke="#5a3a22" strokeWidth="2" />
      <path d="M40 4 31 0.5v7z" fill="#d8d2d8" />
      <path d="M0 0.5h6l3 3.5H3zM0 7.5h6l3-3.5H3z" fill="#e8e0c8" />
    </g>
  </svg>
);

/** A magic bolt: a bright core with a fading trail in its colours. */
const Bolt = ({ element }: { element?: MagicElement | undefined }) => {
  const { energy, core } = element ? ELEMENT_LOOK[element] : ARCANE_BOLT;
  return (
    <svg
      viewBox="0 0 76 26"
      aria-hidden="true"
      className="h-6 w-[70px] -translate-x-full -translate-y-1/2 [transform-origin:100%_50%] [rotate:var(--shot-angle)]"
    >
      <path
        fill={energy}
        opacity=".4"
        d="M0 19Q18 4 39 11T65 6Q71 8 76 13Q65 25 44 17T0 19Z"
      />
      <path
        fill={energy}
        d="M7 22C29 3 39 16 49 12S64 3 76 13C64 21 56 20 46 16S24 11 7 22Z"
      />
      <path fill={core} d="M28 8Q43 16 54 11T75 13Q65 17 55 15T28 8Z" />
      <path
        fill={energy}
        opacity=".8"
        d="M9 7Q24 2 35 8Q23 5 9 7ZM37 22Q48 18 56 21Q45 20 37 22Z"
      />
    </svg>
  );
};


/** A jagged gold bolt, pointing right like the other projectile shapes. */
const Lightning = () => (
  <svg viewBox="0 0 92 32" aria-hidden="true"
    className="h-8 w-[92px] -translate-x-full -translate-y-1/2 [transform-origin:100%_50%] [rotate:var(--shot-angle)]">
    <path d="M4 23L31 9 37 18 57 6 60 16 91 16 64 25 58 20 35 30 29 21Z" fill="#eca91c" />
    <path d="M19 21L31 14 36 22 58 11 61 19 89 16 63 22 58 17 36 27 30 19Z" fill="#fff8cd" />
    <path d="M31 10L27 3M55 21L49 31M65 16L74 7" stroke="#ffdc54" strokeWidth="2" fill="none" />
  </svg>
);

// --- COMPONENT ---
/** Renders one shot in flight (place it on a fixed, full-screen layer). */
export const Projectile = ({
  flight,
  className = 'animate-hero-shot',
}: {
  flight: ProjectileFlight;
  /** The flight animation (its length is the flight time). */
  className?: string;
}) => (
  <div
    className={`absolute ${className} ${flight.kind === 'bolt' ? 'magic-flight' : ''}`}
    data-projectile-kind={flight.kind}
    data-front-on-release={flight.frontOnRelease || undefined}
    style={flightStyle(flight)}
  >
    {flight.kind === 'arrow' && <CombatFx kind="projectile-speed" delayMs={flight.delayMs} />}
    {flight.kind === 'arrow' && <span aria-hidden="true" className="projectile-arrow-smear" />}
    {flight.kind === 'arrow' ? <Arrow /> : flight.kind === 'lightning' ? <Lightning /> : <Bolt element={flight.element} />}
  </div>
);
