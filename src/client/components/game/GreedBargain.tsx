import { useState } from 'react';
import gildedVault from '../../assets/npcs/greed-gilded-vault.webp';
import { getCard } from '../../../shared/game/cards';
import { greedCanTake, type RunAction, type RunState } from '../../../shared/game/run';
import { Button } from '../ui/Button';
import { ProgressiveImg } from '../ui/ProgressiveImage';

/** Let Greed take one card from the current run; the server returns it only on death. */
export function GreedBargain({ run, onAction }: { run: RunState; onAction: (action: RunAction) => void }) {
  const [cardIndex, setCardIndex] = useState<number>();
  const choices = run.deck.flatMap((card, index) => greedCanTake(run, index) ? [{ card, index }] : []);
  return <section className="relative isolate flex min-h-72 w-full max-w-3xl flex-col justify-between overflow-hidden rounded-lg border border-accent/50 bg-surface-sunken p-3" aria-label="Greed's bargain">
    <ProgressiveImg src={gildedVault} alt="Greed looks down from his counter in the Gilded Vault" className="absolute inset-0 -z-10 h-full w-full object-cover object-right" />
    <div className="max-w-60 rounded border border-accent/40 bg-surface-sunken/95 p-2 text-ink">
      <h2 className="font-display text-lg text-accent">The Gilded Vault</h2>
      <p className="text-xs leading-snug">“Keep it, and it dies with you. Leave it with me, and I’ll have it waiting in Hell. Tell me which loss you fear more.”</p>
    </div>
    <div className="mt-8 w-full max-w-md self-center rounded border border-accent/35 bg-surface-sunken/95 p-2">
      <label htmlFor="greed-card" className="block text-xs text-ink">Give up a card now. Recover it only if you die.</label>
      <select id="greed-card" className="my-2 w-full rounded border border-accent/40 bg-surface p-1 text-sm text-ink" value={cardIndex ?? ''} onChange={e => setCardIndex(e.target.value === '' ? undefined : Number(e.target.value))}>
        <option value="">Choose a card</option>
        {choices.map(({ card, index }) => <option key={index} value={index}>{getCard(card).name}{run.deckImbues?.[index]?.length ? ' (Imbued)' : ''}</option>)}
      </select>
      <div className="flex gap-2">
        <Button variant="menu" onClick={() => onAction({ type: 'greedChoice', cardIndex: null })}>Walk away</Button>
        <Button variant="menuPrimary" disabled={cardIndex === undefined} onClick={() => cardIndex !== undefined && onAction({ type: 'greedChoice', cardIndex })}>Surrender card</Button>
      </div>
    </div>
  </section>;
}
