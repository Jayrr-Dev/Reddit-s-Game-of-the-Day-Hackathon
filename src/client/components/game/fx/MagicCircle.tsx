// ===================================================================
// MAGIC CIRCLE
// Draws a circle from the generator (shared/fx/magicCircle.ts) in one
// colour with a glow, its rings spinning at their own speeds. Placement
// lays it in the scene:
//   flat      facing the viewer (menus, previews)
//   ground    a floor circle under feet, tilted back into the ground
//   overhead  a halo-like circle floating above a unit, same tilt
// The parent sets the size: the circle fills its width.
// ===================================================================

import { memo, useMemo, type CSSProperties } from 'react';
import { buildMagicCircle, type MagicCircleComplexity, type MagicCircleLayer } from '../../../../shared/fx/magicCircle';
import './magic-circle.css';

// --- TYPES ---
export type MagicCirclePlacement = 'flat' | 'ground' | 'overhead';

export type MagicCircleProps = {
  complexity: MagicCircleComplexity;
  seed?: number;
  /** Any CSS colour; the glow uses it too. */
  color?: string;
  placement?: MagicCirclePlacement;
  /** False holds every ring still (stills, reduced motion previews). */
  isSpinning?: boolean;
  className?: string;
};

// --- SUBCOMPONENTS ---
/** One generator layer as an SVG path. */
const CircleLayer = ({ layer, isSpinning }: { layer: MagicCircleLayer; isSpinning: boolean }) => {
  const spin = isSpinning && layer.spinSeconds !== 0;
  const style: CSSProperties | undefined = spin
    ? {
        animationDuration: `${Math.abs(layer.spinSeconds)}s`,
        animationDirection: layer.spinSeconds < 0 ? 'reverse' : 'normal',
      }
    : undefined;
  return (
    <path
      d={layer.d}
      className={spin ? 'magic-circle-spin' : undefined}
      style={style}
      fill={layer.isFilled ? 'currentColor' : 'none'}
      stroke={layer.isFilled ? 'none' : 'currentColor'}
      strokeWidth={layer.strokeWidth || undefined}
      strokeDasharray={layer.dash}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={layer.opacity}
    />
  );
};

// --- COMPONENT ---
/** Renders one generated circle; memoised since its paths only change with its options. */
export const MagicCircle = memo(function MagicCircle({
  complexity,
  seed = 1,
  color = 'var(--color-accent)',
  placement = 'flat',
  isSpinning = true,
  className = '',
}: MagicCircleProps) {
  const layers = useMemo(() => buildMagicCircle({ complexity, seed }), [complexity, seed]);
  return (
    <div className={`magic-circle ${className}`} data-placement={placement} style={{ color }}>
      <svg viewBox="-50 -50 100 100" className="magic-circle-svg" aria-hidden="true">
        {layers.map((layer, index) => (
          <CircleLayer key={index} layer={layer} isSpinning={isSpinning} />
        ))}
      </svg>
    </div>
  );
});
