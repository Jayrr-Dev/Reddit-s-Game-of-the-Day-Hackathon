import { useState } from 'react';
import { getCard } from '../../../shared/game/cards';
import { ENDLESS_CLASS_TYPES, ENDLESS_DRAFT_REFRESHES, endlessDraftOffers, endlessDraftSize, refreshEndlessDraft, type DraftOffer, type EndlessDraft } from '../../../shared/game/endlessDraft';
import { playSound } from '../../lib/gameAudio';
import type { StarterName } from '../../../shared/game/starters';
import { Button } from '../ui/Button';
import { CardView } from './CardView';
import './endlessDraft.css';

type DraftProps = {
  day: string;
  draft: EndlessDraft;
  onPick: (index: number) => void;
  onBegin: () => void;
  onRefresh: () => void;
  onPreviewClass: (starter: StarterName) => void;
  loading: boolean;
  loadError: boolean;
};

/** A compact opener shows all included cards before committing to a playstyle. */
function OpeningPack({ offer, chosen, onSelect }: { offer: DraftOffer; chosen: boolean; onSelect: () => void }) {
  if (!offer.name) return null;
  const types = ENDLESS_CLASS_TYPES[offer.name];
  return <button type="button" className="starter-option starter-select endless-pack" data-selected={chosen}
    aria-pressed={chosen} aria-label={offer.name + ' class'} onClick={onSelect}>
    <span className="starter-art" data-style={offer.name} aria-hidden="true" />
    <span className="starter-copy">
      <strong>{offer.name}</strong>
      <small className="endless-class-focus">{types.join(' · ')}</small>
      <small>{offer.cards.map(id => getCard(id).name).join(' · ')}</small>
    </span>
    {chosen && <span className="starter-tick" aria-hidden="true">&#10003;</span>}
  </button>;
}

/** Preview a choice, then lock it in. Return here after leaving to continue the draft. */
export function EndlessDraftView({ day, draft, onPick, onBegin, loading, loadError, onRefresh, onPreviewClass }: DraftProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const count = draft.cards.length;
  const size = endlessDraftSize(draft);
  const complete = count === size;
  const offers = endlessDraftOffers(day, draft);
  const refreshes = ENDLESS_DRAFT_REFRESHES - (draft.refreshesUsed ?? 0);
  const pick = (index: number | null) => {
    if (index === null || loading || !offers[index]) return;
    playSound('reward', 1.15, .68);
    onPick(index);
    setSelected(null);
  };
  return <main className="run-results results-layout endless-draft" aria-labelledby="draft-title">
    <header>
      <h1 id="draft-title">{complete ? 'Deck ready' : count === 0 ? 'Choose your class' : 'Draft your deck'}</h1>
      {(complete || count === 0) && <p className="mt-2 text-sm text-ink-muted" aria-live="polite">
        {complete ? 'Your draft is complete.' : 'Start with three cards. Your class favors certain card types.'}
      </p>}
    </header>
    {count > 0 && <p className="font-display text-base font-bold text-accent" aria-live="polite">
      {draft.starter ? draft.starter + ' · ' : ''}{count} / {size} cards
    </p>}
    {count === 0 ? <div className="endless-packs" aria-label="Endless classes">
      {offers.map((offer, index) => <OpeningPack key={offer.name} offer={offer}
        chosen={index === selected} onSelect={() => { setSelected(index); if (offer.name) onPreviewClass(offer.name); }} />)}
    </div> : !complete && <div className="endless-draft-offers" aria-label="Card choices">
      {offers.map((offer, index) => {
        const id = offer.cards[0];
        return id && <CardView key={id} cardId={id} selected={index === selected}
          onClick={() => setSelected(index)} onDoubleClick={() => pick(index)} />;
      })}
    </div>}
    {count > 0 && !complete && <Button variant="menu" className="min-w-36" disabled={refreshEndlessDraft(day, draft) === draft}
      onClick={() => { setSelected(null); onRefresh(); }}>Refresh ({refreshes})</Button>}
    {loadError && <p role="alert">Could not load your character. Try again.</p>}
    <div className="results-actions draft-primary">
      <Button variant="menuPrimary" disabled={loading || (!complete && selected === null)}
        onClick={complete ? onBegin : () => pick(selected)}>{complete ? loading ? 'Loading character…' : 'Begin Endless' : count === 0 ? 'Choose class' : 'Add card'}</Button>
    </div>
  </main>;
}
