import { ALBUM_SLOTS, availableCarryCards, isCarrySelection, IMBUE_CARDS, IMBUE_PRICE, isShopStockKey, readCarryCards, shopCardReceipt, SHOP_IMBUE_ID, type CarryCards } from './carryCards.ts';
import { ALL_CARD_IDS, getCard, isCardInPlay, type CardId } from './cards.ts';
import { hashSeed, nextInt, pickDistinct, pickOne, pickWeighted, type RngState } from './rng.ts';
import { TRAINING_JEWELRY } from './trainingJewelry.ts';
import { shopAmuletSummary, type ShopAmuletId } from './amuletBonuses.ts';
import { drawPandoraEvent, readPandoraEvent, PANDORA_CURSE_BOUNTY, PANDORA_EVENT_CHANCE, PANDORA_EVENT_TICKETS, pandoraGoldReward, type PandoraEvent, type PandoraRunEffect } from './pandora.ts';
import type { EquipmentSlot } from './character.ts';
import { isItemBag, itemQuantity, REALM_APPLE, SHOP_APPLE, spendItem, type ItemBag, type ShopApple } from './items.ts';

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
const SHOP_IMBUE_CHANCE = 65;
const PANDORA_CARD_CHANCE = 20;
const PLAYABLE_CARDS = ALL_CARD_IDS.filter(isCardInPlay);
const NON_IMBUE_CARDS = PLAYABLE_CARDS.filter(id => getCard(id).type !== 'imbue');

/** Shop tiers group starter and Common cards under the same display label. */
export function shopCardRarity(id: CardId): RingRarity {
  const rarity = getCard(id).rarity;
  return rarity === 'legendary' ? 'Legendary' : rarity === 'rare' ? 'Rare' : rarity === 'uncommon' ? 'Uncommon' : 'Common';
}

export const PANDORA_CARD_TIERS = [
  { item: 'Common', weight: 35 }, { item: 'Uncommon', weight: 30 },
  { item: 'Rare', weight: 25 }, { item: 'Legendary', weight: 10 },
] as const;
const pandoraCardPools = Object.fromEntries(PANDORA_CARD_TIERS.map(({ item }) =>
  [item, PLAYABLE_CARDS.filter(id => shopCardRarity(id) === item)] as const));

/** Roll the rarity first so the number of cards in a tier doesn't affect its odds. */
export function drawPandoraCard(raritySeed: RngState, cardSeed: RngState): CardId {
  const [rarity] = pickWeighted(raritySeed, PANDORA_CARD_TIERS);
  return pickOne(cardSeed, pandoraCardPools[rarity]!)[0];
}

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
const PANDORA_JEWELRY = [{ item: 'ring', weight: 35 }, { item: 'amulet', weight: 15 }] as const;
const PANDORA_RING_POOLS = [
  { item: TEMP_RING_IDS.slice(0, 4), weight: 70 },
  { item: TEMP_RING_IDS.slice(4, 6), weight: 19 },
  { item: TEMP_RING_IDS.slice(6, 8), weight: 5 },
  { item: TEMP_RING_IDS.slice(8), weight: 1 },
];

/** Split jewelry by slot first, keeping the existing rarity mix within each slot. */
export function drawPandoraJewelry(slotSeed: RngState, tierSeed: RngState, rewardSeed: RngState): ShopRingId {
  const [slot] = pickWeighted(slotSeed, PANDORA_JEWELRY);
  const pool = slot === 'amulet' ? AMULET_IDS : pickWeighted(tierSeed, PANDORA_RING_POOLS)[0];
  return pickOne(rewardSeed, pool)[0];
}
export type RingOffer = { id: ShopRingId; name: string; flavor: string; slot: EquipmentSlot; effect?: string; rarity: RingRarity; price: number };
export type RingPurchases = Partial<Record<ShopRingId, number>>;

export const MYSTERY_BOX_IDS = ['mystery-box-1', 'mystery-box-2', 'mystery-box-3', 'mystery-box-4', 'mystery-box-5'] as const;
export type MysteryBoxId = (typeof MYSTERY_BOX_IDS)[number];
export type ShopOfferId = ShopRingId | MysteryBoxId | typeof SHOP_IMBUE_ID;
type MysteryOffer = { id: MysteryBoxId; name: string; flavor: string; slot: 'box'; rarity: RingRarity; price: number };
type CardOffer = { id: typeof SHOP_IMBUE_ID; name: string; flavor: string; slot: 'card'; cardId: CardId; rarity: RingRarity; price: number };
export type ShopOffer = RingOffer | MysteryOffer | CardOffer;
export type ShopWallet = { items: RingPurchases; boxes: Partial<Record<string, ShopRingId>>; events?: Partial<Record<string, PandoraEvent>>; carry?: CarryCards; testFruit?: { items: ItemBag; stock: string } };
export type ShopReward =
  | { kind: 'jewelry'; id: ShopRingId; name: string; slot: EquipmentSlot; rarity: RingRarity }
  | (PandoraEvent & { albumFull?: true });
const isBoxReceipt = (key: string) => {
  const [stock, box, ...extra] = key.split(':');
  return !extra.length && isShopStockKey(stock) && MYSTERY_BOX_IDS.some(id => id === box);
};
export const ADMIN_SHOP_GOLD = 1000;
export const MYSTERY_BOX_PRICE = 100;
const STARTER_TEST_FRUIT: Readonly<ItemBag> = { [SHOP_APPLE]: 3, [REALM_APPLE]: 2 };
export const testShopFruit = (wallet: ShopWallet): ItemBag => wallet.testFruit?.items ?? { ...STARTER_TEST_FRUIT };

export function testShopStockKey(day: string, wallet: ShopWallet): string {
  const hour = day.slice(0, 13);
  const custom = wallet.testFruit?.stock;
  // Admin testing uses its own stock seed, never the player's real restock count.
  return custom?.slice(0, 13) === hour ? custom : hour.length === 13 ? hour + '.0' : day;
}

export function offerTestShopFruit(wallet: ShopWallet, day: string, item: ShopApple): ShopWallet | undefined {
  const items = spendItem(testShopFruit(wallet), item);
  if (!items) return undefined;
  const revision = 1_000_000_000 + (5 - itemQuantity(items, SHOP_APPLE) - itemQuantity(items, REALM_APPLE));
  const stock = day.slice(0, 13) + '.' + revision + (item === REALM_APPLE ? 'p' : '');
  return { ...wallet, testFruit: { items, stock } };
}
export const PANDORA_BOX_NAME = "Pandora's Box";
const BOX_CHANCE = [8, 8, 8, 16, 24] as const;
const boxOffer = (id: MysteryBoxId): MysteryOffer => ({
  id, name: PANDORA_BOX_NAME, slot: 'box', rarity: 'Rare', price: MYSTERY_BOX_PRICE,
  flavor: "I never told it your name. It knew it all the same.",
});
export const isShopOfferId = (id: unknown): id is ShopOfferId =>
  id === SHOP_IMBUE_ID || isShopRingId(id) || MYSTERY_BOX_IDS.some(known => known === id);

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

/** Five offers, with at most one Pandora box. An amulet can only appear in slot five. */
export function shopOffers(day: string, admin = false): ShopOffer[] {
  const premium = day.endsWith('p');
  const seed = (label: string) => hashSeed('metatron:stock:' + day + ':' + label);
  const [regular] = pickDistinct(seed('regular'), everydayRings, RING_SLOTS);
  const remaining = everydayRings.filter(candidate => !regular.includes(candidate));
  const [fourthRoll] = nextInt(seed('fourth-rarity'), 100);
  const [fourth] = pickOne(seed('fourth-item'), premium ? rings.filter(item => item.rarity === 'Legendary') : fourthRoll < FOURTH_RARE_CHANCE ? rareRings : remaining);
  const [roll] = nextInt(seed('fifth-rarity'), 100);
  let fifth: StockItem;
  if (roll < AMULET_CHANCE) {
    const [tier] = nextInt(seed('amulet-tier'), 100);
    const id = AMULET_IDS[tier < 60 ? 0 : tier < 90 ? 1 : 2];
    fifth = { id, rarity: AMULET_RARITY[id] };
  } else {
    const low = remaining.filter(candidate => candidate.id !== fourth.id);
    const target = roll < (premium ? 33 : 18) ? 'Legendary' : roll < (premium ? 63 : 33) ? 'Epic' : roll < (premium ? 90 : 65) || !low.length ? 'Rare' : undefined;
    [fifth] = pickOne(seed('fifth-item'), target ? rings.filter(candidate => candidate.id !== fourth.id && candidate.rarity === target) : low);
  }
  const boxCandidates = admin ? [] : MYSTERY_BOX_IDS.filter((id, index) =>
    (!premium || index !== 3) && nextInt(seed(id), 100)[0] < BOX_CHANCE[index]!);
  const box = admin ? MYSTERY_BOX_IDS[4] :
    boxCandidates.length ? pickOne(seed('single-pandora-box'), boxCandidates)[0] : undefined;
  return [...regular, fourth, fifth].map(({ id, rarity }, index): ShopOffer => {
    if (box && MYSTERY_BOX_IDS[index] === box) return boxOffer(box);
    const cardRoll = nextInt(seed('card-offer'), 100)[0];
    if (index === 3 && !premium && cardRoll < 35) {
      const imbue = nextInt(seed('card-family'), 100)[0] < SHOP_IMBUE_CHANCE;
      const pool = imbue ? IMBUE_CARDS : NON_IMBUE_CARDS;
      const [cardId] = pickOne(seed('carry-card'), pool);
      return { id: SHOP_IMBUE_ID, name: getCard(cardId).name, slot: 'card', cardId, rarity: shopCardRarity(cardId), price: IMBUE_PRICE,
        flavor: imbue ? 'The mark survives the battle, but not the march.' : 'Someone paid to leave this here. They never came back for it.' };
    }
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
export function readShopWallet(raw?: string, practice = false): ShopWallet {
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
    const savedCarry = 'carry' in data ? readCarryCards(data.carry) : undefined;
    // Existing admin receipts used the real shop prefix but only live in the test wallet.
    const carry = practice && savedCarry ? Object.fromEntries(
      Object.values(savedCarry).flatMap(card => {
        if (!card) return [];
        const id = card.source === 'shop' && card.id.startsWith('shop:')
          ? shopCardReceipt(card.id.slice(5), true) : card.id;
        return [[id, { ...card, id }] as const];
      })
    ) : savedCarry;
    const fruit = 'testFruit' in data ? data.testFruit : undefined;
    let testFruit: ShopWallet['testFruit'];
    if (fruit !== undefined) {
      if (!fruit || typeof fruit !== 'object' || !('items' in fruit) || !isItemBag(fruit.items) ||
        !('stock' in fruit) || !isShopStockKey(fruit.stock)) throw new Error('Invalid test shop fruit');
      testFruit = { items: fruit.items, stock: fruit.stock };
    }
    return { items, boxes, ...(Object.keys(events).length && { events }), ...(carry && { carry }), ...(testFruit && { testFruit }) };
  }
  return { items: readPurchases(raw), boxes: {} };
}

/** Include box tickets, Gold outcomes and cleared curse bounties in the balance. */
export function shopGoldBalance(earned: number, wallet: ShopWallet): number {
  const purchases = Object.values(wallet.items).reduce((sum, price) => sum + price, 0);
  const events = Object.values(wallet.events ?? {}).reduce((sum, event) =>
    sum - MYSTERY_BOX_PRICE + (event?.kind === 'gold' ? event.change : event?.kind === 'run' && event.claimed ? PANDORA_CURSE_BOUNTY : 0), 0);
  const runeCost = Object.values(wallet.carry ?? {}).filter(card => card?.source === 'shop').length * IMBUE_PRICE;
  return Math.max(0, earned - purchases + events - runeCost);
}

/** Read all box receipts for this refresh, including older stock that had multiple boxes. */
export const openedShopBoxes = (day: string, wallet: ShopWallet): MysteryBoxId[] =>
  MYSTERY_BOX_IDS.filter(box => wallet.boxes[day + ':' + box] || wallet.events?.[day + ':' + box]);

/** Existing unclaimed half-life outcomes adopt the new payout; issued runs keep their baseline. */
export function pendingPandoraEffect(wallet: ShopWallet): PandoraRunEffect | undefined {
  const next = Object.values(wallet.events ?? {}).find(event => event?.kind === 'run' && !event.runId);
  if (next?.kind !== 'run') return undefined;
  return next.effect === 'half-life' ? 'half-life-double-gold' : next.effect;
}

/** Attach the oldest unused effect to an issued run. */
export function assignPandoraEffect(wallet: ShopWallet, runId: string) {
  for (const [receipt, event] of Object.entries(wallet.events ?? {})) {
    if (event?.kind !== 'run' || event.runId) continue;
    const effect: PandoraRunEffect = event.effect === 'half-life' ? 'half-life-double-gold' : event.effect;
    return { effect, wallet: { ...wallet, events: { ...wallet.events, [receipt]: { ...event, effect, runId } } } };
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

/** At most one Pandora box can be purchased per stock refresh. */
export function quoteShopPurchase(earned: number, wallet: ShopWallet, offer: ShopOffer, day: string, entropy: string, practice = false, level = 1) {
  const balance = shopGoldBalance(earned, wallet);
  if (offer.slot === 'card') {
    const id = shopCardReceipt(day, practice);
    if (wallet.carry?.[id]) return { status: 'owned' } as const;
    if (!practice && availableCarryCards(wallet.carry).length >= ALBUM_SLOTS) return { status: 'full' } as const;
    if (balance < offer.price) return { status: 'short' } as const;
    return { status: 'buy', next: { ...wallet, carry: { ...wallet.carry, [id]: { id, cardId: offer.cardId, source: 'shop' } } } } as const;
  }
  if (offer.slot !== 'box') {
    if (wallet.items[offer.id] !== undefined) return { status: 'owned' } as const;
    if (balance < offer.price) return { status: 'short' } as const;
    return { status: 'buy', next: { ...wallet, items: { ...wallet.items, [offer.id]: offer.price } } } as const;
  }
  const receipt = day + ':' + offer.id;
  if (openedShopBoxes(day, wallet).length) return { status: 'owned' } as const;
  if (balance < offer.price) return { status: 'short' } as const;


  const seed = (label: string) => hashSeed('metatron:box:' + entropy + ':' + receipt + ':' + label);
  const kindRoll = nextInt(seed('kind'), 100)[0];
  if (kindRoll < PANDORA_CARD_CHANCE) {
    const cardId = drawPandoraCard(seed('card-rarity'), seed('card'));
    const owned = availableCarryCards(wallet.carry);
    const albumFull = !practice && owned.length >= ALBUM_SLOTS;
    if (albumFull || owned.some(card => card.cardId === cardId)) {
      const rarity = shopCardRarity(cardId);
      const reward = pandoraGoldReward(level, rarity);
      return { status: 'buy', reward: { ...reward, ...(albumFull && { albumFull: true as const }) },
        next: { ...wallet, events: { ...wallet.events, [receipt]: reward } } } as const;
    }
    const id = (practice ? 'test-pandora:' : 'pandora:') + receipt;
    const card = { id, cardId, source: practice ? 'test' : 'pandora' } satisfies NonNullable<CarryCards[string]>;
    const reward = { kind: 'card', cardId } as const;
    return { status: 'buy', reward, next: { ...wallet, events: { ...wallet.events, [receipt]: reward }, carry: { ...wallet.carry, [id]: card } } } as const;
  }
  if (kindRoll < PANDORA_CARD_CHANCE + PANDORA_EVENT_CHANCE) {
    const event = drawPandoraEvent(nextInt(seed('event'), PANDORA_EVENT_TICKETS)[0], balance - offer.price, level);
    return { status: 'buy', reward: event, next: { ...wallet, events: { ...wallet.events, [receipt]: event } } } as const;
  }
  const id = drawPandoraJewelry(seed('jewelry-slot'), seed('tier'), seed('reward'));
  const rarity = shopRarity(id);
  if (wallet.items[id] !== undefined) {
    const reward = pandoraGoldReward(level, rarity);
    return { status: 'buy', reward, next: { ...wallet, events: { ...wallet.events, [receipt]: reward } } } as const;
  }
  const item = catalog.get(id)!;
  return {
    status: 'buy',
    reward: { kind: 'jewelry', id, name: item.name, slot: item.slot, rarity },
    next: { ...wallet, items: { ...wallet.items, [id]: offer.price }, boxes: { ...wallet.boxes, [receipt]: id } },
  } as const;
}

/** Look up the actual item tier, not the box's presentation tier. */
function shopRarity(id: ShopRingId): RingRarity {
  return rings.find(ring => ring.id === id)?.rarity ?? AMULET_IDS.map(key => ({ key, rarity: AMULET_RARITY[key] })).find(entry => entry.key === id)!.rarity;
}

/** Resolve an entire ordered selection of owned receipts without consuming them. */
export function selectCarryCards(wallet: ShopWallet, receipts: readonly string[], practice = false) {
  if (!isCarrySelection(receipts)) return undefined;
  const owned = availableCarryCards(wallet.carry);
  const active = new Map((practice ? owned : owned.slice(0, ALBUM_SLOTS)).map(card => [card.id, card.cardId]));
  const cards: CardId[] = [];
  for (const receipt of receipts) {
    const card = active.get(receipt);
    if (!card) return undefined;
    cards.push(card);
  }
  return cards;
}

/** Put a surrendered card into Inventory after a verified death, once per run. */
export function recoverCardFromHell(wallet: ShopWallet, runId: string, cardId: CardId): ShopWallet | undefined {
  const id = 'hell:' + runId;
  if (wallet.carry?.[id]) return undefined;
  return { ...wallet, carry: { ...wallet.carry, [id]: { id, cardId, source: 'ferryman' } } };
}

/** When every item is owned the box can still give a non-jewelry outcome. */
export const allShopJewelryOwned = (items: RingPurchases): boolean => SHOP_IDS.every(id => items[id] !== undefined);
