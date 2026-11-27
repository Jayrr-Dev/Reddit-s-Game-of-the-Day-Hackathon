import { useState } from 'react';
import { MAX_CARRY_CARDS, type CarryCard } from '../../../../shared/game/carryCards';
import { getCard } from '../../../../shared/game/cards';
import { apiClient } from '../../../lib/apiClient';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { ModalDialog } from '../../ui/ModalDialog';
import { Button } from '../../ui/Button';
import { Glyph } from '../../ui/Glyph';
import { CardView } from '../CardView';
import './album.css';

/** Lists the whole permanent card collection, including former archive cards. */
export function AlbumPanel({ cards, onChange }: {
  cards: readonly CarryCard[];
  onChange: (cards: CarryCard[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [trashing, setTrashing] = useState<CarryCard>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const selected = cards.find(card => card.id === selectedId);

  const trash = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await apiClient.updateAlbum({ type: 'trash', id });
      onChange(result.carryCards);
      setSelectedId(undefined);
    } catch {
      setError('The Album could not be updated. Try again.');
    } finally {
      setBusy(false);
      setTrashing(undefined);
    }
  };

  return <section className="cs-paper album-panel" aria-label="Card Album">
    <div className="album-heading">
      <h3>Album <span className="cs-inventory-count">{cards.length}</span></h3>
      <button className="album-info" type="button" title="About the Album" aria-label="About the Album"
        aria-haspopup="dialog" onClick={() => setInfoOpen(true)}>i</button>
    </div>
    <div className="cs-compartment">
      <div className="album-slots">
        {cards.map(card => <div key={card.id} className="album-slot" data-selected={selected?.id === card.id || undefined}>
          <CardView cardId={card.cardId} label={getCard(card.cardId).name}
            selected={selected?.id === card.id} onClick={() => setSelectedId(previous => previous === card.id ? undefined : card.id)} />
        </div>)}
      </div>
      {cards.length === 0 && <p className="album-empty">No cards in your Album yet.</p>}
      {cards.length > 0 && <footer className="album-actions">
        <button type="button" disabled={!selected || busy} onClick={() => setTrashing(selected)}>
          <Glyph name="trash" /> Trash card
        </button>
      </footer>}
      {error && <p role="alert">{error}</p>}
    </div>
    {trashing && <ConfirmDialog title={'Trash ' + getCard(trashing.cardId).name + '?'} confirmLabel="Trash" cancelLabel="Keep"
      onConfirm={() => { if (!busy) void trash(trashing.id); }} onCancel={() => { if (!busy) setTrashing(undefined); }}>
      This permanently removes the card from your Album.
    </ConfirmDialog>}
    {infoOpen && <ModalDialog title="Card Album" onDismiss={() => setInfoOpen(false)}
      actions={<Button variant="menu" className="col-span-2" onClick={() => setInfoOpen(false)}>Done</Button>}>
      <p>Keep as many cards as you like. Before Conquest, use Bring a Card to pack up to {MAX_CARRY_CARDS} copies for the run. Originals stay in your Album unless you trash them.</p>
    </ModalDialog>}
  </section>;
}
