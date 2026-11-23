// ===================================================================
// OFFER VIEW
// Pick one of three cards (after a won fight, or at the dark altar).
// ===================================================================

import type { CardId } from '../../../shared/game/cards';
import type { RunAction } from '../../../shared/game/run';
import { Button } from '../ui/Button';
import { CardView } from './CardView';

export type OfferViewProps = {
  title: string;
  subtitle: string;
  offers: CardId[];
  onAction: (action: RunAction) => void;
};

/** Shows the offers and a skip button. */
export const OfferView = ({
  title,
  subtitle,
  offers,
  onAction,
}: OfferViewProps) => (
  <div className="flex flex-col items-center gap-4">
    <div className="text-center">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="text-sm text-ink-muted">{subtitle}</p>
    </div>
    <div className="flex flex-wrap justify-center gap-3">
      {offers.map((cardId, offerIndex) => (
        <CardView
          key={`${cardId}-${offerIndex}`}
          cardId={cardId}
          onClick={() => onAction({ type: 'pickCard', offerIndex })}
        />
      ))}
    </div>
    <Button
      variant="ghost"
      onClick={() => onAction({ type: 'pickCard', offerIndex: null })}
    >
      Skip
    </Button>
  </div>
);
