// ===================================================================
// TURN CORNER
// The bottom-right corner: the draw pile as a small card with its
// count, and the big hourglass that ends your turn.
// ===================================================================

import { Glyph } from '../../ui/Glyph';

// --- TYPES ---
export type TurnCornerProps = {
  drawCount: number;
  onEndTurn: () => void;
};

// --- COMPONENT ---
/** Renders the deck count and the End Turn hourglass. */
export const TurnCorner = ({ drawCount, onEndTurn }: TurnCornerProps) => (
  <div className="flex shrink-0 items-end gap-1.5">
    <span
      title="Cards left to draw"
      className="mb-0.5 grid h-8 w-6 place-items-center rounded-sm bg-card-guard font-display text-xs font-black text-ink ring-1 ring-accent/50"
    >
      {drawCount}
    </span>
    <button
      type="button"
      onClick={onEndTurn}
      aria-label="End turn"
      className="grid size-14 place-items-center rounded-full bg-card-guard text-accent shadow-lg ring-2 ring-accent/70 active:scale-95"
    >
      <Glyph name="hourglass" className="size-7" />
    </button>
  </div>
);
