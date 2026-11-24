// ===================================================================
// TOP BAR
// A thin strip (20px) across the top of a fight: where the run is and the
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
  <header className="relative z-30 flex h-5 shrink-0 items-center gap-2 bg-surface-sunken/90 pl-2.5 pr-1 text-[10px] leading-none ring-1 ring-edge">
    <span className="min-w-0 flex-1 truncate text-ink-muted">{where}</span>
    <span className="font-display font-bold text-accent">{score} pts</span>
    <button
      type="button"
      onClick={onOpenMenu}
      aria-label="Pause menu"
      // The strip is only 20px tall, so the tap area reaches past the
      // drawn gear (before:-inset-2.5) to stay easy to hit on a phone.
      className="relative grid size-5 place-items-center rounded-full text-accent before:absolute before:-inset-2.5 before:content-[''] active:scale-95"
    >
      <Glyph name="cog" className="size-3.5" />
    </button>
  </header>
);
