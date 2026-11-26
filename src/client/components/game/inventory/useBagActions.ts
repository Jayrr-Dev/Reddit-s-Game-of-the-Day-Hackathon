// ===================================================================
// USE BAG ACTIONS
// The Inventory's move rules in one place. A tap selects a stack, and a
// tap on a target (or a mouse drag onto it) moves it there: an empty
// cell, a cell to swap with, an equipment slot of the right type, or
// the trash. Taps work on phones; mouse drag is a desktop shortcut.
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
import { ringSlotAccepts, type EquipmentSlot } from '../../../../shared/game/character';
import { inventoryStacks, stackKey, type InventoryOwner, type InventorySlot } from '../../../../shared/game/inventory';

// --- TYPES ---
/** An equipment slot: the amulet, or one ring slot. */
export type EquipTarget = { slot: EquipmentSlot; ringIndex?: number };
/** Everything a stack can be dropped on. */
export type BagTarget =
  | { kind: 'cell'; cell: BagCell }
  | { kind: 'equip'; target: EquipTarget }
  | { kind: 'trash' };
export type BagHandlers = {
  layout: BagLayout | undefined;
  onLayout: (layout: BagLayout) => void;
  onEquip: (slot: EquipmentSlot, itemId: string | null, ringIndex?: number) => void;
  onTrash: (stack: InventorySlot) => void;
};

// --- DROP ZONES ---
/** The attribute that marks a square as a drop zone for a dragged stack. */
export const BAG_ZONE_ATTRIBUTE = 'data-bag-zone';

/** Names a target as a drop-zone string, e.g. "cell:belt:2" or "equip:ring:1". */
export const zoneOf = (target: BagTarget): string =>
  target.kind === 'cell' ? `cell:${target.cell.area}:${target.cell.index}`
    : target.kind === 'equip' ? `equip:${target.target.slot}:${target.target.ringIndex ?? ''}`
      : 'trash';

/** Reads a drop-zone string back into a target. */
export const targetOf = (zone: string | null): BagTarget | null => {
  const [kind, a, b] = (zone ?? '').split(':');
  if (kind === 'trash') return { kind: 'trash' };
  if (kind === 'cell' && (a === 'backpack' || a === 'belt')) return { kind: 'cell', cell: { area: a, index: Number(b) } };
  if (kind === 'equip' && (a === 'ring' || a === 'amulet'))
    return { kind: 'equip', target: a === 'ring' ? { slot: a, ringIndex: Number(b) } : { slot: a } };
  return null;
};

// --- HELPERS ---
/** Where an equipped ring or amulet is worn, if it is. */
const wornAt = (owner: InventoryOwner, id: string): EquipTarget | undefined => {
  const { rings, amulet } = owner.character.equipment;
  if (amulet === id) return { slot: 'amulet' };
  const ringIndex = rings.indexOf(id);
  return ringIndex >= 0 ? { slot: 'ring', ringIndex } : undefined;
};

/** Why a stack can't go into an equipment slot, or undefined when it fits. */
export const equipRefusal = (owner: InventoryOwner, stack: InventorySlot, target: EquipTarget) => {
  const slotName = target.slot === 'ring' ? 'rings' : 'an amulet';
  if (stack.kind !== 'jewelry' || stack.slot !== target.slot) return `Only ${slotName} fit here.`;
  if (target.ringIndex !== undefined && !ringSlotAccepts(owner.character, target.ringIndex, stack.id))
    return 'That ring slot is locked.';
  return undefined;
};

// --- HOOK ---
/** Selection, notices and every move the Inventory allows. */
export function useBagActions(owner: InventoryOwner, { layout, onLayout, onEquip, onTrash }: BagHandlers) {
  const stacks = inventoryStacks(owner);
  const inBag = stacks.filter((stack) => !(stack.kind === 'jewelry' && stack.equipped));
  const bag = arrangeBag(layout, inBag.map(stackKey));
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const [notice, setNotice] = useState('');
  const stackOf = (key: string | null | undefined) => stacks.find((stack) => stackKey(stack) === key);
  const selected = stackOf(selectedKey);

  /** Selects a stack, or clears the selection when it is tapped again. */
  const toggle = (key: string) => {
    setNotice('');
    setSelectedKey((current) => (current === key ? undefined : key));
  };

  /** Puts a stack into a bag cell, taking it off first if it was worn. */
  const toCell = (stack: InventorySlot, cell: BagCell) => {
    const key = stackKey(stack);
    const worn = stack.kind === 'jewelry' ? wornAt(owner, stack.id) : undefined;
    if (worn) onEquip(worn.slot, null, worn.ringIndex);
    const from = (['backpack', 'belt'] as const).flatMap((area) =>
      bag[area].flatMap((k, index) => (k === key ? [{ area, index }] : [])))[0];
    onLayout(from ? moveStack(bag, from, cell) : placeStack(bag, key, cell));
  };

  /** Moves a stack onto a target, following the slot and trash rules. */
  const drop = (stack: InventorySlot, target: BagTarget) => {
    setNotice('');
    if (target.kind === 'cell') toCell(stack, target.cell);
    else if (target.kind === 'equip') {
      const refusal = equipRefusal(owner, stack, target.target);
      if (refusal) return setNotice(refusal);
      onEquip(target.target.slot, stack.id, target.target.ringIndex);
    } else if (!stack.isTrashable) return setNotice('Starter deck cards can’t be trashed.');
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
    /** Packs the backpack in list order: items, then cards. */
    sort: () => onLayout(sortBackpack(bag, inBag.map(stackKey))),
    /** Returns every stack from the belt and spreads the backpack back to its default order. */
    clear: () => onLayout(arrangeBag(undefined, inBag.map(stackKey))),
  };
}
