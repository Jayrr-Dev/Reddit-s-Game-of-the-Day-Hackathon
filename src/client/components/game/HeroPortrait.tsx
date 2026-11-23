// ===================================================================
// HERO PORTRAIT
// A heraldic bust drawn in SVG: helmet and shoulders over a coloured
// field. Elites wear a plume and champions a crown. Each hero's hue is
// part of its catalog data, so no image files are needed.
// ===================================================================

import type { HeroTier } from '../../../shared/game/types';

export type HeroPortraitProps = {
  hue: number;
  tier: HeroTier;
};

/** Draws the portrait; the hero's hue tints the field and armour. */
export const HeroPortrait = ({ hue, tier }: HeroPortraitProps) => (
  <svg viewBox="0 0 64 64" className="size-full" aria-hidden="true">
    {/* FIELD (hero hue is catalog data, so it is computed, not a token) */}
    <circle cx="32" cy="32" r="31" fill={`hsl(${hue} 40% 22%)`} />
    {/* SHOULDERS */}
    <path
      d="M12 60c2-12 10-17 20-17s18 5 20 17z"
      fill={`hsl(${hue} 30% 55%)`}
    />
    {/* HELMET */}
    <path
      d="M20 34c0-10 5-17 12-17s12 7 12 17v6H20z"
      fill={`hsl(${hue} 15% 75%)`}
    />
    {/* VISOR SLIT */}
    <rect
      x="24"
      y="30"
      width="16"
      height="3"
      rx="1.5"
      fill={`hsl(${hue} 40% 12%)`}
    />
    {tier === 'elite' && (
      <path
        d="M32 17c4-8 10-10 14-9-4 2-7 6-8 11z"
        fill={`hsl(${hue} 70% 55%)`}
      />
    )}
    {tier === 'champion' && (
      <path d="M21 18l4 4 7-9 7 9 4-4-2 8H23z" fill="hsl(43 70% 58%)" />
    )}
  </svg>
);
