import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isItemBag, itemQuantity, RESPEC_ITEM, spendItem, startingBag } from './items.ts';

test('a new player starts with five Tomes of Regret and each respec spends one', () => {
  const bag = startingBag();
  assert.equal(itemQuantity(bag, RESPEC_ITEM), 5);
  assert.ok(isItemBag(bag));
  const after = spendItem(bag, RESPEC_ITEM);
  assert.equal(after && itemQuantity(after, RESPEC_ITEM), 4);
  assert.equal(spendItem({ [RESPEC_ITEM]: 0 }, RESPEC_ITEM), null);
});

test('saved bags reject unknown items and bad counts', () => {
  assert.equal(isItemBag({ 'gold-bar': 2 }), false);
  assert.equal(isItemBag({ [RESPEC_ITEM]: -1 }), false);
  assert.equal(isItemBag({ [RESPEC_ITEM]: 1.5 }), false);
});
