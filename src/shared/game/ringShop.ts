import { hashSeed, nextInt } from './rng.ts';
import { TRAINING_JEWELRY } from './trainingJewelry.ts';

export const RING_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;
export type RingRarity = (typeof RING_RARITIES)[number];
const PRICE_RANGE: Readonly<Record<RingRarity, readonly [number, number]>> = {
  Common: [24, 36],
  Uncommon: [48, 68],
  Rare: [85, 110],
  Epic: [145, 190],
  Legendary: [230, 290],
};

export const TEMP_RING_IDS = [
  'cinder-band', 'tideglass-ring', 'rook-signet', 'briar-knot', 'quarry-ring',
  'moonstone-loop', 'bellfounder-band', 'ashwood-ring', 'gatewarden-seal', 'gilt-serpent',
] as const;
export type ShopRingId = (typeof TEMP_RING_IDS)[number];
export type RingOffer = { id: ShopRingId; name: string; flavor: string; rarity: RingRarity; price: number };
export type RingPurchases = Partial<Record<ShopRingId, number>>;
export const isShopRingId = (id: unknown): id is ShopRingId =>
  TEMP_RING_IDS.some(known => known === id);
export const shopRingIds = (value: unknown): ShopRingId[] =>
  Array.isArray(value) ? TEMP_RING_IDS.filter(id => value.includes(id)) : [];

const catalog = new Map(TRAINING_JEWELRY.filter(item => item.slot === 'ring').map(item => [item.id, item]));

export const shopOffers = (day: string): RingOffer[] => TEMP_RING_IDS.map((id, index) => {
  const item = catalog.get(id)!;
  const rarity = RING_RARITIES[Math.floor(index / 2)]!;
  const [min, max] = PRICE_RANGE[rarity];
  const [roll] = nextInt(hashSeed('metatron:ring:' + day + ':' + id), max - min + 1);
  return { id, name: item.name, flavor: item.flavor, rarity, price: min + roll };
});

export const ringInventory = (ids: readonly ShopRingId[]) =>
  TEMP_RING_IDS.filter(id => ids.includes(id)).map(id => {
    const { name } = catalog.get(id)!;
    return { id, name, slot: 'ring' as const };
  });

export function readPurchases(raw?: string): RingPurchases {
  if (!raw) return {};
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid ring purchase history');
  const entries = Object.entries(data);
  if (entries.some(([id, cost]) => !isShopRingId(id) || !Number.isSafeInteger(cost) || cost <= 0))
    throw new Error('Invalid ring purchase history');
  return data as RingPurchases;
}

export const goldAfterPurchases = (earned: number, purchases: RingPurchases): number =>
  Math.max(0, earned - Object.values(purchases).reduce((sum, price) => sum + price, 0));

export function quotePurchase(earned: number, purchases: RingPurchases, offer: RingOffer) {
  if (purchases[offer.id] !== undefined) return { status: 'owned' } as const;
  if (goldAfterPurchases(earned, purchases) < offer.price) return { status: 'short' } as const;
  return { status: 'buy', next: { ...purchases, [offer.id]: offer.price } } as const;
}
