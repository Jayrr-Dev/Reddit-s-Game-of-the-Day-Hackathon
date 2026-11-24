// ===================================================================
// TURN CORNER
// The bottom-right corner: the draw pile as a small stack with its
// count, and the big hourglass that ends your turn.
// ===================================================================

import { Glyph } from '../../ui/Glyph';
import { PileStack } from './PileStack';

// --- TYPES ---
export type TurnCornerProps = {
  drawCount: number;
  onEndTurn: () => void;
};

// --- COMPONENT ---
/** Renders the deck count and the End Turn hourglass. */
export const TurnCorner = ({ drawCount, onEndTurn }: TurnCornerProps) => (
  <div className="flex shrink-0 items-end gap-3.5">
    <PileStack
      count={drawCount}
      label="Cards left to draw"
      toneClass="bg-card-buff"
      side="right"
    />
    <button
      type="button"
      onClick={onEndTurn}
      aria-label="End turn"
      className="grid size-14 place-items-center rounded-full bg-card-buff text-accent shadow-lg ring-2 ring-accent/70 active:scale-95"
    >
      <Glyph name="hourglass" className="size-7" />
    </button>
  </div>
);
