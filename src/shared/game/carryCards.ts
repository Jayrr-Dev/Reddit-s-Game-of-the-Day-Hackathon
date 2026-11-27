import { isUniqueInDeck } from './unique.ts';
import { ALL_CARD_IDS, getCard, isCardId, isCardInPlay, type CardId } from './cards.ts';

export const SHOP_IMBUE_ID = 'imbue-card';
export const IMBUE_PRICE = 85;
export const MAX_CARRY_CARDS = 4;
export const IMBUE_CARDS = ALL_CARD_IDS.filter(id => getCard(id).type === 'imbue' && isCardInPlay(id));
export type CarryCard = { id: string; cardId: CardId; source: 'shop' | 'ferryman' | 'pandora' | 'test'; spent?: string };
export type CarryCards = Partial<Record<string, CarryCard>>;

const TEST_CARDS = ['keenEdge', 'emberRune', 'wardingBolt', 'ruin'] as const satisfies readonly CardId[];
export function seededAdminCarryCards(): CarryCards {
  return Object.fromEntries(TEST_CARDS.map((cardId, index) => {
    const id = 'test:' + index;
    return [id, { id, cardId, source: 'test' }];
  }));
}

export function carrySourceLabel(source: CarryCard['source']): string {
  return source === 'shop' ? 'Shop' : source === 'test' ? 'Admin test' : source === 'pandora' ? 'Pandora' : 'From Hell';
}

export const isShopStockKey = (value: unknown): value is string => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3])\.\d{1,10}p?)?$/.test(value);

/** Derive hourly stock; the cycle increments only when another boss-clearing run finishes. */
export const shopStockKey = (time: Date, bossRuns: number): string =>
  time.toISOString().slice(0, 13) + '.' + bossRuns;

const isPandoraCarryId = (id: string, prefix: 'pandora' | 'test-pandora') => {
  const [kind, stock, box, ...extra] = id.split(':');
  return kind === prefix && !extra.length && isShopStockKey(stock) && /^mystery-box-[1-5]$/.test(box ?? '');
};

export const shopCardReceipt = (stock: string, practice = false): string => (practice ? 'test-shop:' : 'shop:') + stock;
const isTestShopReceipt = (id: string) => id.startsWith('test-shop:') && isShopStockKey(id.slice('test-shop:'.length));
export const isTestCarryCardId = (id: string): boolean => /^test:[0-3]$/.test(id) || isTestShopReceipt(id) || isPandoraCarryId(id, 'test-pandora');

export const isCarryCardId = (value: unknown): value is string => typeof value === 'string' &&
  ((value.startsWith('shop:') && isShopStockKey(value.slice(5))) || /^hell:[a-f0-9-]{36}$/.test(value) ||
    isTestCarryCardId(value) || isPandoraCarryId(value, 'pandora'));

/** Validate the selected inventory receipts, not client-supplied catalog IDs. */
export const isCarrySelection = (value: unknown): value is string[] => Array.isArray(value) &&
  value.length <= MAX_CARRY_CARDS && value.every(isCarryCardId) && new Set(value).size === value.length;

export const isCarriedDeck = (value: unknown): value is CardId[] => Array.isArray(value) &&
  value.length > 0 && value.length <= MAX_CARRY_CARDS && value.every(isCardId);

export function appendCarriedCards(starter: readonly CardId[], carried: readonly CardId[]) {
  const deck = [...starter];
  for (const id of carried) if (!isUniqueInDeck(deck, id)) deck.push(id);
  return deck;
}

/** Restore paid and recovered cards without trusting an arbitrary catalog key. */
export function readCarryCards(value: unknown): CarryCards {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid carry cards');
  const cards: CarryCards = {};
  for (const [id, row] of Object.entries(value)) {
    if (!isCarryCardId(id) || !row || typeof row !== 'object' || !isCardId(row.cardId) ||
      (row.source !== 'shop' && row.source !== 'ferryman' && row.source !== 'pandora' && row.source !== 'test') ||
      (row.source === 'shop' && !id.startsWith('shop:') && !isTestShopReceipt(id)) ||
      (row.source === 'ferryman' && !id.startsWith('hell:')) ||
      (row.source === 'pandora' && !isPandoraCarryId(id, 'pandora')) ||
      (row.source === 'test' && (!isTestCarryCardId(id) || (id.startsWith('test:') && row.cardId !== TEST_CARDS[Number(id.slice(5))]))) ||
      (row.spent !== undefined && (typeof row.spent !== 'string' || !/^[a-f0-9-]{36}$/.test(row.spent))))
      throw new Error('Invalid carry card receipt');
    cards[id] = { id, cardId: row.cardId, source: row.source, ...(row.spent && { spent: row.spent }) };
  }
  return cards;
}

/** Owned cards are reusable; old spend markers no longer hide the originals. */
export const availableCarryCards = (owned?: CarryCards): CarryCard[] =>
  Object.values(owned ?? {}).flatMap(card => card ? [{ id: card.id, cardId: card.cardId, source: card.source }] : []);
