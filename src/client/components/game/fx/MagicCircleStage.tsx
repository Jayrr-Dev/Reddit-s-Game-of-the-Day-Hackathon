// ===================================================================
// MAGIC CIRCLE STAGE
// Places a MagicCircle relative to the units it belongs to: under the
// feet of one unit or a group (ground), or floating above a unit's head
// (overhead). Wrap the unit(s) in this; the circle sizes itself to the
// wrapper's width times `scale`.
// ===================================================================

import type { ReactNode } from 'react';
import { MagicCircle, type MagicCircleProps } from './MagicCircle';

// --- TYPES ---
type MagicCircleStageProps = Omit<MagicCircleProps, 'placement' | 'className'> & {
  placement: 'ground' | 'overhead';
  /** Circle width as a share of the stage width (1 = as wide as the units). */
  scale?: number;
  children: ReactNode;
};

// --- COMPONENT ---
/** Renders the unit(s) with the circle under them or above them. */
export const MagicCircleStage = ({ placement, scale = 1.2, children, ...circle }: MagicCircleStageProps) => (
  <div className="magic-circle-stage" data-placement={placement}>
    {/* Ground circles draw behind the units, overhead ones in front. */}
    <div className="magic-circle-anchor" style={{ width: `${scale * 100}%` }}>
      <MagicCircle {...circle} placement={placement} />
    </div>
    {children}
  </div>
);
