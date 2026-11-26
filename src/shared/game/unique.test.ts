import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_CARD_IDS, cardsOfRarity, isCardInPlay, type CardId } from './cards.ts';
import { addCardToDeck, addCardBlocker } from './deckBuilder.ts';
import { rollOffers } from './rewards.ts';
import { hashSeed } from './rng.ts';
import {
  isUniqueInDeck,
  keepsUniqueLimit,
  withoutExtraUniques,
} from './unique.ts';

const [solo, other] = ALL_CARD_IDS.filter(isCardInPlay) as [CardId, CardId];
/** Pretends `solo` is printed with Unique. */
const soloIsUnique = (id: CardId) => id === solo;

test('a Unique card already in the deck blocks a second copy', () => {
  assert.equal(isUniqueInDeck([], solo, soloIsUnique), false);
  assert.equal(isUniqueInDeck([solo], solo, soloIsUnique), true);
  assert.equal(isUniqueInDeck([other], other, soloIsUnique), false);
});

test('the deck builder refuses a second Unique copy and says why', () => {
  assert.equal(addCardBlocker([solo], solo, soloIsUnique), 'unique');
  assert.equal(addCardBlocker([solo], other, soloIsUnique), null);
  assert.deepEqual(addCardToDeck([solo], solo, soloIsUnique), [solo]);
  assert.deepEqual(addCardToDeck([other], other, soloIsUnique), [other, other]);
});

test('deck checks spot and drop extra Unique copies', () => {
  assert.equal(keepsUniqueLimit([solo, other, other], soloIsUnique), true);
  assert.equal(keepsUniqueLimit([solo, other, solo], soloIsUnique), false);
  assert.deepEqual(withoutExtraUniques([solo, other, solo, other], soloIsUnique), [solo, other, other]);
});

test('rewards never offer a Unique card the deck already holds', () => {
  const rare = cardsOfRarity('rare')[0]!;
  const rareIsUnique = (id: CardId) => id === rare;
  const rolls = Array.from({ length: 60 }, (_, day) => hashSeed(`unique-${day}`));
  const offered = (deck: CardId[]) =>
    rolls.some((seed) => rollOffers(seed, 'altar', [], undefined, [], deck, rareIsUnique).includes(rare));
  assert.equal(offered([]), true);
  assert.equal(offered([rare]), false);
});
