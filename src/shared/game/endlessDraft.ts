import { ALL_CARD_IDS, getCard, isCardId, isCardInPlay, type CardId } from './cards.ts';
import { hashSeed, pickDistinct, pickWeighted } from './rng.ts';
import { keepsUniqueLimit } from './unique.ts';
import { isStarterName, type StarterName } from './starters.ts';
import type { CardType } from './types.ts';

// --- DRAFT CONFIGURATION ---
const LEGACY_DRAFT_SIZE = 11;
const CLASS_DRAFT_SIZE = 20;
export const ENDLESS_DRAFT_REFRESHES = 5;
export const DRAFT_POWER_STAGES = [10, 20] as const;
export type DraftPowerStage = typeof DRAFT_POWER_STAGES[number];
export const ENDLESS_DRAFT_PACK_SIZE = 3;
const OFFER_COUNT = 3;
const OPENERS: readonly DraftOffer[] = [
  { name: 'Warrior', cards: ['cruelSlash', 'cleave', 'boneWard'] },
  { name: 'Mage', cards: ['forkedBolt', 'frostBolt', 'mend'] },
  { name: 'Hexer', cards: ['mourningCurse', 'whisperHex', 'sneer'] },
  { name: 'Archer', cards: ['venomDart', 'barbedVolley', 'retreatingShot'] },
];

export const ENDLESS_CLASS_TYPES: Record<StarterName, readonly [CardType, CardType]> = {
  Warrior: ['melee', 'defend'],
  Mage: ['magic', 'utility'],
  Hexer: ['curse', 'buff'],
  Archer: ['range', 'movement'],
};
export type DraftOffer = { name?: StarterName; cards: readonly CardId[] };
export type EndlessDraft = { number: number; cards: CardId[]; starter?: StarterName;
  refreshesUsed?: number; roundRefresh?: number; powerPicks?: Partial<Record<DraftPowerStage, number>> };

/** Earlier unfinished 20-card drafts also get the two free starting picks. */
export function pendingDraftPower(draft: EndlessDraft): DraftPowerStage | undefined {
  if (!draft.starter) return undefined;
  return DRAFT_POWER_STAGES.find(stage => draft.cards.length >= stage && draft.powerPicks?.[stage] === undefined);
}

/** Check the limited draft counters and persisted starting choices. */
function validCounter(value: unknown, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

function validPowerPicks(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([stage, pick]) => (stage === '10' || stage === '20') && validCounter(pick, 2));
}

/** Keep partly drafted 11-card decks playable after adding the class picker. */
export function endlessDraftSize(draft: EndlessDraft): number {
  return draft.starter || draft.cards.length === 0 ? CLASS_DRAFT_SIZE : LEGACY_DRAFT_SIZE;
}

// --- OFFER POOLS ---
/** Draft only currently playable player/neutral cards; Imbues keep their shop/drop rules. */
function isDraftable(id: CardId): boolean {
  const card = getCard(id);
  return isCardInPlay(id) && card.pool !== 'unit' && card.type !== 'imbue';
}

/** Read saved picks as identities, not old positions in the offer list. */
export function isSavedEndlessDraft(value: unknown): value is EndlessDraft {
  return !!value && typeof value === 'object' && 'number' in value &&
    typeof value.number === 'number' && Number.isSafeInteger(value.number) && value.number > 0 &&
    'cards' in value && Array.isArray(value.cards) &&
    (!('starter' in value) || isStarterName(value.starter)) &&
    (!('refreshesUsed' in value) || validCounter(value.refreshesUsed, ENDLESS_DRAFT_REFRESHES)) &&
    (!('roundRefresh' in value) || validCounter(value.roundRefresh, ENDLESS_DRAFT_REFRESHES)) &&
    (!('powerPicks' in value) || validPowerPicks(value.powerPicks)) &&
    (value.cards.length === 0 || (value.cards.length >= ENDLESS_DRAFT_PACK_SIZE &&
      value.cards.length <= ('starter' in value ? CLASS_DRAFT_SIZE : LEGACY_DRAFT_SIZE))) &&
    value.cards.every(isCardId) && keepsUniqueLimit(value.cards);
}

/** Picks are seeded per day, attempt, and round, so a reload cannot reroll them. */
export function endlessDraftOffers(day: string, draft: EndlessDraft): DraftOffer[] {
  const count = draft.cards.length;
  const size = endlessDraftSize(draft);
  if (count >= size) return [];
  const seed = hashSeed(day + ':endless-draft:v1:' + draft.number + ':' + count);
  if (!count) return [...OPENERS];

  // The first class pick draws from a broad, cheap pool. Later defensive rounds protect against unusable decks.
  // Keep dedicated rounds for cheap reach and higher rarity.
  const eligible = ALL_CARD_IDS.filter(id => isDraftable(id) && !draft.cards.includes(id));
  const pool = eligible.filter(id => {
    const card = getCard(id);
    if (count === 3 && draft.starter) return card.cost <= 2 && (card.rarity === 'common' || card.rarity === 'uncommon');
    if (count === 3 || count === 7 || (draft.starter && count === 13)) return card.type === 'defend' && card.cost <= 2;
    if (count === 4) return card.cost <= 1 && card.reach &&
      card.effects.some(effect => effect.kind === 'damage' || effect.kind === 'hex');
    if (count === size - 1 || (draft.starter && count === 10)) return card.rarity === 'rare' || card.rarity === 'legendary';
    return card.rarity === 'common' || card.rarity === 'uncommon';
  });
  const available = pool.length >= OFFER_COUNT ? pool : eligible;
  let offers = weightedDraftCards(seed, available, draft.starter);
  for (let refresh = 1; refresh <= (draft.roundRefresh ?? 0); refresh++) {
    const fresh = available.filter(id => !offers.includes(id));
    if (!fresh.length) break;
    const changed = weightedDraftCards(hashSeed(seed + ':refresh:' + refresh), fresh, draft.starter);
    const unchanged = weightedDraftCards(hashSeed(seed + ':fill:' + refresh), offers, draft.starter);
    offers = [...changed, ...unchanged].slice(0, OFFER_COUNT);
  }
  return offers.map(id => ({ cards: [id] }));
}

/** Each offer is distinct; lower-priority card types remain possible. */
function weightedDraftCards(seed: number, available: CardId[], starter?: StarterName): CardId[] {
  if (!starter) return pickDistinct(seed, available, OFFER_COUNT)[0];
  const [main, secondary] = ENDLESS_CLASS_TYPES[starter];
  let weighted = available.map(id => {
    const type = getCard(id).type;
    return { item: id, weight: type === main ? 3 : type === secondary ? 1.5 : 1 };
  });
  let current = seed;
  return Array.from({ length: Math.min(weighted.length, OFFER_COUNT) }, () => {
    const [id, next] = pickWeighted(current, weighted);
    current = next;
    weighted = weighted.filter(entry => entry.item !== id);
    return id;
  });
}

/** A refresh never changes prior picks or spends a token on an identical offer. */
export function refreshEndlessDraft(day: string, draft: EndlessDraft): EndlessDraft {
  const used = draft.refreshesUsed ?? 0;
  if (used >= ENDLESS_DRAFT_REFRESHES || draft.cards.length === 0 ||
      draft.cards.length >= endlessDraftSize(draft) || pendingDraftPower(draft)) return draft;
  const next = { ...draft, refreshesUsed: used + 1, roundRefresh: (draft.roundRefresh ?? 0) + 1 };
  const before = endlessDraftOffers(day, draft).flatMap(offer => offer.cards);
  const after = endlessDraftOffers(day, next).flatMap(offer => offer.cards);
  return after.some(id => !before.includes(id)) ? next : draft;
}
