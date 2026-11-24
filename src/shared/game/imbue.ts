// ===================================================================
// IMBUE
// An Imbue card grants another card in hand a keyword (Hold) or one
// more effect (Poison, Guard, Cleanse ...), for this turn or the whole
// battle. The gifts live beside the hand, slot for slot (handImbues),
// so piles stay plain card ids.
//   PLAYED   the card's imbued effects land once, at its first pick.
//   END TURN a card with Hold stays in hand; then every turn imbue
//            wears off.
//   PILES    a card leaving the hand stows its battle imbues; copies of
//            a card can't be told apart in a shuffled pile, so the
//            next copy drawn takes them back.
// An imbue never changes who a card may aim at: an effect that hits a
// hero can only go on a card that already aims at one hero.
// Pure functions, like the rest of the engine.
// ===================================================================

import { isSelfEffect, targetRuleOf } from './battlefield.ts';
import { getCard, hasKeyword, type CardId } from './cards.ts';
import type {
  CardEffect,
  CardKeyword,
  CombatState,
  Imbue,
  ImbuableEffect,
  ImbueGift,
} from './types.ts';

// --- TYPES ---
/** The Imbue effect of a card, if it has one. */
export type ImbueEffect = Extract<CardEffect, { kind: 'imbue' }>;

// --- READING ---
/** The imbues on the card in hand slot `index` (none for a bad slot). */
export const imbuesAt = (state: CombatState, index: number): Imbue[] =>
  state.handImbues[index] ?? [];

/** The card's Imbue effect, or undefined for any other card. */
export const imbueEffectOf = (cardId: CardId): ImbueEffect | undefined =>
  getCard(cardId).effects.find(
    (effect): effect is ImbueEffect => effect.kind === 'imbue'
  );

/** The effects these imbues add to a card when it is played. */
export const imbuedEffects = (imbues: readonly Imbue[]): ImbuableEffect[] =>
  imbues.flatMap(({ gift }) => (gift.kind === 'effect' ? [gift.effect] : []));

/** True when a card has `keyword`, printed or imbued. */
export const cardHasKeyword = (
  cardId: CardId,
  imbues: readonly Imbue[],
  keyword: CardKeyword
): boolean =>
  hasKeyword(cardId, keyword) ||
  imbues.some(
    ({ gift }) => gift.kind === 'keyword' && gift.keyword === keyword
  );

/** True when a card stays in hand at end of turn (printed or imbued). */
const holdsCard = (cardId: CardId, imbues: readonly Imbue[]): boolean =>
  cardHasKeyword(cardId, imbues, 'hold');

/** True when a card aims a single-target hit at one hero. */
const hitsOneHero = (cardId: CardId): boolean =>
  getCard(cardId).effects.some(
    (effect) => effect.kind === 'damage' && effect.target === 'one'
  );

/**
 * Which cards each keyword may go on (besides one already printed with
 * it): Hold on any card, Piercing on a card that hits one hero.
 */
const KEYWORD_FITS: Record<CardKeyword, (cardId: CardId) => boolean> = {
  hold: () => true,
  piercing: hitsOneHero,
};

/**
 * True when `gift` may go on `cardId`. A keyword goes on a card that
 * lacks it and fits it (KEYWORD_FITS); a self effect goes on any card; a hero effect only on a card that
 * already aims at one hero (and never as an area effect), so the
 * card's aim stays the same.
 */
export const canImbueOnto = (gift: ImbueGift, cardId: CardId): boolean => {
  if (gift.kind === 'keyword')
    return (
      !hasKeyword(cardId, gift.keyword) && KEYWORD_FITS[gift.keyword](cardId)
    );
  if (isSelfEffect(gift.effect)) return true;
  const isArea = 'target' in gift.effect && gift.effect.target === 'all';
  return !isArea && targetRuleOf(cardId) !== 'none';
};

/** Hand slots the Imbue card in slot `handIndex` may imbue. */
export const imbueSlotsFor = (
  state: CombatState,
  handIndex: number
): number[] => {
  const cardId = state.hand[handIndex];
  const imbue = cardId === undefined ? undefined : imbueEffectOf(cardId);
  if (!imbue) return [];
  return state.hand.flatMap((other, index) =>
    index !== handIndex && canImbueOnto(imbue.gift, other) ? [index] : []
  );
};

// --- CHANGING ---
/** Adds an imbue to the card in hand slot `slot` (if it may take it). */
export const imbueSlot = (
  state: CombatState,
  slot: number,
  imbue: Imbue
): CombatState => {
  const cardId = state.hand[slot];
  if (cardId === undefined || !canImbueOnto(imbue.gift, cardId)) return state;
  return {
    ...state,
    handImbues: state.hand.map((_, index) =>
      index === slot
        ? [...imbuesAt(state, slot), imbue]
        : imbuesAt(state, index)
    ),
  };
};

/** Takes the card out of hand slot `index` along with its imbues. */
export const removeFromHand = (
  state: CombatState,
  index: number
): CombatState => ({
  ...state,
  hand: state.hand.filter((_, slot) => slot !== index),
  handImbues: state.hand
    .map((__, slot) => imbuesAt(state, slot))
    .filter((_, slot) => slot !== index),
});

/** Puts a card in hand; a copy drawn takes back its stowed battle imbues. */
export const addToHand = (state: CombatState, cardId: CardId): CombatState => {
  const stowedIndex = state.stowedImbues.findIndex(
    (stowed) => stowed.cardId === cardId
  );
  const stowed = state.stowedImbues[stowedIndex];
  return {
    ...state,
    hand: [...state.hand, cardId],
    handImbues: [
      ...state.hand.map((_, slot) => imbuesAt(state, slot)),
      stowed?.imbues ?? [],
    ],
    stowedImbues: state.stowedImbues.filter((_, i) => i !== stowedIndex),
  };
};

/** Stows a card's battle imbues as it goes to the discard pile. */
export const stowImbues = (
  state: CombatState,
  cardId: CardId,
  imbues: readonly Imbue[]
): CombatState => {
  const lasting = imbues.filter(({ duration }) => duration === 'battle');
  return lasting.length === 0
    ? state
    : {
        ...state,
        stowedImbues: [...state.stowedImbues, { cardId, imbues: lasting }],
      };
};

/**
 * End of turn: cards with Hold stay in hand, the rest go to the
 * discard pile (stowing their battle imbues); then turn imbues wear off.
 */
export const discardHand = (state: CombatState): CombatState => {
  const slots = state.hand.map((cardId, index) => ({
    cardId,
    imbues: imbuesAt(state, index),
  }));
  const kept = slots.filter((slot) => holdsCard(slot.cardId, slot.imbues));
  const dropped = slots.filter((slot) => !holdsCard(slot.cardId, slot.imbues));
  const lastingOf = (imbues: readonly Imbue[]) =>
    imbues.filter(({ duration }) => duration === 'battle');
  const discarded: CombatState = {
    ...state,
    hand: kept.map((slot) => slot.cardId),
    handImbues: kept.map((slot) => lastingOf(slot.imbues)),
    discardPile: [...state.discardPile, ...dropped.map((slot) => slot.cardId)],
  };
  return dropped.reduce(
    (current, slot) => stowImbues(current, slot.cardId, slot.imbues),
    discarded
  );
};
