// ===================================================================
// SANDBOX DECKS (TARGET DUMMIES)
// Themed test decks for practice: each is a RULE over the card data
// (which cards fit the theme), never a hand-kept list, so a new card
// joins every deck it fits on its own. A deck holds each fitting card
// DECK_COPIES times, so the theme shows up in nearly every hand.
// Add a deck by adding an entry to SANDBOX_DECKS.
// ===================================================================

import { newestCardIds } from './cardReleases.ts';
import { ALL_CARD_IDS, getCard, isCardId, isCardInPlay, type CardId } from './cards.ts';
import type { CardDef, CardEffect } from './types.ts';
import { isUniqueCard, keepsUniqueLimit, withoutExtraUniques } from './unique.ts';

// --- TYPES ---
const DECKSET_IDS = ['archerSet', 'meleeSet', 'magicSet', 'cursedSet', 'guardSet', 'movementSet', 'imbueSet', 'otherSet'] as const;
export type DecksetId = typeof DECKSET_IDS[number];
export type SandboxDeckId =
  | DecksetId
  | 'all'
  | 'newCards'
  | 'stackedBuffs'
  | 'lightning'
  | 'hex'
  | 'fire'
  | 'poison'
  | 'bleed'
  | 'afflictions'
  | 'sharp'
  | 'blunt'
  | 'range'
  | 'movement'
  | 'defense';

/** A themed test deck: its name, a line on it, and which cards fit. */
export type SandboxDeck = {
  id: SandboxDeckId;
  name: string;
  blurb: string;
  copies?: number;
  fits: (card: CardDef, id: CardId) => boolean;
};

// --- CONSTANTS ---
/** Copies of each fitting card in a themed deck (the full deck has 1). */
const DECK_COPIES = 2;

/** How many of the newest cards the "New cards" deck holds. */
export const NEW_CARDS_COUNT = 10;

/** The newest cards, read once: the catalog is static at runtime. */
const NEWEST_CARD_IDS: ReadonlySet<CardId> = new Set(newestCardIds(NEW_CARDS_COUNT));

// --- HELPERS ---
/** The effect itself, or the effect an Imbue card grants. */
const effectsOf = (card: CardDef): CardEffect['kind'][] =>
  card.effects.map((effect) =>
    effect.kind === 'imbue' && effect.gift.kind === 'effect'
      ? effect.gift.effect.kind
      : effect.kind
  );

/** True when the card has (or imbues) any effect of these kinds. */
const hasEffect =
  (...kinds: CardEffect['kind'][]) =>
  (card: CardDef): boolean =>
    effectsOf(card).some((kind) => kinds.includes(kind));

/** True when the card hits more than once (Shock needs SHOCK_HITS a turn). */
const isMultiHit = (card: CardDef): boolean =>
  card.targets > 1 ||
  card.effects.some((effect) => effect.kind === 'damage' && effect.hits > 1);

/** True when the card buffs one of these (e.g. Hone, Sharpshooter). */
const buffsAny =
  (...buffs: string[]) =>
  (card: CardDef): boolean =>
    card.effects.some(
      (effect) => effect.kind === 'buff' && buffs.includes(effect.buff)
    );

/** True when the card has (or imbues) one of these keywords. */
const hasKeyword =
  (...keywords: string[]) =>
  (card: CardDef): boolean =>
    card.keywords.some((keyword) => keywords.includes(keyword)) ||
    card.effects.some(
      (effect) =>
        effect.kind === 'imbue' &&
        effect.gift.kind === 'keyword' &&
        keywords.includes(effect.gift.keyword)
    );

/** True when any of the rules fits. */
const anyOf =
  (...rules: ((card: CardDef) => boolean)[]) =>
  (card: CardDef): boolean =>
    rules.some((rule) => rule(card));

/** Keep established playstyles, then sort general cards by their primary job. */
export function decksetOf(card: CardDef): DecksetId {
  if (card.type === 'range') return 'archerSet';
  if (card.type === 'melee') return 'meleeSet';
  if (card.type === 'magic') return 'magicSet';
  if (card.type === 'curse') return 'cursedSet';
  const matches: DecksetId[] = [];
  if (buffsAny('hone', 'sharpshooter')(card) || hasKeyword('longRange')(card)) matches.push('archerSet');
  if (buffsAny('might', 'berserker')(card) || hasEffect('momentum', 'charge')(card)) matches.push('meleeSet');
  if (buffsAny('surge')(card)) matches.push('magicSet');
  if (buffsAny('bane')(card)) matches.push('cursedSet');
  if (matches.length === 1) return matches[0]!;
  if (card.type === 'imbue') return 'imbueSet';
  if (card.type === 'movement' || hasEffect('rush', 'move', 'backStep')(card)) return 'movementSet';
  if (card.type === 'defend' || hasEffect('guard', 'armor', 'protect', 'brace')(card) ||
      buffsAny('instinct', 'reinforce')(card)) return 'guardSet';
  return 'otherSet';
}

// --- TABLE ---
const DECKSET_LABELS = {
  archerSet: ['Archer Deckset', 'Bows, ranged attacks and aim buffs.'],
  meleeSet: ['Melee Deckset', 'Close-range attacks and melee support.'],
  magicSet: ['Magic Deckset', 'Spells and magic support.'],
  cursedSet: ['Cursed Deckset', 'Hex, curses and affliction support.'],
  guardSet: ['Guard Deckset', 'Guard, Armor, Protection, Brace and dodge.'],
  movementSet: ['Movement Deckset', 'General repositioning, Rush and mobility.'],
  imbueSet: ['Imbue Deckset', 'Shared card upgrades and granted keywords.'],
  otherSet: ['Utility Deckset', 'Healing, cleanse, draw, energy and shared buffs.'],
} satisfies Record<DecksetId, readonly [string, string]>;

export const SANDBOX_DECKSETS: readonly SandboxDeck[] = DECKSET_IDS
  .map(id => ({ id, name: DECKSET_LABELS[id][0], blurb: DECKSET_LABELS[id][1], copies: 1,
    fits: card => decksetOf(card) === id }));

export const SANDBOX_DECKS: readonly SandboxDeck[] = [
  {
    id: 'all',
    name: 'Every card',
    blurb: 'One of each card in the game.',
    fits: () => true,
  },
  ...SANDBOX_DECKSETS,
  {
    id: 'newCards',
    name: 'New cards',
    blurb: `The ${NEW_CARDS_COUNT} newest cards in the game, to try them out.`,
    fits: (_card, id) => NEWEST_CARD_IDS.has(id),
  },
  {
    id: 'stackedBuffs',
    name: 'Stacked Buffs',
    blurb: 'Bulwark, Instinct, Sap Strength and Sap. Practice Tier IV and Malaise.',
    copies: 4,
    fits: anyOf(hasEffect('protect', 'enfeeble'), buffsAny('instinct')),
  },
  {
    id: 'lightning',
    name: 'Lightning',
    blurb: 'Lightning spells, Shock and multi-hit cards to set it off.',
    fits: anyOf(
      hasEffect('shock', 'amplify'),
      (card) => card.element === 'lightning',
      isMultiHit
    ),
  },
  {
    id: 'hex',
    name: 'Hex & curses',
    blurb: 'Curses, Hex, Reap and Vex.',
    fits: anyOf(
      (card) => card.type === 'curse',
      hasEffect('hex', 'reap', 'vex')
    ),
  },
  {
    id: 'fire',
    name: 'Fire',
    blurb: 'Burn and fire spells, plus Bane.',
    fits: anyOf(
      hasEffect('burn'),
      (card) => card.element === 'fire',
      buffsAny('bane')
    ),
  },
  {
    id: 'poison',
    name: 'Poison',
    blurb: 'Poison darts, coats and thorns, plus Bane.',
    fits: anyOf(hasEffect('poison'), buffsAny('bane')),
  },
  {
    id: 'bleed',
    name: 'Bleed',
    blurb: 'Blades and barbs that open wounds, plus Bane.',
    fits: anyOf(hasEffect('bleed'), buffsAny('bane')),
  },
  {
    id: 'afflictions',
    name: 'Afflictions',
    blurb: 'Frost, Weaken, Enfeeble, Vex and Bane.',
    fits: anyOf(
      hasEffect('frost', 'weaken', 'enfeeble', 'vex'),
      (card) => card.element === 'ice',
      buffsAny('bane')
    ),
  },
  {
    id: 'sharp',
    name: 'Sharp melee',
    blurb: 'Blades: every Sharp Melee card.',
    fits: (card) => card.edge === 'sharp',
  },
  {
    id: 'blunt',
    name: 'Blunt melee',
    blurb: 'Single heavy blows, Knockback and Rampage.',
    fits: (card) => card.edge === 'blunt',
  },
  {
    id: 'range',
    name: 'Range',
    blurb: 'Bows plus Hone, Sharpshooter and Longrange.',
    fits: anyOf(
      (card) => card.type === 'range',
      buffsAny('hone', 'sharpshooter'),
      hasKeyword('longRange')
    ),
  },
  {
    id: 'movement',
    name: 'Movement',
    blurb: 'Pull, Knockback, Rush, Rampage and Distance.',
    fits: anyOf(
      hasEffect('pull', 'push', 'rush', 'move'),
      hasKeyword('rampage', 'distance'),
      buffsAny('berserker')
    ),
  },
  {
    id: 'defense',
    name: 'Defense',
    blurb: 'Guard, Armor, Protection and Brace.',
    fits: anyOf(
      (card) => card.type === 'defend',
      hasEffect('guard', 'armor', 'protect', 'brace')
    ),
  },
];

// --- PUBLIC API ---
/** The deck with this id (the full deck if unknown). */
const deckOf = (id: SandboxDeckId): SandboxDeck =>
  SANDBOX_DECKS.find((deck) => deck.id === id) ?? SANDBOX_DECKS[0]!;

/** The cards of a test deck: every fitting card in play, DECK_COPIES each. */
export const sandboxDeckCards = (id: SandboxDeckId): CardId[] => {
  const deck = deckOf(id);
  const copies = deck.copies ?? (deck.id === 'all' ? 1 : DECK_COPIES);
  // A Unique card gets one copy whatever the deck's copy count.
  return ALL_CARD_IDS.filter(isCardInPlay)
    .filter((cardId) => deck.fits(getCard(cardId), cardId))
    .flatMap((cardId) => Array.from({ length: isUniqueCard(cardId) ? 1 : copies }, () => cardId));
};

export const CUSTOM_DECK_LIMIT = 100;
export type CustomTrainingDeck = { id: string; name: string; cards: CardId[] };
export type TrainingDeckSelection = {
  deckId: SandboxDeckId;
  activeCustomId: string | null;
  customDecks: CustomTrainingDeck[];
};

/** True for a saved custom deck: 1 to CUSTOM_DECK_LIMIT real cards, one copy of each Unique card. */
export const isCustomDeckList = (cards: unknown): cards is CardId[] =>
  Array.isArray(cards) && cards.length > 0 && cards.length <= CUSTOM_DECK_LIMIT &&
  Array.from(cards).every(isCardId) && keepsUniqueLimit(cards);

export const activeTrainingCards = (selection: TrainingDeckSelection): CardId[] =>
  selection.customDecks.find(deck => deck.id === selection.activeCustomId)?.cards ??
  sandboxDeckCards(selection.deckId);

export const restoreTrainingDecks = (saved: unknown): TrainingDeckSelection => {
  const initial: TrainingDeckSelection = { deckId: 'all', activeCustomId: null, customDecks: [] };
  if (!saved || typeof saved !== 'object') return initial;
  if ('deckId' in saved) initial.deckId = SANDBOX_DECKS.find(deck => deck.id === saved.deckId)?.id ?? 'all';
  if ('customDecks' in saved && Array.isArray(saved.customDecks)) {
    for (const value of saved.customDecks) {
      if (!value || typeof value.id !== 'string' || !value.id.trim() ||
          initial.customDecks.some(deck => deck.id === value.id) || typeof value.name !== 'string' ||
          !value.name.trim()) continue;
      // A card made Unique after the deck was saved keeps one copy instead of losing the deck.
      const cards = Array.isArray(value.cards) && value.cards.every(isCardId) ? withoutExtraUniques(value.cards) : null;
      if (!isCustomDeckList(cards)) continue;
      initial.customDecks.push({ id: value.id, name: value.name.trim(), cards });
    }
  }
  if ('activeCustomId' in saved)
    initial.activeCustomId = initial.customDecks.find(deck => deck.id === saved.activeCustomId)?.id ?? null;
  return initial;
};

/** Apply a new deck or replace its existing record, preserving copy counts and order. */
export const saveTrainingDeck = (
  selection: TrainingDeckSelection, id: string, name: string, cards: readonly CardId[], editing: boolean
): TrainingDeckSelection => {
  if (!id.trim() || !name.trim() || !isCustomDeckList(cards)) return selection;
  const exists = selection.customDecks.some(deck => deck.id === id);
  if (exists !== editing) return selection;
  const deck = { id, name: name.trim(), cards: [...cards] };
  return { ...selection, activeCustomId: id, customDecks: exists
    ? selection.customDecks.map(current => current.id === id ? deck : current)
    : [...selection.customDecks, deck] };
};
