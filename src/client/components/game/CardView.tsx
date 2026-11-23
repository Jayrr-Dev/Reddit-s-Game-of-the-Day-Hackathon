// ===================================================================
// CARD VIEW
// One card face: cost, name, art glyph and rules text. Used in the hand
// and in reward offers. The text comes from describeCard, so it always
// matches what the card really does (including live wrath/dread math).
// ===================================================================

import { getCard, type CardId } from '../../../shared/game/cards';
import { cardCategory, describeCard } from '../../../shared/game/describe';
import type { Combatant } from '../../../shared/game/types';
import { CARD_LOOK } from '../../content/visuals';
import { Glyph } from '../ui/Glyph';

// --- TYPES ---
export type CardViewProps = {
  cardId: CardId;
  /** When given, damage numbers include this attacker's wrath and dread. */
  attacker?: Combatant;
  isDisabled?: boolean;
  /** "hand" cards shrink to fit five across a phone; "offer" cards are full size. */
  size?: CardSize;
  onClick: () => void;
};

export type CardSize = 'hand' | 'offer';

// --- CONSTANTS ---
const SIZE_CLASSES: Record<CardSize, string> = {
  hand: 'h-32 min-w-16 max-w-24 flex-1',
  offer: 'h-36 w-24 shrink-0',
};

const RARITY_RING: Record<string, string> = {
  starter: 'ring-edge',
  common: 'ring-edge',
  uncommon: 'ring-shroud',
  rare: 'ring-accent',
};

// --- COMPONENT ---
/** Renders a tappable card. */
export const CardView = ({
  cardId,
  attacker,
  isDisabled = false,
  size = 'offer',
  onClick,
}: CardViewProps) => {
  const cardDef = getCard(cardId);
  const look = CARD_LOOK[cardCategory(cardId)];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`relative flex ${SIZE_CLASSES[size]} flex-col items-center gap-1 rounded-lg ${look.frameClass} p-1.5 text-center ring-2 ${RARITY_RING[cardDef.rarity] ?? 'ring-edge'} transition-transform enabled:hover:-translate-y-1 disabled:opacity-40 animate-rise`}
    >
      <span className="absolute -left-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-energy text-xs font-black text-on-accent ring-2 ring-surface">
        {cardDef.cost}
      </span>
      <span className="mt-3 font-display text-[11px] font-bold leading-tight">
        {cardDef.name}
      </span>
      <Glyph name={look.glyph} className="size-7 text-ink/80" />
      <span className="flex flex-1 flex-col justify-center rounded bg-surface-sunken/70 px-1 text-[10px] leading-snug">
        {describeCard(cardId, attacker).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </button>
  );
};
