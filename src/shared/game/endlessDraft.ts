import { ALL_CARD_IDS, getCard, isCardId, isCardInPlay, type CardId } from './cards.ts';
import { hashSeed, pickDistinct } from './rng.ts';
import { keepsUniqueLimit } from './unique.ts';

// --- DRAFT CONFIGURATION ---
export const ENDLESS_DRAFT_SIZE = 11;
export const ENDLESS_DRAFT_PACK_SIZE = 3;
const OFFER_COUNT = 3;
const OPENERS: readonly DraftOffer[] = [
  { name: 'Warrior', cards: ['cruelSlash', 'cleave', 'boneWard'] },
  { name: 'Mage', cards: ['forkedBolt', 'frostBolt', 'mend'] },
  { name: 'Hexer', cards: ['mourningCurse', 'whisperHex', 'sneer'] },
  { name: 'Archer', cards: ['venomDart', 'barbedVolley', 'retreatingShot'] },
];

export type DraftOffer = { name?: string; cards: readonly CardId[] };
export type EndlessDraft = { number: number; cards: CardId[] };

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
    (value.cards.length === 0 || (value.cards.length >= ENDLESS_DRAFT_PACK_SIZE && value.cards.length <= ENDLESS_DRAFT_SIZE)) &&
    value.cards.every(isCardId) && keepsUniqueLimit(value.cards);
}

/** Picks are seeded per day, attempt, and round, so a reload cannot reroll them. */
export function endlessDraftOffers(day: string, draft: EndlessDraft): DraftOffer[] {
  const count = draft.cards.length;
  if (count >= ENDLESS_DRAFT_SIZE) return [];
  const seed = hashSeed(day + ':endless-draft:v1:' + draft.number + ':' + count);
  if (!count) return pickDistinct(seed, OPENERS, OFFER_COUNT)[0];

  // The two defensive picks protect against unusable decks. Start with cheap repeatable offense,
  // and save the big cards for the last pick so they don't crowd out essentials.
  const eligible = ALL_CARD_IDS.filter(id => isDraftable(id) && !draft.cards.includes(id));
  const pool = eligible.filter(id => {
    const card = getCard(id);
    if (count === 3 || count === 7) return card.type === 'defend' && card.cost <= 2;
    if (count === 4) return card.cost <= 1 && card.reach &&
      card.effects.some(effect => effect.kind === 'damage' || effect.kind === 'hex');
    if (count === ENDLESS_DRAFT_SIZE - 1) return card.rarity === 'rare' || card.rarity === 'legendary';
    return card.rarity === 'common' || card.rarity === 'uncommon';
  });
  return pickDistinct(seed, pool.length >= OFFER_COUNT ? pool : eligible, OFFER_COUNT)[0]
    .map(id => ({ cards: [id] }));
}
