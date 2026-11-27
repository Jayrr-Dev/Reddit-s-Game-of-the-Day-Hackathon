import { ALL_CARD_IDS, getCard, isCardId, isCardInPlay, type CardId } from './cards.ts';
import { hashSeed, pickDistinct, pickWeighted } from './rng.ts';
import { keepsUniqueLimit } from './unique.ts';
import { isStarterName, type StarterName } from './starters.ts';
import type { CardType } from './types.ts';

// --- DRAFT CONFIGURATION ---
const LEGACY_DRAFT_SIZE = 11;
const CLASS_DRAFT_SIZE = 20;
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
export type EndlessDraft = { number: number; cards: CardId[]; starter?: StarterName };

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

  // The two defensive picks protect against unusable decks. Start with cheap repeatable offense,
  // and save the big cards for the last pick so they don't crowd out essentials.
  const eligible = ALL_CARD_IDS.filter(id => isDraftable(id) && !draft.cards.includes(id));
  const pool = eligible.filter(id => {
    const card = getCard(id);
    if (count === 3 || count === 7 || (draft.starter && count === 13)) return card.type === 'defend' && card.cost <= 2;
    if (count === 4) return card.cost <= 1 && card.reach &&
      card.effects.some(effect => effect.kind === 'damage' || effect.kind === 'hex');
    if (count === size - 1 || (draft.starter && count === 10)) return card.rarity === 'rare' || card.rarity === 'legendary';
    return card.rarity === 'common' || card.rarity === 'uncommon';
  });
  const available = pool.length >= OFFER_COUNT ? pool : eligible;
  if (!draft.starter) return pickDistinct(seed, available, OFFER_COUNT)[0].map(id => ({ cards: [id] }));
  const [main, secondary] = ENDLESS_CLASS_TYPES[draft.starter];
  let weighted = available.map(id => {
    const type = getCard(id).type;
    return { item: id, weight: type === main ? 3 : type === secondary ? 1.5 : 1 };
  });
  let current = seed;
  return Array.from({ length: Math.min(weighted.length, OFFER_COUNT) }, () => {
    const [id, next] = pickWeighted(current, weighted);
    current = next;
    weighted = weighted.filter(entry => entry.item !== id);
    return { cards: [id] };
  });
}
