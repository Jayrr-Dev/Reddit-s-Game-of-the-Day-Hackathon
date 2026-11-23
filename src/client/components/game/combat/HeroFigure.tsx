// ===================================================================
// HERO FIGURE
// A hero standing on the battlefield, drawn as a full-body SVG
// silhouette tinted by the hero's catalog hue. Wider heroes (elites and
// champions) are drawn broader, not just scaled, so a size 3 champion
// really fills the front row. Elites wear a plume, champions a crown.
// ===================================================================

import type { HeroSize, HeroTier } from '../../../../shared/game/types';
import {
  BODY_HEIGHT,
  BODY_WIDTH,
  headCentreOf,
  headRadiusOf,
} from '../../../lib/heroFigure';

// --- TYPES ---
export type HeroFigureProps = {
  hue: number;
  tier: HeroTier;
  size: HeroSize;
};

// --- COMPONENT ---
/** Draws the hero, feet at the bottom edge, head near the top. */
export const HeroFigure = ({ hue, tier, size }: HeroFigureProps) => {
  const width = BODY_WIDTH[size];
  const mid = width / 2;
  const shoulder = width * 0.42;
  const headRadius = headRadiusOf(size);
  return (
    <svg
      viewBox={`0 0 ${width} ${BODY_HEIGHT}`}
      className="h-full w-full overflow-visible"
      aria-hidden="true"
    >
      {/* SHADOW */}
      <ellipse
        cx={mid}
        cy="97"
        rx={shoulder}
        ry="3"
        fill="black"
        opacity="0.45"
      />
      {/* CLOAK AND BODY (hue is catalog data, so it is computed) */}
      <path
        d={`M${mid - shoulder} 96 L${mid - shoulder * 0.7} 40 Q${mid} 28 ${mid + shoulder * 0.7} 40 L${mid + shoulder} 96Z`}
        fill={`hsl(${hue} 32% 42%)`}
      />
      <path
        d={`M${mid - shoulder * 0.7} 40 Q${mid} 28 ${mid + shoulder * 0.7} 40 L${mid + shoulder * 0.55} 58 L${mid - shoulder * 0.55} 58Z`}
        fill={`hsl(${hue} 25% 58%)`}
      />
      {/* HELMET */}
      <circle
        cx={mid}
        cy={headCentreOf(size)}
        r={headRadius}
        fill={`hsl(${hue} 12% 78%)`}
      />
      <rect
        x={mid - headRadius * 0.75}
        y={28 - headRadius * 0.75}
        width={headRadius * 1.5}
        height="3.5"
        rx="1.5"
        fill={`hsl(${hue} 40% 12%)`}
      />
      {/* WEAPON */}
      <path
        d={`M${mid + shoulder * 0.8} 62 L${mid + shoulder * 1.15} 14 L${mid + shoulder * 1.25} 15 L${mid + shoulder * 0.95} 64Z`}
        fill="hsl(220 15% 85%)"
      />
      {tier === 'elite' && (
        <path
          d={`M${mid} ${30 - headRadius * 1.5} q8 -12 18 -10 q-8 4 -12 14z`}
          fill={`hsl(${hue} 70% 55%)`}
        />
      )}
      {tier === 'champion' && (
        <path
          d={`M${mid - 10} ${26 - headRadius * 1.5} l4 5 6 -9 6 9 4 -5 -2 9 h-16z`}
          fill="hsl(43 75% 58%)"
        />
      )}
    </svg>
  );
};
