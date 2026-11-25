// ===================================================================
// USES (EXHAUST)
// An Exhaust card can be played a few times in a run (EXHAUST_USES,
// or its own number), then it's gone from the deck. Its card counts
// up: "Use 1/3", "Use 2/3", "Use 3/3", then it Exhausts. Copies can't
// be told apart, so they wear out one at a time.
// ===================================================================

import { getCard, type CardId } from './cards.ts';
import { EXHAUST_USES } from './rules.ts';
import type { UsesSpent } from './types.ts';

// --- READS ---
/** How many uses a card has, or null for a card that doesn't Exhaust. */
export const usesOf = (cardId: CardId, bonusUses = 0): number | null => {
  const cardDef = getCard(cardId);
  if (!cardDef.keywords.includes('exhaust')) return null;
  // bonusUses: extra plays from the skill tree (Overflow on Utility).
  return (cardDef.uses ?? EXHAUST_USES) + bonusUses;
};

/** Uses already spent on this card's current copy. */
export const usesSpentOn = (usesSpent: UsesSpent, cardId: CardId): number =>
  usesSpent[cardId] ?? 0;

// --- SPENDING ---
/**
 * Counts one play of `cardId`. Its last use Exhausts it, and the count
 * clears so the next copy starts fresh. Cards that don't Exhaust are
 * never counted.
 */
export const spendUse = (
  usesSpent: UsesSpent,
  cardId: CardId,
  bonusUses = 0
): { usesSpent: UsesSpent; isExhausted: boolean } => {
  const uses = usesOf(cardId, bonusUses);
  if (uses === null) return { usesSpent, isExhausted: false };
  const spent = usesSpentOn(usesSpent, cardId) + 1;
  if (spent < uses)
    return { usesSpent: { ...usesSpent, [cardId]: spent }, isExhausted: false };
  const rest = { ...usesSpent };
  delete rest[cardId];
  return { usesSpent: rest, isExhausted: true };
};

/** The deck without the copies Exhausted in a fight (one per entry). */
export const deckWithout = (
  deck: readonly CardId[],
  exhausted: readonly CardId[]
): CardId[] =>
  exhausted.reduce<CardId[]>(
    (left, spent) => {
      const at = left.indexOf(spent);
      return at < 0 ? left : left.filter((_, index) => index !== at);
    },
    [...deck]
  );
