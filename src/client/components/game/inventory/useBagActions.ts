// ===================================================================
// USE BAG ACTIONS
// The Inventory's move rules in one place. Drag a stack (or tap it,
// then tap a target) to move it: an empty cell, a cell to swap with,
// or the trash. Wearing jewelry stays on the Equipment tab.
// ===================================================================
import { useState } from 'react';
import {
  arrangeBag,
  moveStack,
  placeStack,
  sortBackpack,
  type BagCell,
  type BagLayout,
} from '../../../../shared/game/bagLayout';
import { inventoryStacks, stackKey, type InventoryOwner, type InventorySlot } from '../../../../shared/game/inventory';

// --- TYPES ---
/** Everything a stack can be dropped on. */
export type BagTarget =
  | { kind: 'cell'; cell: BagCell }
  | { kind: 'trash' };
export type BagHandlers = {
  layout: BagLayout | undefined;
  onLayout: (layout: BagLayout) => void;
  onTrash: (stack: InventorySlot) => void;
};

// --- DROP ZONES ---
/** The attribute that marks a square as a drop zone for a dragged stack. */
export const BAG_ZONE_ATTRIBUTE = 'data-bag-zone';

/** Names a target as a drop-zone string, e.g. "cell:belt:2" or "trash". */
export const zoneOf = (target: BagTarget): string =>
  target.kind === 'cell' ? `cell:${target.cell.area}:${target.cell.index}` : 'trash';

/** Reads a drop-zone string back into a target. */
export const targetOf = (zone: string | null): BagTarget | null => {
  const [kind, a, b] = (zone ?? '').split(':');
  if (kind === 'trash') return { kind: 'trash' };
  if (kind === 'cell' && (a === 'backpack' || a === 'belt')) return { kind: 'cell', cell: { area: a, index: Number(b) } };
  return null;
};

// --- HOOK ---
/** Selection, notices and every move the Inventory allows. */
export function useBagActions(owner: InventoryOwner, { layout, onLayout, onTrash }: BagHandlers) {
  const stacks = inventoryStacks(owner);
  const keys = stacks.map(stackKey);
  const bag = arrangeBag(layout, keys);
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const [notice, setNotice] = useState('');
  const stackOf = (key: string | null | undefined) => stacks.find((stack) => stackKey(stack) === key);
  const selected = stackOf(selectedKey);

  /** Selects a stack, or clears the selection when it is tapped again. */
  const toggle = (key: string) => {
    setNotice('');
    setSelectedKey((current) => (current === key ? undefined : key));
  };

  /** Puts a stack into a bag cell, swapping with whatever is there. */
  const toCell = (stack: InventorySlot, cell: BagCell) => {
    const key = stackKey(stack);
    const from = (['backpack', 'belt'] as const).flatMap((area) =>
      bag[area].flatMap((k, index) => (k === key ? [{ area, index }] : [])))[0];
    onLayout(from ? moveStack(bag, from, cell) : placeStack(bag, key, cell));
  };

  /** Moves a stack onto a target, following the trash rule. */
  const drop = (stack: InventorySlot, target: BagTarget) => {
    setNotice('');
    if (target.kind === 'cell') toCell(stack, target.cell);
    else if (!stack.isTrashable) return setNotice('That can’t be trashed.');
    else onTrash(stack);
    setSelectedKey(undefined);
  };

  /** A tap on a target: moves the selected stack there, or selects what the target holds. */
  const tap = (target: BagTarget, heldKey: string | null) => {
    if (heldKey && (!selected || heldKey === selectedKey)) return toggle(heldKey);
    if (selected) return drop(selected, target);
    if (target.kind === 'trash') setNotice('Select an item, then tap the trash.');
  };

  return {
    bag,
    stacks,
    selected,
    notice,
    stackOf,
    tap,
    drop,
    /** Packs the backpack in list order: consumables, then jewelry. */
    sort: () => onLayout(sortBackpack(bag, keys)),
    /** Returns every stack from the belt and spreads the backpack back to its default order. */
    clear: () => onLayout(arrangeBag(undefined, keys)),
  };
}
