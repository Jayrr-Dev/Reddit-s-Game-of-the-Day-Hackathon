// ===================================================================
// UNIQUE
// The Unique keyword: a deck may hold only one copy of a Unique card.
// Every place that builds a deck (the deck builder, saved custom
// decks, test decks, card rewards) asks this one module, so the rule
// lives here and nowhere else.
//
// Each check takes an optional `isUnique` predicate (defaulting to the
// printed keyword) so tests can prove the rule without a real Unique
// card existing.
// ===================================================================

import { hasKeyword, type CardId } from './cards.ts';

// --- TYPES ---
/** Says whether a card is Unique (the printed keyword by default). */
export type UniqueCheck = (id: CardId) => boolean;

// --- RULES ---
/** True when the card is printed with Unique. */
export const isUniqueCard: UniqueCheck = (id) => hasKeyword(id, 'unique');

/** True when one more copy of `id` would break the one-per-deck limit. */
export const isUniqueInDeck = (
  deck: readonly CardId[],
  id: CardId,
  isUnique: UniqueCheck = isUniqueCard
): boolean => isUnique(id) && deck.includes(id);

/** True when no Unique card appears more than once in the deck. */
export const keepsUniqueLimit = (
  deck: readonly CardId[],
  isUnique: UniqueCheck = isUniqueCard
): boolean => deck.every((id, at) => !isUnique(id) || deck.indexOf(id) === at);

/** Drops every extra copy of a Unique card, keeping the first one. */
export const withoutExtraUniques = (
  deck: readonly CardId[],
  isUnique: UniqueCheck = isUniqueCard
): CardId[] => deck.filter((id, at) => !isUnique(id) || deck.indexOf(id) === at);
