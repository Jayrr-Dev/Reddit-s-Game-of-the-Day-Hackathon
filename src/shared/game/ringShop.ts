import { hashSeed, nextInt, pickDistinct, pickOne } from './rng.ts';
import { TRAINING_JEWELRY } from './trainingJewelry.ts';
import { shopAmuletSummary, type ShopAmuletId } from './amuletBonuses.ts';
import { drawPandoraEvent, readPandoraEvent, PANDORA_CURSE_BOUNTY, type PandoraEvent, type PandoraRunEffect } from './pandora.ts';
import type { EquipmentSlot } from './character.ts';

// --- STOCK AND PRICES ---
export const RING_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;
export type RingRarity = (typeof RING_RARITIES)[number];
const PRICE_RANGE: Readonly<Record<RingRarity, readonly [number, number]>> = {
  Common: [24, 36],
  Uncommon: [48, 68],
  Rare: [85, 110],
  Epic: [145, 190],
  Legendary: [230, 290],
};
const RING_SLOTS = 3;
const FOURTH_RARE_CHANCE = 40;
const AMULET_CHANCE = 12;

export const TEMP_RING_IDS = [
  'cinder-band', 'tideglass-ring', 'rook-signet', 'briar-knot', 'quarry-ring',
  'moonstone-loop', 'bellfounder-band', 'ashwood-ring', 'gatewarden-seal', 'gilt-serpent',
] as const;
const AMULET_RARITY = {
  'ferryman-token': 'Rare', 'vesper-locket': 'Epic', 'last-lantern': 'Legendary',
} as const satisfies Record<ShopAmuletId, RingRarity>;
const AMULET_IDS = ['ferryman-token', 'vesper-locket', 'last-lantern'] as const satisfies readonly ShopAmuletId[];
// The wallet and replay fields keep their original names for existing saves and clients.
export type ShopRingId = (typeof TEMP_RING_IDS)[number] | ShopAmuletId;
export type RingOffer = { id: ShopRingId; name: string; flavor: string; slot: EquipmentSlot; effect?: string; rarity: RingRarity; price: number };
export type RingPurchases = Partial<Record<ShopRingId, number>>;

export const MYSTERY_BOX_IDS = ['mystery-box-4', 'mystery-box-5'] as const;
export type MysteryBoxId = (typeof MYSTERY_BOX_IDS)[number];
export type ShopOfferId = ShopRingId | MysteryBoxId;
type MysteryOffer = { id: MysteryBoxId; name: string; flavor: string; slot: 'box'; rarity: RingRarity; price: number };
export type ShopOffer = RingOffer | MysteryOffer;
export type ShopWallet = { items: RingPurchases; boxes: Partial<Record<string, ShopRingId>>; events?: Partial<Record<string, PandoraEvent>> };
export type ShopReward =
  | { kind: 'jewelry'; id: ShopRingId; name: string; slot: EquipmentSlot; rarity: RingRarity }
  | PandoraEvent;
const isBoxReceipt = (key: string) => /^\d{4}-\d{2}-\d{2}:mystery-box-[45]$/.test(key);
export const ADMIN_SHOP_GOLD = 1000;
export const MYSTERY_BOX_PRICE = 100;
export const PANDORA_BOX_NAME = "Pandora's Box";
const BOX_CHANCE = 10;
const boxOffer = (id: MysteryBoxId): MysteryOffer => ({
  id, name: PANDORA_BOX_NAME, slot: 'box', rarity: 'Rare', price: MYSTERY_BOX_PRICE,
  flavor: "I never told it your name. It knew it all the same.",
});
export const isShopOfferId = (id: unknown): id is ShopOfferId =>
  isShopRingId(id) || MYSTERY_BOX_IDS.some(known => known === id);

const SHOP_IDS: readonly ShopRingId[] = [...TEMP_RING_IDS, ...AMULET_IDS];
const catalog = new Map(TRAINING_JEWELRY.map(item => [item.id, item]));
const rings = TEMP_RING_IDS.map((id, index) => ({ id, rarity: RING_RARITIES[Math.floor(index / 2)]! }));
const everydayRings = rings.filter(({ rarity }) => rarity === 'Common' || rarity === 'Uncommon');
const rareRings = rings.filter(({ rarity }) => rarity === 'Rare');
type StockItem = { id: ShopRingId; rarity: RingRarity };

/** Validate an item ID for the existing shop wire format. */
export const isShopRingId = (id: unknown): id is ShopRingId => SHOP_IDS.some(known => known === id);
/** Return canonical, unique IDs for persisted purchases and replay. */
export const shopRingIds = (value: unknown): ShopRingId[] =>
  Array.isArray(value) ? SHOP_IDS.filter(id => value.includes(id)) : [];

/** Three everyday rings, then two chances at rare stock. An amulet can only replace slot five. */
export function shopOffers(day: string, admin = false): ShopOffer[] {
  const seed = (label: string) => hashSeed('metatron:stock:' + day + ':' + label);
  const [regular] = pickDistinct(seed('regular'), everydayRings, RING_SLOTS);
  const remaining = everydayRings.filter(candidate => !regular.includes(candidate));
  const [fourthRoll] = nextInt(seed('fourth-rarity'), 100);
  const [fourth] = pickOne(seed('fourth-item'), fourthRoll < FOURTH_RARE_CHANCE ? rareRings : remaining);
  const [roll] = nextInt(seed('fifth-rarity'), 100);
  let fifth: StockItem;
  if (roll < AMULET_CHANCE) {
    const [tier] = nextInt(seed('amulet-tier'), 100);
    const id = AMULET_IDS[tier < 60 ? 0 : tier < 90 ? 1 : 2];
    fifth = { id, rarity: AMULET_RARITY[id] };
  } else {
    const low = remaining.filter(candidate => candidate.id !== fourth.id);
    const target = roll < 18 ? 'Legendary' : roll < 33 ? 'Epic' : roll < 65 || !low.length ? 'Rare' : undefined;
    [fifth] = pickOne(seed('fifth-item'), target ? rings.filter(candidate => candidate.id !== fourth.id && candidate.rarity === target) : low);
  }
  return [...regular, fourth, fifth].map(({ id, rarity }, index): ShopOffer => {
    const box = index === 3 ? MYSTERY_BOX_IDS[0] : index === 4 ? MYSTERY_BOX_IDS[1] : undefined;
    if (box && ((admin && index === 4) || nextInt(seed(box), 100)[0] < BOX_CHANCE)) return boxOffer(box);
    const { name, flavor, slot } = catalog.get(id)!;
    const effect = shopAmuletSummary(id);
    const [min, max] = PRICE_RANGE[rarity];
    const [priceRoll] = nextInt(hashSeed('metatron:ring:' + day + ':' + id), max - min + 1);
    const basePrice = min + priceRoll;
    return { id, name, flavor, slot, rarity, price: slot === 'amulet' ? Math.ceil(basePrice * 1.25) : basePrice, ...(effect && { effect }) };
  });
}

/** Restore purchases into their actual equipment slots. */
export const ringInventory = (ids: readonly ShopRingId[]) =>
  SHOP_IDS.filter(id => ids.includes(id)).map(id => {
    const { name, slot } = catalog.get(id)!;
    return { id, name, slot };
  });

/** Restore old ring receipts and new amulet receipts without changing the wallet format. */
export function readPurchases(raw?: string): RingPurchases {
  if (!raw) return {};
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid jewelry purchase history');
  const entries = Object.entries(data);
  if (entries.some(([id, cost]) => !isShopRingId(id) || !Number.isSafeInteger(cost) || cost <= 0))
    throw new Error('Invalid jewelry purchase history');
  return data as RingPurchases;
}

export const goldAfterPurchases = (earned: number, purchases: RingPurchases): number =>
  Math.max(0, earned - Object.values(purchases).reduce((sum, price) => sum + price, 0));

export function quotePurchase(earned: number, purchases: RingPurchases, offer: RingOffer) {
  if (purchases[offer.id] !== undefined) return { status: 'owned' } as const;
  if (goldAfterPurchases(earned, purchases) < offer.price) return { status: 'short' } as const;
  return { status: 'buy', next: { ...purchases, [offer.id]: offer.price } } as const;
}

/** Keep old flat ring receipts readable. Box receipts live in the same atomic record. */
export function readShopWallet(raw?: string): ShopWallet {
  if (!raw) return { items: {}, boxes: {} };
  const data: unknown = JSON.parse(raw);
  if (data && typeof data === 'object' && 'items' in data && 'boxes' in data) {
    const items = readPurchases(JSON.stringify(data.items));
    const boxes: ShopWallet['boxes'] = {};
    if (!data.boxes || typeof data.boxes !== 'object' || Array.isArray(data.boxes))
      throw new Error('Invalid mystery box history');
    for (const [receipt, id] of Object.entries(data.boxes)) {
      if (!isBoxReceipt(receipt) || !isShopRingId(id) ||
        items[id] !== MYSTERY_BOX_PRICE || Object.values(boxes).includes(id))
        throw new Error('Invalid mystery box receipt');
      boxes[receipt] = id;
    }
    const events: NonNullable<ShopWallet['events']> = {};
    if ('events' in data) {
      if (!data.events || typeof data.events !== 'object' || Array.isArray(data.events))
        throw new Error('Invalid Pandora receipts');
      for (const [receipt, event] of Object.entries(data.events)) {
        if (!isBoxReceipt(receipt) || boxes[receipt]) throw new Error('Invalid Pandora receipt');
        events[receipt] = readPandoraEvent(event);
      }
    }
    return { items, boxes, ...(Object.keys(events).length && { events }) };
  }
  return { items: readPurchases(raw), boxes: {} };
}

/** Include box tickets, Gold outcomes and cleared curse bounties in the balance. */
export function shopGoldBalance(earned: number, wallet: ShopWallet): number {
  const purchases = Object.values(wallet.items).reduce((sum, price) => sum + price, 0);
  const events = Object.values(wallet.events ?? {}).reduce((sum, event) =>
    sum - MYSTERY_BOX_PRICE + (event?.kind === 'gold' ? event.change : event?.claimed ? PANDORA_CURSE_BOUNTY : 0), 0);
  return Math.max(0, earned - purchases + events);
}

/** One opening per slot and day, whether the result is jewelry or another outcome. */
export const openedShopBoxes = (day: string, wallet: ShopWallet): MysteryBoxId[] =>
  MYSTERY_BOX_IDS.filter(box => wallet.boxes[day + ':' + box] || wallet.events?.[day + ':' + box]);

/** Attach the oldest unused effect to an issued run. */
export function assignPandoraEffect(wallet: ShopWallet, runId: string) {
  for (const [receipt, event] of Object.entries(wallet.events ?? {})) {
    if (event?.kind !== 'run' || event.runId) continue;
    const effect: PandoraRunEffect = event.effect;
    return { effect, wallet: { ...wallet, events: { ...wallet.events, [receipt]: { ...event, runId } } } };
  }
  return undefined;
}

/** Credit a curse bounty only once, after verified progress for the assigned run. */
export function claimPandoraBounty(wallet: ShopWallet, runId: string): ShopWallet | undefined {
  for (const [receipt, event] of Object.entries(wallet.events ?? {})) {
    if (event?.kind !== 'run' || event.effect !== 'half-life' || event.runId !== runId || event.claimed) continue;
    return { ...wallet, events: { ...wallet.events, [receipt]: { ...event, claimed: true } } };
  }
  return undefined;
}

/** A daily box can only be opened once. */
export function quoteShopPurchase(earned: number, wallet: ShopWallet, offer: ShopOffer, day: string, entropy: string) {
  const balance = shopGoldBalance(earned, wallet);
  if (offer.slot !== 'box') {
    if (wallet.items[offer.id] !== undefined) return { status: 'owned' } as const;
    if (balance < offer.price) return { status: 'short' } as const;
    return { status: 'buy', next: { ...wallet, items: { ...wallet.items, [offer.id]: offer.price } } } as const;
  }
  const receipt = day + ':' + offer.id;
  if (wallet.boxes[receipt] || wallet.events?.[receipt]) return { status: 'owned' } as const;
  if (balance < offer.price) return { status: 'short' } as const;

  const unowned = SHOP_IDS.filter(id => wallet.items[id] === undefined);
  const seed = (label: string) => hashSeed('metatron:box:' + entropy + ':' + receipt + ':' + label);
  if (allShopJewelryOwned(wallet.items) || nextInt(seed('kind'), 100)[0] < 50) {
    const event = drawPandoraEvent(nextInt(seed('event'), 100)[0], balance - offer.price);
    return { status: 'buy', reward: event, next: { ...wallet, events: { ...wallet.events, [receipt]: event } } } as const;
  }
  const [tier] = nextInt(seed('tier'), 100);
  const desired = tier < 5 ? AMULET_IDS : tier < 6 ? TEMP_RING_IDS.slice(8) :
    tier < 11 ? TEMP_RING_IDS.slice(6, 8) : tier < 30 ? TEMP_RING_IDS.slice(4, 6) : TEMP_RING_IDS.slice(0, 4);
  const rolled = desired.filter(id => unowned.includes(id));
  const plain = unowned.filter(id => everydayRings.some(ring => ring.id === id));
  const [id] = pickOne(seed('reward'), rolled.length ? rolled : plain.length ? plain : unowned);
  const item = catalog.get(id)!;
  return {
    status: 'buy',
    reward: { kind: 'jewelry', id, name: item.name, slot: item.slot, rarity: shopRarity(id) },
    next: { ...wallet, items: { ...wallet.items, [id]: offer.price }, boxes: { ...wallet.boxes, [receipt]: id } },
  } as const;
}

/** Look up the actual item tier, not the box's presentation tier. */
function shopRarity(id: ShopRingId): RingRarity {
  return rings.find(ring => ring.id === id)?.rarity ?? AMULET_IDS.map(key => ({ key, rarity: AMULET_RARITY[key] })).find(entry => entry.key === id)!.rarity;
}

/** When every item is owned the box can still give a non-jewelry outcome. */
export const allShopJewelryOwned = (items: RingPurchases): boolean => SHOP_IDS.every(id => items[id] !== undefined);
