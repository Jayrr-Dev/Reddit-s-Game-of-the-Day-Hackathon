import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_CARD_IDS, getCard, isCardInPlay, type CardId } from './cards.ts';
import {
  addCardToDeck,
  CARD_TYPE_ORDER,
  groupCardsByType,
  removeCardFromDeck,
  stackDeck,
} from './deckBuilder.ts';
import { CUSTOM_DECK_LIMIT } from './sandboxDecks.ts';

const catalog = ALL_CARD_IDS.filter(isCardInPlay);
const [first, second] = catalog as [CardId, CardId];

test('catalog groups follow the type order, each A to Z, with every card once', () => {
  const groups = groupCardsByType(catalog);
  const order = groups.map((group) => CARD_TYPE_ORDER.indexOf(group.type));
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b)
  );
  for (const group of groups) {
    assert.ok(group.cards.length > 0);
    assert.ok(group.cards.every((id) => getCard(id).type === group.type));
    const names = group.cards.map((id) => getCard(id).name);
    assert.deepEqual(
      names,
      [...names].sort((a, b) => a.localeCompare(b))
    );
  }
  assert.equal(groups.flatMap((group) => group.cards).length, catalog.length);
});

test('adding appends a copy and stops at the deck limit', () => {
  assert.deepEqual(addCardToDeck([first], second), [first, second]);
  const full = Array<CardId>(CUSTOM_DECK_LIMIT).fill(first);
  assert.equal(addCardToDeck(full, second).length, CUSTOM_DECK_LIMIT);
});

test('removing takes the last copy and ignores cards not in the deck', () => {
  assert.deepEqual(removeCardFromDeck([first, second, first], first), [
    first,
    second,
  ]);
  assert.deepEqual(removeCardFromDeck([first], second), [first]);
});

test('stacks count copies in first-added order', () => {
  assert.deepEqual(stackDeck([second, first, second]), [
    { id: second, count: 2 },
    { id: first, count: 1 },
  ]);
});
