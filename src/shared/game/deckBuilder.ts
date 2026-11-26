// ===================================================================
// DECK BUILDER
// Pure rules behind the Create deck screen: how the card catalog is
// grouped and sorted, and how a card is added to or removed from a
// deck list. The deck itself stays a plain CardId[] so it saves through
// the existing custom-deck code unchanged.
// ===================================================================

import { getCard, type CardId } from './cards.ts';
import { CUSTOM_DECK_LIMIT } from './sandboxDecks.ts';
import type { CardType } from './types.ts';

// --- TYPES ---
export type CardTypeGroup = { type: CardType; cards: CardId[] };
export type DeckStack = { id: CardId; count: number };

// --- GROUP ORDER ---
/** Attack types first, then cards that act on the villain, then the rest. */
export const CARD_TYPE_ORDER: readonly CardType[] = [
  'melee',
  'range',
  'magic',
  'curse',
  'defend',
  'buff',
  'imbue',
  'utility',
  'movement',
];

// --- CATALOG ---
/** Sorts card ids alphabetically by their printed name. */
const byCardName = (a: CardId, b: CardId) =>
  getCard(a).name.localeCompare(getCard(b).name);

/** Groups cards by type in CARD_TYPE_ORDER, A to Z inside each group; empty groups are left out. */
export const groupCardsByType = (ids: readonly CardId[]): CardTypeGroup[] =>
  CARD_TYPE_ORDER.map((type) => ({
    type,
    cards: ids.filter((id) => getCard(id).type === type).sort(byCardName),
  })).filter((group) => group.cards.length > 0);

// --- DECK EDITS ---
/** True while the deck has room for one more card. */
export const hasDeckRoom = (deck: readonly CardId[]) =>
  deck.length < CUSTOM_DECK_LIMIT;

/** Appends one copy, or returns the same deck when it is already full. */
export const addCardToDeck = (deck: readonly CardId[], id: CardId): CardId[] =>
  hasDeckRoom(deck) ? [...deck, id] : [...deck];

/** Removes the last copy of a card, leaving the others in their order. */
export const removeCardFromDeck = (
  deck: readonly CardId[],
  id: CardId
): CardId[] => {
  const index = deck.lastIndexOf(id);
  return index < 0 ? [...deck] : deck.filter((_, at) => at !== index);
};

/** Folds copies into one stack per card, in the order each card was first added. */
export const stackDeck = (deck: readonly CardId[]): DeckStack[] => {
  const counts = new Map<CardId, number>();
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ id, count }));
};
