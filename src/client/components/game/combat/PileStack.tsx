// ===================================================================
// PILE STACK (ATOM)
// A card pile drawn as a small stack: the top card shows the count,
// and more card edges peek out behind it as the pile grows, so you can
// read how full it is at a glance. An empty pile is a dashed outline.
// Used for the draw pile (right) and the discard pile (left).
// ===================================================================

// --- TYPES ---
export type PileStackProps = {
  count: number;
  /** Tooltip and screen-reader name, e.g. "Cards left to draw". */
  label: string;
  /** Tailwind background class for the cards. */
  toneClass: string;
  /** Which way the back cards fan out, so the two piles mirror. */
  side: 'left' | 'right';
};

// --- CONSTANTS ---
/** Pile sizes at which one more card edge shows behind the top card. */
const LAYER_THRESHOLDS = [2, 5, 9] as const;
/** Shift (px) between stacked cards. */
const LAYER_SHIFT_PX = 2;
const CARD_CLASS = 'h-8 w-6 rounded-sm';

// --- HELPERS ---
/** How many back cards a pile shows: 0-1 -> 0, 2-4 -> 1, 5-8 -> 2, 9+ -> 3. */
const backCardsFor = (count: number): number =>
  LAYER_THRESHOLDS.filter((threshold) => count >= threshold).length;

// --- COMPONENT ---
/** Renders one pile with its count. */
export const PileStack = ({
  count,
  label,
  toneClass,
  side,
}: PileStackProps) => {
  const backCards = backCardsFor(count);
  // Back cards fan up and toward the nearer screen edge, so the piles mirror.
  const shiftX = side === 'left' ? -LAYER_SHIFT_PX : LAYER_SHIFT_PX;
  const isEmpty = count === 0;
  return (
    <span
      title={label}
      aria-label={`${label}: ${count}`}
      className="relative mb-0.5 block shrink-0"
    >
      {Array.from({ length: backCards }, (_, index) => {
        const depth = backCards - index;
        return (
          <span
            key={depth}
            aria-hidden="true"
            className={`absolute inset-0 ${CARD_CLASS} ${toneClass} ring-1 ring-accent/40 brightness-75`}
            style={{
              transform: `translate(${shiftX * depth}px, ${-LAYER_SHIFT_PX * depth}px)`,
            }}
          />
        );
      })}
      <span
        className={`relative grid place-items-center font-display text-xs font-black ${CARD_CLASS} ${isEmpty ? 'border border-dashed border-accent/40 text-ink/50' : `${toneClass} text-ink ring-1 ring-accent/50`}`}
      >
        <span className="num-center">{count}</span>
      </span>
    </span>
  );
};
