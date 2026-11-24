// ===================================================================
// PILE DIALOG
// Tapping the draw or discard pile opens this sheet: every card in that
// pile, as real cards in a grid that scrolls, with the top and bottom
// edges fading out (a mask) so cards slide in and out of view softly.
// One dialog serves both piles. The draw pile is listed sorted by name
// so it never gives away the order you will draw in. Closes on the
// backdrop, the Close button or Esc.
// ===================================================================

import { useEffect } from 'react';
import { getCard, type CardId } from '../../../../shared/game/cards';
import type { Combatant } from '../../../../shared/game/types';
import { CardView } from '../CardView';

// --- TYPES ---
export type PileId = 'draw' | 'discard';

export type PileDialogProps = {
  pile: PileId;
  /** The pile's cards, top of the pile last (engine order). */
  cards: readonly CardId[];
  /** You, so card numbers show your current buffs. */
  attacker: Combatant;
  onClose: () => void;
};

// --- CONSTANTS ---
/** Each pile's title and the note under it. */
const PILE_TEXT: Record<PileId, { title: string; note: string }> = {
  draw: { title: 'Draw pile', note: 'Sorted by name: the order is a secret.' },
  discard: { title: 'Discard pile', note: 'Most recent first.' },
};

/** Fades the scroll area's top and bottom edges (a CSS mask). */
const FADE_MASK =
  'linear-gradient(to bottom, transparent, black 1.25rem, black calc(100% - 1.25rem), transparent)';

// --- HELPERS ---
/** The order a pile is shown in: draw by name, discard newest first. */
const shownOrder = (pile: PileId, cards: readonly CardId[]): CardId[] =>
  pile === 'draw'
    ? [...cards].sort((a, b) => getCard(a).name.localeCompare(getCard(b).name))
    : [...cards].reverse();

// --- COMPONENT ---
/** Renders the pile's cards over the fight. */
export const PileDialog = ({
  pile,
  cards,
  attacker,
  onClose,
}: PileDialogProps) => {
  const { title, note } = PILE_TEXT[pile];

  // ESC CLOSES
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 animate-tooltip-in"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-full w-full max-w-md flex-col gap-2 rounded-lg bg-surface p-3 ring-1 ring-edge shadow-[0_10px_30px_rgb(0_0_0/0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-0.5">
          <h2 className="whitespace-nowrap font-display text-lg font-black uppercase tracking-widest text-accent">
            {title} · {cards.length}
          </h2>
          <span className="text-[11px] text-ink-muted">{note}</span>
        </header>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth py-4"
          style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
        >
          {cards.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              No cards here.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] justify-items-center gap-x-2 gap-y-3 px-1">
              {shownOrder(pile, cards).map((cardId, index) => (
                <CardView
                  key={`${cardId}-${index}`}
                  cardId={cardId}
                  attacker={attacker}
                  size="fan"
                />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="self-center rounded-full bg-surface-raised px-5 py-1.5 font-display text-sm font-bold uppercase tracking-wider text-ink ring-1 ring-edge active:scale-95"
        >
          Close
        </button>
      </section>
    </div>
  );
};
