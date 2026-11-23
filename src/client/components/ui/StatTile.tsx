// ===================================================================
// STAT TILE (ATOM)
// A labelled number, e.g. "Streak 3". Used for streak and best score.
// ===================================================================

export type StatTileProps = {
  label: string;
  value: string | number;
};

/** Shows one labelled statistic. */
export const StatTile = ({ label, value }: StatTileProps) => (
  <div className="flex min-w-20 flex-col items-center rounded-lg bg-surface-raised px-3 py-1">
    <span className="text-lg font-bold">{value}</span>
    <span className="text-xs text-ink-muted">{label}</span>
  </div>
);
