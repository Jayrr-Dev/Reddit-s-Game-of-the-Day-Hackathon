import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCharacter } from './character.ts';
import { backpackStacks, inventoryOf, inventoryStacks, stackKey } from './inventory.ts';
import { startingBag } from './items.ts';

test('the inventory lists consumables and owned jewelry, and no unowned cards', () => {
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

test('equipped jewelry stays out of the backpack until unequipped', async () => {
  const { equipItem } = await import('./character.ts');
  const character = createCharacter();
  assert.ok(!backpackStacks({ character, bag: {} }).some(slot => slot.id === 'iron-ring'));
  const unequipped = equipItem(character, 'ring', null, 0);
  assert.ok(backpackStacks({ character: unequipped, bag: {} }).some(slot => slot.id === 'iron-ring'));
});

test('unspent shop cards appear as backpack stacks under their real card names', () => {
  const slots = inventoryStacks({ character: createCharacter(), bag: startingBag(), carryCards: [
    { id: 'test-shop:2026-11-27T12.0', source: 'shop', cardId: 'beckon' },
    { id: 'test:0', source: 'test', cardId: 'keenEdge', spent: 'run' },
  ] });
  const card = slots.find(slot => slot.kind === 'card');
  assert.ok(card);
  assert.equal(card.name, 'Beckon');
  assert.equal(stackKey(card), 'card:test-shop:2026-11-27T12.0');
  assert.equal(slots.filter(slot => slot.kind === 'card').length, 1);
});
