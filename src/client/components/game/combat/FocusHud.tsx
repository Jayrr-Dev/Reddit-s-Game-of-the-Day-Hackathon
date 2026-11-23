// ===================================================================
// FOCUS HUD
// The thin line at the top of the combat screen: where you are and the
// run's score. Each hero's HP, intent and statuses live on its own
// plate on the battlefield (see HeroPlate).
// ===================================================================

// --- TYPES ---
export type FocusHudProps = {
  /** "Wave 6 · Border Village" style location line. */
  where: string;
  score: number;
};

// --- COMPONENT ---
/** Renders the location line and the score. */
export const FocusHud = ({ where, score }: FocusHudProps) => (
  <header className="relative z-30 flex shrink-0 justify-between bg-gradient-to-b from-surface to-transparent px-3 pb-1 pt-1.5 text-[10px] text-ink-muted">
    <span>{where}</span>
    <span className="font-bold text-ink">{score} pts</span>
  </header>
);
