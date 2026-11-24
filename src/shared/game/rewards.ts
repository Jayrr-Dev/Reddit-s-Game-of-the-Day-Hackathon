// ===================================================================
// CARD REWARDS
// Rolls the cards offered after a fight or at the dark altar. Harder
// stops shift the odds toward rarer cards.
// ===================================================================

import { cardsOfRarity, type CardId } from './cards.ts';
import type { StopKind } from './kingdom.ts';
import { pickOne, pickWeighted, type RngResult, type RngState } from './rng.ts';
import { OFFER_SIZE } from './rules.ts';
import type { CardRarity } from './types.ts';

// --- ODDS ---
type RarityWeights = { item: Exclude<CardRarity, 'starter'>; weight: number }[];

/** Rarity odds per kind of stop (grave never offers cards). */
const RARITY_ODDS: Record<Exclude<StopKind, 'grave'>, RarityWeights> = {
  horde: [
    { item: 'common', weight: 65 },
    { item: 'uncommon', weight: 30 },
    { item: 'rare', weight: 5 },
  ],
  elite: [
    { item: 'common', weight: 20 },
    { item: 'uncommon', weight: 55 },
    { item: 'rare', weight: 23 },
    { item: 'legendary', weight: 2 },
  ],
  champion: [
    { item: 'uncommon', weight: 50 },
    { item: 'rare', weight: 45 },
    { item: 'legendary', weight: 5 },
  ],
  altar: [
    { item: 'uncommon', weight: 40 },
    { item: 'rare', weight: 52 },
    { item: 'legendary', weight: 8 },
  ],
};

// --- ROLLS ---

/** Rolls one card not already offered (falls back to any card of the rarity). */
const rollOneOffer = (
  state: RngState,
  source: Exclude<StopKind, 'grave'>,
  taken: readonly CardId[]
): RngResult<CardId> => {
  const [rarity, afterRarity] = pickWeighted(state, RARITY_ODDS[source]);
  const pool = cardsOfRarity(rarity);
  const fresh = pool.filter((id) => !taken.includes(id));
  return pickOne(afterRarity, fresh.length > 0 ? fresh : pool);
};

/** Rolls OFFER_SIZE distinct card offers for a stop. */
export const rollOffers = (
  seed: RngState,
  source: Exclude<StopKind, 'grave'>
): CardId[] => {
  const offers: CardId[] = [];
  let current = seed;
  for (let slot = 0; slot < OFFER_SIZE; slot += 1) {
    const [cardId, next] = rollOneOffer(current, source, offers);
    offers.push(cardId);
    current = next;
  }
  return offers;
};
