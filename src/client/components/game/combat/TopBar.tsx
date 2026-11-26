// ===================================================================
// TOP BAR
// A thin strip (20px) across the top of a fight: where the run is and the
// score on the left, the pause gear on the right. Each hero carries its
// own HP plate on the field, so nothing per-hero is repeated up here.
// ===================================================================

import { Glyph } from '../../ui/Glyph';

// --- TYPES ---
export type TopBarProps = {
  location: string;
  where: string;
  score: number;
  onOpenDeck: () => void;
  onOpenCharacter: () => void;
  onOpenMenu: () => void;
  /** When set, an Exit Battle button sits in the top-left corner. */
  onExitBattle?: (() => void) | undefined;
};

// --- COMPONENT ---
/** Renders the strip. */
export const TopBar = ({
  location,
  where,
  score,
  onOpenMenu,
  onOpenDeck,
  onOpenCharacter,
  onExitBattle,
}: TopBarProps) => (
  <header className="table-header relative z-30 shrink-0">
    {/* Pinned under the arena plaque so the name keeps its centred plaque. */}
    {onExitBattle && (
      <button type="button" className="table-exit" title="Exit Battle" aria-label="Exit Battle" onClick={onExitBattle}>
        <Glyph name="back" className="size-3" />
        <span>Exit Battle</span>
      </button>
    )}
    <div className="table-brand">
      <strong title={location}>{location}</strong>
    </div>
    <span className="table-location">{where}</span>
    <div className="table-tools">
      <button type="button" title="Character sheet" aria-label="Character sheet" onClick={onOpenCharacter}>
        <Glyph name="breastplate" className="size-3.5" />
      </button>
      <button
        type="button"
        className="table-book"
        aria-label="View deck"
        onClick={onOpenDeck}
      >
        <svg viewBox="0 0 24 20" fill="currentColor" aria-hidden="true">
          <path d="M2 2q5-2 9 1v14q-5-3-9-1zm20 0q-5-2-9 1v14q5-3 9-1z" />
        </svg>
      </button>
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
    </div>
  </header>
);
