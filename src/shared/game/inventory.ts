// ===================================================================
// PLAYER INVENTORY
// Turns the player's saved profile into RPG bag sections. The screen only
// draws what this module returns, so new things to carry are added here.
// ===================================================================
import { getCard, type CardId } from './cards.ts';
import type { CharacterState, EquipmentSlot } from './character.ts';
import { stackDeck } from './deckBuilder.ts';
import { ITEMS, itemQuantity, type ItemBag, type ItemDef, type ItemId } from './items.ts';

// --- TYPES ---
/** What the inventory reads from the player's saved profile. */
export type InventoryOwner = {
  character: CharacterState;
  /** The deck the player carries into their next run. */
  deck: readonly CardId[];
  /** Consumables owned, saved on the server with the profile. */
  bag: ItemBag;
};
/** Fields every stack shares. */
type StackBase = {
  name: string;
  quantity: number;
  /** False for things the trash refuses, like starter deck cards. */
  isTrashable: boolean;
};
/** One owned stack. `kind` picks how the screen draws its icon and details. */
export type InventorySlot = StackBase & (
  | { kind: 'item'; id: ItemId; icon: ItemDef['icon']; description: string }
  | { kind: 'jewelry'; id: string; slot: EquipmentSlot; equipped: boolean }
  | { kind: 'card'; id: CardId }
);
export type InventorySection = { id: string; label: string; slots: InventorySlot[] };
/** One row of the inventory list: a section and how it reads the profile. */
type InventorySource = {
  id: string;
  label: string;
  slotsOf: (owner: InventoryOwner) => InventorySlot[];
};

// --- SOURCES ---
/** Lists consumables from the item list that the player has at least one of. */
const bagSlots = ({ bag }: InventoryOwner): InventorySlot[] =>
  ITEMS.filter((item) => itemQuantity(bag, item.id) > 0).map((item) => ({
    kind: 'item',
    id: item.id,
    name: item.name,
    quantity: itemQuantity(bag, item.id),
    icon: item.icon,
    description: item.description,
    isTrashable: true,
  }));

/** Lists rings and amulets the character owns, worn or not. */
const jewelrySlots = ({ character }: InventoryOwner): InventorySlot[] => {
  const { rings, amulet } = character.equipment;
  const worn = new Set([...rings, amulet].filter((id) => id !== null));
  return character.inventory.map((item) => ({
    kind: 'jewelry',
    id: item.id,
    name: item.name,
    quantity: 1,
    slot: item.slot,
    equipped: worn.has(item.id),
    isTrashable: true,
  }));
};

/** Stacks the carried deck into one slot per card. Starter deck cards can't be trashed. */
const cardSlots = ({ deck }: InventoryOwner): InventorySlot[] =>
  stackDeck(deck).map(({ id, count }) => ({
    kind: 'card',
    id,
    name: getCard(id).name,
    quantity: count,
    isTrashable: false,
  }));

/**
 * THE INVENTORY LIST. Add a row here to give the bag a new section;
 * the Inventory tab draws every row without code changes.
 */
export const INVENTORY_SOURCES: readonly InventorySource[] = [
  { id: 'items', label: 'Items', slotsOf: (owner) => [...bagSlots(owner), ...jewelrySlots(owner)] },
  { id: 'cards', label: 'Cards', slotsOf: cardSlots },
];

// --- BUILD ---
/** Reads every inventory source for one player. */
export const inventoryOf = (owner: InventoryOwner): InventorySection[] =>
  INVENTORY_SOURCES.map(({ id, label, slotsOf }) => ({ id, label, slots: slotsOf(owner) }));

/** Every owned stack in list order (items, then cards). */
export const inventoryStacks = (owner: InventoryOwner): InventorySlot[] =>
  inventoryOf(owner).flatMap((section) => section.slots);

/** A stack's key is unique across kinds, since a card and an item may share an id. */
export const stackKey = (slot: Pick<InventorySlot, 'kind' | 'id'>) => `${slot.kind}:${slot.id}`;

/** Counts every copy across all filled slots, for the section header. */
export const itemCount = (slots: readonly InventorySlot[]) =>
  slots.reduce((sum, slot) => sum + slot.quantity, 0);
