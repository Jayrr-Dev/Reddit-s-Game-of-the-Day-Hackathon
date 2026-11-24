// ===================================================================
// HOLY HALO
// The gold halo a holy boss wears, and the effects built on it, shared
// by every haloed creature (the Holy Dragon, the Grand Griffon). All
// sizes are in concept-art units (see lib/creatureArt). The parts play
// through index.css, "BOSS HALO":
//   HaloLight    glow and a wheel of rays, hidden until a signature
//   HaloRing     the ring itself: flares on support, swells on a
//                signature, flickers and cracks on death
//   HaloShards   arcs of the ring that fly apart on death
//   DeathBurst   light bursting out of the body on death
// ===================================================================

import type { CSSProperties } from 'react';
import {
  ART_SCALE,
  art,
  originAt,
  polar,
  pts,
  type Point,
} from '../../../lib/creatureArt';

// --- TYPES ---
/** Where a halo sits and how big it is (art units). */
export type HaloSpec = { centre: Point; radius: number; stroke: number };

// --- CONSTANTS ---
const HALO_GOLD = '#d2a64c';
const HOLY_LIGHT = '#fff0b0';
/** Rays of a signature: count, span (as shares of the radius), width. */
const RAY_COUNT = 12;
const RAY_INNER_SHARE = 1.18;
const RAY_OUTER_SHARE = 2.25;
const RAY_HALF_WIDTH_DEG = 4;
/** The ring breaks into this many shards, flying this far (radius shares). */
const SHARD_COUNT = 8;
const SHARD_GAP_DEG = 6;
const SHARD_FLY_SHARE = 1.5;

// --- HELPERS ---
/** One ray of light: a thin wedge from the halo outward. */
const rayPoints = ({ centre, radius }: HaloSpec, deg: number): Point[] => [
  polar(centre, radius * RAY_INNER_SHARE, deg - RAY_HALF_WIDTH_DEG),
  polar(centre, radius * RAY_OUTER_SHARE, deg),
  polar(centre, radius * RAY_INNER_SHARE, deg + RAY_HALF_WIDTH_DEG),
];

/** An arc of the ring, as an SVG path in viewBox units. */
const arcPath = (
  { centre, radius }: HaloSpec,
  fromDeg: number,
  toDeg: number
): string => {
  const [x1, y1] = art(polar(centre, radius, fromDeg));
  const [x2, y2] = art(polar(centre, radius, toDeg));
  const r = radius * ART_SCALE;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};

// --- COMPONENTS ---
/** The light a signature gathers: a glow behind the halo and rays. */
export const HaloLight = ({ halo }: { halo: HaloSpec }) => {
  const [x, y] = art(halo.centre);
  return (
    <>
      <circle
        className="boss-halo-glow"
        cx={x}
        cy={y}
        r={halo.radius * ART_SCALE * 1.3}
        fill={HOLY_LIGHT}
        opacity="0"
        style={originAt(halo.centre)}
      />
      <g className="boss-rays" opacity="0" style={originAt(halo.centre)}>
        {Array.from({ length: RAY_COUNT }, (_, index) => {
          const deg = (360 / RAY_COUNT) * index;
          return (
            <polygon
              key={deg}
              points={pts(rayPoints(halo, deg))}
              fill={HOLY_LIGHT}
            />
          );
        })}
      </g>
    </>
  );
};

/** The gold ring. */
export const HaloRing = ({ halo }: { halo: HaloSpec }) => {
  const [x, y] = art(halo.centre);
  return (
    <circle
      className="boss-halo"
      cx={x}
      cy={y}
      r={halo.radius * ART_SCALE}
      fill="none"
      stroke={HALO_GOLD}
      strokeWidth={halo.stroke * ART_SCALE}
    />
  );
};

/** The ring's pieces for the death: each arc flies out from its place. */
export const HaloShards = ({ halo }: { halo: HaloSpec }) => {
  const step = 360 / SHARD_COUNT;
  const fly = halo.radius * SHARD_FLY_SHARE * ART_SCALE;
  return (
    <g>
      {Array.from({ length: SHARD_COUNT }, (_, index) => {
        const from = step * index + SHARD_GAP_DEG / 2;
        const [dx, dy] = polar([0, 0], fly, from + step / 2);
        return (
          <path
            key={from}
            className="boss-shard"
            d={arcPath(halo, from, from + step - SHARD_GAP_DEG)}
            fill="none"
            stroke={HALO_GOLD}
            strokeWidth={halo.stroke * ART_SCALE}
            strokeLinecap="round"
            opacity="0"
            style={
              {
                '--dx': `${dx.toFixed(1)}px`,
                '--dy': `${dy.toFixed(1)}px`,
                '--spin': `${index % 2 === 0 ? 40 : -40}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </g>
  );
};

/** The light that bursts from the body (at `at`) as a boss dies. */
export const DeathBurst = ({ at }: { at: Point }) => {
  const [x, y] = art(at);
  return (
    <circle
      className="boss-burst"
      cx={x}
      cy={y}
      r="14"
      fill="#fffbe8"
      opacity="0"
      style={originAt(at)}
    />
  );
};
