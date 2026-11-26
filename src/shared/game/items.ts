// ===================================================================
// ITEMS
// THE ITEM LIST: every consumable a player can carry. Add an entry to
// ITEMS and it shows in the Inventory tab, is saved with the player's
// profile, and new players start with its startingQuantity.
// ===================================================================

// --- CATALOG ---
export const ITEMS = [
  {
    id: 'tome-of-regret',
    name: 'Tome of Regret',
    pluralName: 'Tomes of Regret',
    /** A Glyph name; the client type-checks it against the icon set. */
    icon: 'book',
    description: 'Each page undoes a choice. Reading one returns every trait point so you can spend them again.',
    startingQuantity: 5,
  },
] as const;

// --- TYPES ---
export type ItemDef = (typeof ITEMS)[number];
export type ItemId = ItemDef['id'];
/** How many of each item one player owns. A missing id means none. */
export type ItemBag = Partial<Record<ItemId, number>>;

// --- ROLES ---
/** The item spent to respec traits. */
export const RESPEC_ITEM: ItemId = 'tome-of-regret';

// --- LOOKUPS ---
/** True for an id from the item list. */
export const isItemId = (id: unknown): id is ItemId => ITEMS.some((item) => item.id === id);
/** The catalog entry for one item. */
export const getItem = (id: ItemId): ItemDef => ITEMS.find((item) => item.id === id) ?? ITEMS[0];
/** How many of one item a bag holds. */
export const itemQuantity = (bag: ItemBag, id: ItemId) => bag[id] ?? 0;

// --- BAGS ---
/** A new player's bag: every item at its starting quantity. */
export const startingBag = (): ItemBag =>
  Object.fromEntries(ITEMS.map((item) => [item.id, item.startingQuantity]));

/** Validates a saved bag: known item ids with whole, non-negative counts. */
export function isItemBag(data: unknown): data is ItemBag {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  return Object.entries(data).every(
    ([id, count]) => isItemId(id) && Number.isInteger(count) && count >= 0
  );
}

/** Spends one item; returns null when the bag has none to spend. */
export const spendItem = (bag: ItemBag, id: ItemId): ItemBag | null => {
  const count = itemQuantity(bag, id);
  return count > 0 ? { ...bag, [id]: count - 1 } : null;
};
