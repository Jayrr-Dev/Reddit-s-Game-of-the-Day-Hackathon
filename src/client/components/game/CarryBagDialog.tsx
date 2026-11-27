import { useEffect, useId, useRef } from 'react';
import type { CarryCard } from '../../../shared/game/carryCards';
import { carrySourceLabel } from '../../../shared/game/carryCards';
import { getCard, type CardId } from '../../../shared/game/cards';
import { isUniqueInDeck } from '../../../shared/game/unique';
import { usePointerDrag } from '../../hooks/usePointerDrag';
import { Button } from '../ui/Button';
import { CardView } from './CardView';

type Props = {
  cards: readonly CarryCard[];
  starter: readonly CardId[];
  selected: CarryCard | undefined;
  onPick: (id: string) => void;
  onClose: () => void;
};

export function CarryBagDialog({ cards, starter, selected, onPick, onClose }: Props) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const { drag, startPress, consumeDrag } = usePointerDrag<CarryCard>('data-carry-drop', (card, zone) => {
    if (zone === 'bag' && cards.some(candidate => candidate.id === card.id) && !isUniqueInDeck(starter, card.cardId)) onPick(card.id);
  });

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);

  return <dialog ref={dialog} className="carry-bag-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) onClose();
    } }}>
    <header><h2 id={titleId}>Bring a Card</h2><p>Drag one card into your bag, or tap a card to pack it.</p></header>
    <section className="carry-bag-slot" aria-label="Bag, one card slot" data-carry-drop="bag" data-over={drag?.over === 'bag' || undefined}>
      <svg className="carry-bag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 3h8l-2.5 5c4.3 3.2 6.5 6.4 6.5 8.5 0 2.7-2.7 4.5-8 4.5s-8-1.8-8-4.5c0-2.1 2.2-5.3 6.5-8.5L8 3Zm2 5h4" strokeLinejoin="round" /></svg>
      <div aria-live="polite"><strong>Bag</strong><span>{selected ? getCard(selected.cardId).name : 'Drop a card here'}</span></div>
      {selected && <Button variant="menu" onClick={() => onPick('')}>Remove</Button>}
    </section>
    {cards.length > 0 ? <ul className="carry-bag-cards" aria-label="Cards in inventory">
      {cards.map(card => {
        const blocked = isUniqueInDeck(starter, card.cardId);
        return <li key={card.id} className="carry-bag-card" onPointerDown={blocked ? undefined : startPress(card)}>
          <CardView cardId={card.cardId} size="fan" isDisabled={blocked} selected={selected?.id === card.id}
            label={'Pack ' + getCard(card.cardId).name} onClick={() => { if (!consumeDrag()) onPick(card.id); }} />
          <small>{blocked ? 'Already in deck' : carrySourceLabel(card.source)}</small>
        </li>;
      })}
    </ul> : <p className="carry-bag-empty">No cards in your inventory yet.</p>}
    {drag && <div className="carry-bag-drag-ghost" aria-hidden="true" inert style={{ left: drag.x, top: drag.y }}>
      <CardView cardId={drag.item.cardId} size="fan" />
    </div>}
    <footer><p>The card is used for this run only. Bringing one makes the run unranked.</p><Button variant="menuPrimary" onClick={onClose}>Done</Button></footer>
  </dialog>;
}
