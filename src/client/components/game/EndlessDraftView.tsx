import { useState } from 'react';
import { getCard } from '../../../shared/game/cards';
import { ENDLESS_DRAFT_SIZE, endlessDraftOffers, type DraftOffer, type EndlessDraft } from '../../../shared/game/endlessDraft';
import { playSound } from '../../lib/gameAudio';
import { Button } from '../ui/Button';
import { CardView } from './CardView';
import './endlessDraft.css';

type DraftProps = {
  day: string;
  draft: EndlessDraft;
  onPick: (index: number) => void;
  onBegin: () => void;
  onBack: () => void;
  loading: boolean;
  loadError: boolean;
};

/** A compact opener shows all included cards before committing to a playstyle. */
function OpeningPack({ offer, chosen, onSelect }: { offer: DraftOffer; chosen: boolean; onSelect: () => void }) {
  return <Button variant={chosen ? 'menuPrimary' : 'menu'} aria-pressed={chosen}
    className="endless-pack" onClick={onSelect}>
    <strong>{offer.name}</strong>
    <span>{offer.cards.map(id => getCard(id).name).join(' · ')}</span>
  </Button>;
}

/** Preview a choice, then lock it in. Return here after leaving to continue the draft. */
export function EndlessDraftView({ day, draft, onPick, onBegin, onBack, loading, loadError }: DraftProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const count = draft.cards.length;
  const complete = count === ENDLESS_DRAFT_SIZE;
  const offers = endlessDraftOffers(day, draft);
  const pick = () => {
    if (selected === null) return;
    playSound('reward', 1.15, .68);
    onPick(selected);
    setSelected(null);
  };
  return <main className="run-results results-layout endless-draft" aria-labelledby="draft-title">
    <header>
      <h1 id="draft-title">{complete ? 'Deck ready' : 'Draft your deck'}</h1>
      <p className="mt-2 text-sm text-ink-muted" aria-live="polite">
        {complete ? 'Your draft is complete.' : count === 0 ? 'Choose a three-card opening pack.' : 'Pick one card.'}
      </p>
    </header>
    <p className="font-display text-base font-bold text-accent" aria-live="polite">{count} / {ENDLESS_DRAFT_SIZE} cards</p>
    {count === 0 ? <div className="endless-packs" aria-label="Opening packs">
      {offers.map((offer, index) => <OpeningPack key={offer.name} offer={offer}
        chosen={index === selected} onSelect={() => setSelected(index)} />)}
    </div> : !complete && <div className="endless-draft-offers" aria-label="Card choices">
      {offers.map((offer, index) => {
        const id = offer.cards[0];
        return id && <CardView key={id} cardId={id} selected={index === selected}
          onClick={() => setSelected(index)} />;
      })}
    </div>}
    {count > 0 && <details className="results-board endless-draft-list" open={complete}>
      <summary>Drafted cards ({count})</summary>
      <ul>{draft.cards.map((id, index) => <li key={id + ':' + index}>{getCard(id).name}</li>)}</ul>
    </details>}
    {loadError && <p role="alert">Could not load your character. Try again.</p>}
    <div className="results-actions">
      <Button variant="menuPrimary" disabled={loading || (!complete && selected === null)}
        onClick={complete ? onBegin : pick}>{complete ? loading ? 'Loading character…' : 'Begin Endless' : count === 0 ? 'Choose pack' : 'Add card'}</Button>
      <Button variant="menu" disabled={loading} onClick={onBack}>Endless menu</Button>
    </div>
  </main>;
}
