// ===================================================================
// OFFER VIEW
// Pick one of three cards (after a won fight, or at the dark altar).
// ===================================================================

import type { CardId } from '../../../shared/game/cards';
import { playSound } from '../../lib/gameAudio';
import { useState } from 'react';
import type { RunAction } from '../../../shared/game/run';
import { Button } from '../ui/Button';
import { CardView } from './CardView';
import { RingUnlockNotice } from './RingUnlockNotice';

export type OfferViewProps = {
  title: string;
  rerolls?: number;
  subtitle: string;
  offers: CardId[];
  unlockedRingSlot?: number | undefined;
  onAction: (action: RunAction) => void;
};

/** Shows the offers and a skip button. */
export const OfferView = ({
  title,
  rerolls,
  subtitle,
  offers,
  unlockedRingSlot,
  onAction,
}: OfferViewProps) => {
  const [selected, setSelected] = useState<number | null>(null);
  return (
  <div className={`${rerolls === undefined ? 'run-panel' : 'spoils-offer'} flex flex-col items-center gap-4`}>
    <div className="text-center">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="text-sm text-ink-muted" aria-live="polite">{selected === null ? subtitle : 'Select the highlighted card again to add it.'}</p>
    </div>
    {unlockedRingSlot !== undefined && <RingUnlockNotice slots={[unlockedRingSlot]} />}
    <div className="flex flex-wrap justify-center gap-3">
      {offers.map((cardId, offerIndex) => (
        <CardView
          key={`${cardId}-${offerIndex}`}
          cardId={cardId}
          selected={selected === offerIndex}
          onClick={() => { if (selected === offerIndex) { playSound('reward', 1.15, .68); onAction({ type: 'pickCard', offerIndex }); } else setSelected(offerIndex); }}
        />
      ))}
    </div>
    <div className="flex items-center justify-center gap-2">
    {rerolls !== undefined && <Button variant="menu" className="whitespace-nowrap" disabled={!rerolls}
      onClick={() => { playSound('shuffle'); setSelected(null); onAction({ type: 'rerollReward' }); }}>Reroll ({rerolls})</Button>}
    <Button
      variant="menu" className="max-w-40"
      onClick={() => onAction({ type: 'pickCard', offerIndex: null })}
    >
      Skip
    </Button>
    </div>
  </div>
  );
};
