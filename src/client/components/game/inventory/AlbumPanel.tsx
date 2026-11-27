import { useState } from 'react';
import { ALBUM_SLOTS, type AlbumAction, type CarryCard } from '../../../../shared/game/carryCards';
import { getCard } from '../../../../shared/game/cards';
import { apiClient } from '../../../lib/apiClient';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Glyph } from '../../ui/Glyph';
import { CardView } from '../CardView';
import './album.css';

/** Four persistent card slots, with safe access to older overflow cards. */
export function AlbumPanel({ cards, onChange }: { cards: readonly CarryCard[]; onChange: (cards: CarryCard[]) => void }) {
  const [selectedId, setSelectedId] = useState<string>();
  const [archiveId, setArchiveId] = useState('');
  const [trashing, setTrashing] = useState<CarryCard>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = cards.slice(0, ALBUM_SLOTS);
  const archive = cards.slice(ALBUM_SLOTS);
  const selected = active.find(card => card.id === selectedId);

  const change = async (action: AlbumAction) => {
    setBusy(true);
    setError('');
    try {
      const result = await apiClient.updateAlbum(action);
      onChange(result.carryCards);
      setArchiveId('');
      setSelectedId(action.type === 'swap' ? action.id : undefined);
    } catch {
      setError('The Album could not be updated. Try again.');
    } finally {
      setBusy(false);
      setTrashing(undefined);
    }
  };

  return <section className="cs-paper album-panel" aria-label="Card Album">
    <h3>Album <span className="cs-inventory-count">{active.length}/{ALBUM_SLOTS}</span></h3>
    <div className="cs-compartment">
      <div className="album-slots">
        {Array.from({ length: ALBUM_SLOTS }, (_, index) => {
          const card = active[index];
          return <div key={index} className="album-slot" data-selected={card && selected?.id === card.id || undefined}>
            {card ? <CardView cardId={card.cardId} label={getCard(card.cardId).name}
              selected={selected?.id === card.id} onClick={() => setSelectedId(previous => previous === card.id ? undefined : card.id)} />
              : <span className="album-empty" aria-label="Empty Album slot"><Glyph name="cards" className="size-7" /></span>}
          </div>;
        })}
      </div>
      <footer className="album-actions">
        <button type="button" disabled={!selected || busy} onClick={() => setTrashing(selected)}>
          <Glyph name="trash" /> Trash card
        </button>
        {archive.length > 0 && <div className="album-archive">
          <label>Archived cards ({archive.length}) <select value={archiveId} onChange={event => setArchiveId(event.target.value)}>
            <option value="">Choose a card</option>
            {archive.map(card => <option key={card.id} value={card.id}>{getCard(card.cardId).name}</option>)}
          </select></label>
          <button type="button" disabled={!archiveId || !selected || busy}
            onClick={() => selected && void change({ type: 'swap', id: archiveId, with: selected.id })}>Swap with selected</button>
        </div>}
      </footer>
      {error && <p role="alert">{error}</p>}
    </div>
    {trashing && <ConfirmDialog title={'Trash ' + getCard(trashing.cardId).name + '?'} confirmLabel="Trash" cancelLabel="Keep"
      onConfirm={() => { if (!busy) void change({ type: 'trash', id: trashing.id }); }} onCancel={() => { if (!busy) setTrashing(undefined); }}>
      This permanently removes the card from your Album.
    </ConfirmDialog>}
  </section>;
}
