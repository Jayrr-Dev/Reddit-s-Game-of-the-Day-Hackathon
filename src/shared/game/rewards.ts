// ===================================================================
// CARD REWARDS
// Rolls the cards offered after a fight or at the dark altar. Harder
// stops shift the odds toward rarer cards.
// ===================================================================

import { cardsOfRarity, getCard, type CardId } from './cards.ts';
import { signatures, type StarterName } from './starters.ts';
import type { StopKind } from './kingdom.ts';
import { pickOne, pickWeighted, type RngResult, type RngState } from './rng.ts';
import { OFFER_SIZE, STATUS_IS_AFFLICTION } from './rules.ts';
import { isUniqueCard, type UniqueCheck } from './unique.ts';
import { afflictionChanceBonusOf, cardChanceBonusOf, type SkillPick } from './skills.ts';
import type { CardRarity, StatusId } from './types.ts';

// --- ODDS ---
type RarityWeights = { item: Exclude<CardRarity, 'basic'>; weight: number }[];

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

// --- SKILL TREE ODDS ---
/** True when a card lays an affliction on someone (Poison, Bleed, Hex ...). */
const appliesAffliction = (cardId: CardId): boolean =>
  getCard(cardId).effects.some(
    (effect) => effect.kind in STATUS_IS_AFFLICTION && STATUS_IS_AFFLICTION[effect.kind as StatusId]
  );

/**
 * How much likelier the skill tree makes a card (0.3 = +30%): by its
 * type (Armory, Quiver), or GRIMOIRE for any card that afflicts.
 */
const offerBonusOf = (cardId: CardId, picks: readonly SkillPick[]): number => {
  const type = getCard(cardId).type;
  const afflictionBonus = appliesAffliction(cardId) ? afflictionChanceBonusOf(picks) : 0;
  return Math.max(cardChanceBonusOf(picks, type), afflictionBonus);
};

// --- ROLLS ---

/**
 * Rolls one card not already offered (falls back to any card of the
 * rarity). Cards in `barred` (Unique cards the deck already holds) are
 * never offered, unless they are the whole pool.
 */
const rollOneOffer = (
  state: RngState,
  source: Exclude<StopKind, 'grave'>,
  taken: readonly CardId[],
  starter?: StarterName,
  skillPicks: readonly SkillPick[] = [],
  barred: readonly CardId[] = []
): RngResult<CardId> => {
  const [rarity, afterRarity] = pickWeighted(state, RARITY_ODDS[source]);
  const fullPool = cardsOfRarity(rarity);
  const allowed = fullPool.filter((id) => !barred.includes(id));
  const pool = allowed.length ? allowed : fullPool;
  const fresh = pool.filter((id) => !taken.includes(id));
  const candidates = fresh.length ? fresh : pool;
  const preferredType = starter ? getCard(signatures[starter]).type : undefined;
  // Weight = starter preference (x3) times the skill tree's type bonus.
  const weightOf = (item: CardId): number => {
    const type = getCard(item).type;
    return (type === preferredType ? 3 : 1) * (1 + offerBonusOf(item, skillPicks));
  };
  const isEven = candidates.every((item) => weightOf(item) === 1);
  if (isEven) return pickOne(afterRarity, candidates);
  return pickWeighted(afterRarity, candidates.map((item) => ({ item, weight: weightOf(item) })));
};

/**
 * Rolls OFFER_SIZE distinct card offers for a stop. A Unique card
 * already in `deck` is never offered (see unique.ts).
 */
export const rollOffers = (
  seed: RngState,
  source: Exclude<StopKind, 'grave'>,
  exclude: readonly CardId[] = [],
  starter?: StarterName,
  skillPicks: readonly SkillPick[] = [],
  deck: readonly CardId[] = [],
  isUnique: UniqueCheck = isUniqueCard
): CardId[] => {
  const offers: CardId[] = [];
  const barred = deck.filter(isUnique);
  let current = seed;
  for (let slot = 0; slot < OFFER_SIZE; slot += 1) {
    const [cardId, next] = rollOneOffer(current, source, [...exclude, ...offers], starter, skillPicks, barred);
    offers.push(cardId);
    current = next;
  }
  return offers;
};
