import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CarryCard } from '../../../shared/game/carryCards';
import { carrySourceLabel, MAX_CARRY_CARDS } from '../../../shared/game/carryCards';
import { getCard, type CardId } from '../../../shared/game/cards';
import { isUniqueInDeck } from '../../../shared/game/unique';
import { playSound } from '../../lib/gameAudio';
import { usePointerDrag } from '../../hooks/usePointerDrag';
import { Button } from '../ui/Button';
import { CardView } from './CardView';

type Props = {
  cards: readonly CarryCard[];
  starter: readonly CardId[];
  selected: readonly CarryCard[];
  onPack: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
};

type Flight = { card: CarryCard; x: number; y: number; fromDrag: boolean; to: 'bag' | 'inventory' };

export function CarryBagDialog({ cards, starter, selected, onPack, onRemove, onClose }: Props) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const landing = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const focusCard = useRef<string | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);

  const full = selected.length >= MAX_CARRY_CARDS;
  const packedIds = new Set(selected.map(card => card.id));
  const deck = [...starter, ...selected.map(card => card.cardId)];
  function pack(card: CarryCard, x: number, y: number, fromDrag: boolean) {
    if (full || packedIds.has(card.id) || isUniqueInDeck(deck, card.cardId)) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setFlight({ card, x, y, fromDrag, to: 'bag' });
    if (!fromDrag) playSound('draw', 1.04, .44);
    onPack(card.id);
    playSound('menu', .94, .58);
  }

  /** Return a packed card to the same inventory slot without spending it. */
  function unpack(card: CarryCard, x: number, y: number, fromDrag: boolean) {
    if (!packedIds.has(card.id)) return;
    setFlight(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? null : { card, x, y, fromDrag, to: 'inventory' });
    if (!fromDrag) playSound('draw', 1.04, .44);
    onRemove(card.id);
    playSound('discard', 1.06, .40);
  }

  const { drag, startPress, consumeDrag } = usePointerDrag<CarryCard>('data-carry-drop', (card, zone, { x, y }) => {
    if (!cards.some(candidate => candidate.id === card.id)) return;
    if (zone === 'bag') pack(card, x, y, true);
    if (zone === 'inventory') unpack(card, x, y, true);
  }, () => playSound('draw', 1.04, .56));

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);

  useLayoutEffect(() => {
    const id = focusCard.current;
    if (flight || !id) return;
    focusCard.current = null;
    dialog.current?.querySelector<HTMLButtonElement>('[data-carry-id="' + CSS.escape(id) + '"] button')
      ?.focus({ preventScroll: true });
  }, [selected, flight]);

  useLayoutEffect(() => {
    if (!flight || !ghost.current || !landing.current) return;
    landing.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const target = landing.current.getBoundingClientRect();
    const dx = target.left + target.width / 2 - flight.x;
    const dy = target.top + target.height / 2 - flight.y;
    const animation = ghost.current.animate([
      { transform: flight.fromDrag ? 'translate(-50%, -60%) rotate(-7deg)' : 'translate(-50%, -50%)' },
      { transform: `translate(calc(-50% + ${dx * .7}px), calc(-50% + ${dy * .7 - 9}px)) rotate(3deg)`, offset: .7 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0deg)` },
    ], { duration: flight.fromDrag ? 190 : 320, easing: 'cubic-bezier(.24,.66,.28,1)', fill: 'forwards' });
    animation.onfinish = () => setFlight(null);
    return () => { animation.onfinish = null; animation.cancel(); };
  }, [flight]);

  return <dialog ref={dialog} className="carry-bag-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) onClose();
    } }}>
    <header><h2 id={titleId}>Bring a Card</h2><p>Drag cards between Inventory and Bag, or tap to move them.</p></header>
    <div className="carry-bag-layout">
      <section className="carry-bag-inventory" aria-label="Inventory" data-carry-drop="inventory"
        data-over={(drag?.over === 'inventory' && packedIds.has(drag.item.id)) || undefined}>
        <h3>Inventory</h3>
        {cards.some(card => !packedIds.has(card.id)) || flight ? <ul className="carry-bag-cards" aria-label="Cards in inventory">
          {cards.map(card => {
            const duplicate = isUniqueInDeck(deck, card.cardId);
            const blocked = full || duplicate;
            const packed = packedIds.has(card.id);
            const isLanding = flight?.to === 'inventory' && flight.card.id === card.id;
            if (packed && !(flight?.to === 'bag' && flight.card.id === card.id)) return null;
            return <li key={card.id} className="carry-bag-card" data-carry-id={card.id} data-dragged={drag?.item.id === card.id || undefined}
              onPointerDown={blocked || packed || isLanding ? undefined : startPress(card)}>
              {packed ? <span className="carry-bag-card-placeholder" aria-hidden="true"/> :
                <div ref={isLanding ? landing : undefined} className="carry-bag-source" data-landing={isLanding || undefined} onClick={event => {
                  if (blocked || !event.currentTarget.querySelector('button')?.contains(event.target as Node) || (consumeDrag() && event.detail !== 0)) return;
                  const r = event.currentTarget.getBoundingClientRect();
                  if (event.detail === 0) focusCard.current = card.id;
                  pack(card, r.left + r.width / 2, r.top + r.height / 2, false);
                }}>
                  <CardView cardId={card.cardId} size="fan" isDisabled={blocked} label={'Pack ' + getCard(card.cardId).name} />
                </div>}
              {!packed && <small>{duplicate ? 'Already in deck' : carrySourceLabel(card.source)}</small>}
            </li>;
          })}
        </ul> : <p className="carry-bag-empty">{selected.length ? 'Drop cards here to unpack.' : 'No cards yet.'}</p>}
      </section>
      <section className="carry-bag-slot" aria-label="Bag" data-carry-drop="bag" data-over={(!full && drag?.over === 'bag' && !packedIds.has(drag.item.id) && !isUniqueInDeck(deck, drag.item.cardId)) || undefined}>
        <h3>Bag <span aria-live="polite">{selected.length}/{MAX_CARRY_CARDS}</span></h3>
        {selected.length ? <ul className="carry-bag-packed">
          {selected.map(card => {
            const isLanding = flight?.to === 'bag' && flight.card.id === card.id;
            return <li key={card.id} data-carry-id={card.id} data-dragged={drag?.item.id === card.id || undefined}
              onPointerDown={isLanding ? undefined : startPress(card)}>
              <div ref={isLanding ? landing : undefined} className="carry-bag-source carry-bag-landing" data-landing={isLanding || undefined}
                onClick={event => {
                  if (!event.currentTarget.querySelector('button')?.contains(event.target as Node) || (consumeDrag() && event.detail !== 0)) return;
                  if (event.detail === 0) focusCard.current = card.id;
                  const r = event.currentTarget.getBoundingClientRect();
                  unpack(card, r.left + r.width / 2, r.top + r.height / 2, false);
                }}>
                <CardView cardId={card.cardId} size="fan" label={'Return ' + getCard(card.cardId).name + ' to Inventory'} />
              </div>
            </li>;
          })}
        </ul> : <div className="carry-bag-drop-hint">
          <svg className="carry-bag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 3h8l-2.5 5c4.3 3.2 6.5 6.4 6.5 8.5 0 2.7-2.7 4.5-8 4.5s-8-1.8-8-4.5c0-2.1 2.2-5.3 6.5-8.5L8 3Zm2 5h4" strokeLinejoin="round" /></svg>
          <span>Drop a card here</span>
        </div>}
      </section>
    </div>
    {drag ? <div className="carry-bag-drag-ghost" aria-hidden="true" inert style={{ left: drag.x, top: drag.y }}>
      <CardView cardId={drag.item.cardId} size="fan" />
    </div> : flight && <div ref={ghost} className="carry-bag-drag-ghost" data-flight aria-hidden="true" inert style={{ left: flight.x, top: flight.y }}>
      <CardView cardId={flight.card.cardId} size="fan" />
    </div>}
    <footer><Button variant="menuPrimary" onClick={onClose}>Done</Button></footer>
  </dialog>;
}
