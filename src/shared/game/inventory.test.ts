import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCharacter } from './character.ts';
import { inventoryOf, itemCount } from './inventory.ts';
import { startingBag } from './items.ts';
import { starterDeck } from './starters.ts';

test('the inventory lists owned jewelry and stacks the carried deck', () => {
  const character = createCharacter();
  const deck = starterDeck('Warrior');
  const [items, cards] = inventoryOf({ character, deck, bag: startingBag() });
  assert.ok(items && cards);
  assert.deepEqual(
    items.slots.map((slot) => [slot.id, slot.quantity, slot.kind === 'jewelry' && slot.equipped]),
    [['tome-of-regret', 5, false], ['iron-ring', 1, true], ['travelers-amulet', 1, false]]
  );
  assert.equal(itemCount(cards.slots), deck.length);
  assert.ok(cards.slots.length < deck.length, 'duplicate cards share one slot');
  assert.equal(items.slots.length + items.emptySlots, 8);
});
