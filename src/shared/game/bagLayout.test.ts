import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrangeBag, isBagLayout, moveStack, placeStack, sortBackpack } from './bagLayout.ts';

test('arranging keeps saved spots, drops lost stacks and fills new ones in', () => {
  const saved = { backpack: [null, 'a', 'gone'], belt: ['b'] };
  const bag = arrangeBag(saved, ['a', 'b', 'c']);
  assert.equal(bag.backpack.length, 16);
  assert.equal(bag.belt.length, 3);
  assert.deepEqual(bag.backpack.slice(0, 3), ['c', 'a', null]);
  assert.equal(bag.belt[0], 'b');
  assert.ok(isBagLayout(bag));
});

test('the backpack grows by a row when full', () => {
  const keys = Array.from({ length: 17 }, (_, i) => 'k' + i);
  assert.equal(arrangeBag(undefined, keys).backpack.length, 20);
});

test('moving onto a stack swaps; sorting packs the backpack in order', () => {
  const bag = arrangeBag(undefined, ['a', 'b']);
  const swapped = moveStack(bag, { area: 'backpack', index: 0 }, { area: 'backpack', index: 1 });
  assert.deepEqual(swapped.backpack.slice(0, 2), ['b', 'a']);
  const belted = moveStack(swapped, { area: 'backpack', index: 0 }, { area: 'belt', index: 2 });
  assert.equal(belted.belt[2], 'b');
  const spread = moveStack(belted, { area: 'backpack', index: 1 }, { area: 'backpack', index: 9 });
  assert.deepEqual(sortBackpack(spread, ['a']).backpack.slice(0, 2), ['a', null]);
});

test('placing a stack moves it and pushes the occupant to a free cell', () => {
  const bag = arrangeBag(undefined, ['a', 'b']);
  const placed = placeStack(bag, 'b', { area: 'backpack', index: 0 });
  assert.deepEqual(placed.backpack.slice(0, 3), ['b', 'a', null]);
});
