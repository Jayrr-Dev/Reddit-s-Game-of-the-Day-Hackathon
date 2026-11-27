import { useState } from 'react';
import { ALBUM_SLOTS, type AlbumAction, type CarryCard } from '../../../../shared/game/carryCards';
import { getCard } from '../../../../shared/game/cards';
import { apiClient } from '../../../lib/apiClient';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { ModalDialog } from '../../ui/ModalDialog';
import { Button } from '../../ui/Button';
import { Glyph } from '../../ui/Glyph';
import { CardView } from '../CardView';
import './album.css';

/** Four persistent card slots, with safe access to older overflow cards. */
export function AlbumPanel({ cards, testCards = [], testVisit, onChange, onTestChange }: {
  cards: readonly CarryCard[]; testCards?: readonly CarryCard[]; testVisit?: string | undefined;
  onChange: (cards: CarryCard[]) => void; onTestChange?: ((cards: CarryCard[]) => void) | undefined;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [archiveId, setArchiveId] = useState('');
  const [trashing, setTrashing] = useState<CarryCard>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const active = cards.slice(0, ALBUM_SLOTS);
  const archive = cards.slice(ALBUM_SLOTS);
  const selected = active.find(card => card.id === selectedId);
  const selectedTest = testCards.find(card => card.id === selectedId);

  const change = async (action: AlbumAction, visit?: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await apiClient.updateAlbum(action, visit);
      if (visit) onTestChange?.(result.carryCards);
      else onChange(result.carryCards);
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
    <div className="album-heading">
      <h3>Album <span className="cs-inventory-count">{active.length}/{ALBUM_SLOTS}</span></h3>
      <button className="album-info" type="button" title="About the Album" aria-label="About the Album"
        aria-haspopup="dialog" onClick={() => setInfoOpen(true)}>i</button>
    </div>
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
    {testCards.length > 0 && <section className="album-test-cards" aria-label="Admin test cards">
      <h3>Admin test cards</h3>
      <small>Available under Bring a Card in Conquest. Separate from your permanent Album.</small>
      <div>{testCards.map(card => <CardView key={card.id} cardId={card.cardId} selected={selectedId === card.id}
        onClick={() => setSelectedId(previous => previous === card.id ? undefined : card.id)} />)}</div>
      {testVisit && <footer className="album-actions">
        <button type="button" disabled={!selectedTest || busy} onClick={() => setTrashing(selectedTest)}>
          <Glyph name="trash" /> Trash test card
        </button>
      </footer>}
    </section>}
    {trashing && <ConfirmDialog title={'Trash ' + getCard(trashing.cardId).name + '?'} confirmLabel="Trash" cancelLabel="Keep"
      onConfirm={() => { if (!busy) void change({ type: 'trash', id: trashing.id }, testCards.some(card => card.id === trashing.id) ? testVisit : undefined); }} onCancel={() => { if (!busy) setTrashing(undefined); }}>
      {testCards.some(card => card.id === trashing.id) ? 'This removes the card from the current admin test visit only.' : 'This permanently removes the card from your Album.'}
    </ConfirmDialog>}
    {infoOpen && <ModalDialog title="Card Album" onDismiss={() => setInfoOpen(false)}
      actions={<Button variant="menu" className="col-span-2" onClick={() => setInfoOpen(false)}>Done</Button>}>
      <p>Store up to four cards from the Shop, Pandora’s Box, or special events. Pack copies with Bring a Card before Conquest. The originals stay here after the run unless you trash them.</p>
      {testCards.length > 0 && <p className="mt-2">Admin test cards are shown separately and don’t count toward these four slots.</p>}
    </ModalDialog>}
  </section>;
}
