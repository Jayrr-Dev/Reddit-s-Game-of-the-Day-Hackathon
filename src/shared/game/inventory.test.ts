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
  assert.ok(cards.slots.every((slot) => !slot.isTrashable), 'starter deck cards stay');
  assert.ok(items.slots.every((slot) => slot.isTrashable));
});

test('trashing a worn ring removes it from the bag and its slot, and saves as a profile edit', async () => {
  const { applyCharacterAction, isRunAction } = await import('./run.ts');
  const { characterEdit } = await import('./playerBuild.ts');
  const action = { type: 'discardItem', itemId: 'iron-ring' } as const;
  assert.ok(isRunAction(action) && characterEdit(action));
  const character = applyCharacterAction(createCharacter(), action);
  assert.equal(character.inventory.some((item) => item.id === 'iron-ring'), false);
  assert.equal(character.equipment.rings[0], null);
});
