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
  /** Lifted and outlined while the player is choosing its target. */
  isSelected?: boolean;
  /** "fan" cards sit in the fanned hand; "offer" cards are full size. */
  size?: CardSize;
  onClick: () => void;
};

export type CardSize = 'fan' | 'offer';

// --- CONSTANTS ---
const SIZE_CLASSES: Record<CardSize, string> = {
  fan: 'h-28 w-[4.25rem] shrink-0',
  offer: 'h-36 w-24 shrink-0',
};

/** Rules text size: fanned hand cards are smaller than offers. */
const TEXT_CLASSES: Record<CardSize, string> = {
  fan: 'text-[9px] leading-tight',
  offer: 'text-[10px] leading-snug',
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
  isSelected = false,
  size = 'offer',
  onClick,
}: CardViewProps) => {
  const cardDef = getCard(cardId);
  const look = CARD_LOOK[cardCategory(cardId)];
  const ringClass = isSelected
    ? 'ring-accent -translate-y-4 shadow-[0_0_14px_var(--color-accent)]'
    : (RARITY_RING[cardDef.rarity] ?? 'ring-edge');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`relative flex ${SIZE_CLASSES[size]} flex-col items-center gap-1 rounded-lg ${look.frameClass} p-1.5 text-center shadow-lg ring-2 ${ringClass} transition-transform enabled:hover:-translate-y-1 disabled:opacity-40 animate-rise`}
    >
      <span className="absolute -left-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-energy text-xs font-black text-on-accent ring-2 ring-surface">
        {cardDef.cost}
      </span>
      <span className="mt-2 font-display text-[11px] font-bold leading-tight">
        {cardDef.name}
      </span>
      {size === 'offer' && (
        <Glyph name={look.glyph} className="size-6 shrink-0 text-ink/80" />
      )}
      <span
        className={`flex w-full flex-1 flex-col justify-center rounded bg-surface-sunken/70 px-0.5 ${TEXT_CLASSES[size]}`}
      >
        {describeCard(cardId, attacker).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </button>
  );
};
