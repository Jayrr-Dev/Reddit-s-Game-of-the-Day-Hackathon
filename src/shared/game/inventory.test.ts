import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCharacter } from './character.ts';
import { inventoryOf } from './inventory.ts';
import { startingBag } from './items.ts';

test('the inventory lists consumables and owned jewelry, and no cards', () => {
  const [items, ...rest] = inventoryOf({ character: createCharacter(), bag: startingBag() });
  assert.ok(items);
  assert.equal(rest.length, 0);
  assert.deepEqual(
    items.slots.map((slot) => [slot.id, slot.quantity, slot.kind === 'jewelry' && slot.equipped]),
    [['tome-of-regret', 5, false], ['iron-ring', 1, true], ['travelers-amulet', 1, false]]
  );
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
