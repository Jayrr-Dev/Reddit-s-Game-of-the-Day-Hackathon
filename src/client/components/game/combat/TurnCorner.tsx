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
  onOpenDraw: () => void;
};

// --- COMPONENT ---
/** Renders the deck count and the End Turn hourglass. */
export const TurnCorner = ({
  drawCount,
  onEndTurn,
  onOpenDraw,
}: TurnCornerProps) => (
  <div className="flex shrink-0 items-end gap-2.5">
    <PileStack
      count={drawCount}
      label="Cards left to draw"
      toneClass="bg-deck"
      side="right"
      pile="draw"
      onOpen={onOpenDraw}
    />
    <button
      type="button"
      onClick={onEndTurn}
      aria-label="End turn"
      className="table-end grid size-14 place-items-center rounded-full bg-deck text-accent shadow-lg ring-2 ring-accent/70 active:scale-95"
    >
      <Glyph name="hourglass" className="size-7" />
      <span>End Turn</span>
    </button>
  </div>
);
