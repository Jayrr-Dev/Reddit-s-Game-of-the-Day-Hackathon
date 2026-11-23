// ===================================================================
// TOP BAR
// A thin strip across the top of a fight: where the run is and the
// score on the left, the pause gear on the right. Each hero carries its
// own HP plate on the field, so nothing per-hero is repeated up here.
// ===================================================================

import { Glyph } from '../../ui/Glyph';

// --- TYPES ---
export type TopBarProps = {
  where: string;
  score: number;
  onOpenMenu: () => void;
};

// --- COMPONENT ---
/** Renders the strip. */
export const TopBar = ({ where, score, onOpenMenu }: TopBarProps) => (
  <header className="relative z-30 flex h-7 shrink-0 items-center gap-2 bg-surface-sunken/90 pl-3 pr-1 text-[11px] ring-1 ring-edge">
    <span className="min-w-0 flex-1 truncate text-ink-muted">{where}</span>
    <span className="font-display font-bold text-accent">{score} pts</span>
    <button
      type="button"
      onClick={onOpenMenu}
      aria-label="Pause menu"
      className="grid size-6 place-items-center rounded-full text-accent active:scale-95"
    >
      <Glyph name="cog" className="size-4" />
    </button>
  </header>
);
