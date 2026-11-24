// ===================================================================
// PILE DIALOG
// Tapping the draw or discard pile opens this sheet: every card in that
// pile, as real cards in a grid that scrolls, with the top and bottom
// edges fading out (a mask) so cards slide in and out of view softly.
// One dialog serves both piles. The draw pile is listed sorted by name
// so it never gives away the order you will draw in. Closes on the
// backdrop, the Close button or Esc.
// ===================================================================

import { useEffect, useRef } from 'react';
import { getCard, type CardId } from '../../../../shared/game/cards';
import type { Combatant } from '../../../../shared/game/types';
import { CardView } from '../CardView';
import { SCROLL_FADE_STYLE } from '../../../lib/scrollFade';

// --- TYPES ---
export type PileId = 'draw' | 'discard' | 'removed';

export type PileDialogProps = {
  pile: PileId;
  /** The pile's cards, top of the pile last (engine order). */
  cards: readonly CardId[];
  /** You, so card numbers show your current buffs. */
  attacker: Combatant;
  slain: number;
  followUpReady?: boolean | undefined;
  onClose: () => void;
};

// --- CONSTANTS ---
/** Each pile's title and the note under it. */
const PILE_TEXT: Record<PileId, { title: string; note: string }> = {
  draw: { title: 'Draw pile', note: 'Sorted by name: the order is a secret.' },
  discard: { title: 'Discard pile', note: 'Most recent first.' },
  removed: {
    title: 'Remove pile',
    note: 'Out of play until the fight is over. Most recent first.',
  },
};

// --- HELPERS ---
/** The order a pile is shown in: draw by name, the others newest first. */
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
  slain,
  followUpReady,
  onClose,
}: PileDialogProps) => {
  const { title, note } = PILE_TEXT[pile];
  const scrollStart = useRef<{ y: number; top: number } | null>(null);

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
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y py-4"
          style={SCROLL_FADE_STYLE}
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse' && event.button === 0)
              scrollStart.current = { y: event.clientY, top: event.currentTarget.scrollTop };
          }}
          onPointerMove={(event) => {
            const start = scrollStart.current;
            if (!start || event.buttons !== 1 || event.pointerType !== 'mouse') return;
            const delta = event.clientY - start.y;
            if (Math.abs(delta) < 4 && !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.scrollTop = start.top - delta;
          }}
          onPointerUp={() => { scrollStart.current = null; }}
          onPointerCancel={() => { scrollStart.current = null; }}
          onPointerLeave={() => { scrollStart.current = null; }}
        >
          {cards.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              No cards here.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--table-card-width),1fr))] justify-items-center gap-x-2 gap-y-3 px-1">
              {shownOrder(pile, cards).map((cardId, index) => (
                <CardView
                  key={`${cardId}-${index}`}
                  cardId={cardId}
                  attacker={attacker} slain={slain} followUpReady={followUpReady}
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
