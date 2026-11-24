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

// --- TYPES ---
export type ProjectileKind = 'arrow' | 'bolt';

export type ProjectileFlight = {
  id: number;
  kind: ProjectileKind;
  from: Point;
  to: Point;
  /** Wait before it leaves (ms). */
  delayMs: number;
  /** A Magic bolt's element (its colours), if it has one. */
  element?: MagicElement | undefined;
};

// --- CONSTANTS ---
/** A plain (elementless) bolt's trail and head. */
const ARCANE_BOLT = {
  energy: 'color-mix(in oklab, var(--color-magic) 60%, transparent)',
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
    <path d="M2 4h30" stroke="#5a3a22" strokeWidth="2" />
    <path d="M40 4 31 0.5v7z" fill="#d8d2d8" />
    <path d="M0 0.5h6l3 3.5H3zM0 7.5h6l3-3.5H3z" fill="#e8e0c8" />
  </svg>
);

/** A magic bolt: a bright core with a fading trail in its colours. */
const Bolt = ({ element }: { element?: MagicElement | undefined }) => {
  const { energy, core } = element ? ELEMENT_LOOK[element] : ARCANE_BOLT;
  return (
    <span
      className="block h-2.5 w-12 -translate-x-full -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-(--bolt-energy) to-(--bolt-core) shadow-[0_0_10px_var(--bolt-energy)] [transform-origin:100%_50%] [rotate:var(--shot-angle)]"
      style={{ '--bolt-energy': energy, '--bolt-core': core } as CSSProperties}
      aria-hidden="true"
    />
  );
};

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
  <div className={`absolute ${className}`} style={flightStyle(flight)}>
    {flight.kind === 'arrow' ? <Arrow /> : <Bolt element={flight.element} />}
  </div>
);
