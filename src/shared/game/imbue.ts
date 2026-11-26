// ===================================================================
// IMBUE
// An Imbue card grants another card in hand a keyword (Hold, Piercing,
// Remove ...) or one more effect (Poison, Guard, Cleanse ...) for the
// rest of the battle; the Imbue card itself is Removed once played.
// The gifts live beside the hand, slot for slot (handImbues), so piles
// stay plain card ids.
//   PLAYED   the card's imbued effects land with its first pick, and
//            its imbues go to the pile with it (see PILES).
//   END TURN a card with Hold stays in hand; the rest are discarded
//            and keep their imbues (see PILES).
//   PILES    a card that leaves the hand stows its imbues; copies of a
//            card can't be told apart in a shuffled pile, so the next
//            copy drawn takes them back.
//   LIMIT    a card holds at most MAX_IMBUES_PER_CARD imbues, and Buff
//            cards (Imbue cards among them) take none.
//   STACKING a gift the card already has (printed or imbued) only goes
//            on again if it stacks (GIFT_STACKS): Poison 3 + Poison 3
//            makes 6; a second Hold or Cleanse has nowhere to go.
// An imbue never changes who a card may aim at: an effect that hits a
// hero can only go on a card that already aims at one hero.
// Pure functions, like the rest of the engine.
// ===================================================================

import { utilityHoldsOf } from './skills.ts';
import { isSelfEffect, targetRuleOf } from './battlefield.ts';
import { getCard, hasKeyword, hitsPerPlay, type CardId } from './cards.ts';
import {
  BUFF_KEYWORDS,
  MAX_IMBUES_PER_CARD,
  OUT_OF_RANGE_TYPES,
} from './rules.ts';
import type {
  CardEffect,
  CardDef,
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
/** Printed Guard repeats per target, imbued Guard per landed hit (or once on a skill). */
export const guardApplications = (card: CardDef, imbued: readonly ImbuableEffect[]): number => {
  const printed = card.effects.filter(effect => effect.kind === 'guard').length * card.targets;
  const gifts = imbued.filter(effect => effect.kind === 'guard').length;
  return Math.max(1, printed + gifts * Math.max(1, hitsPerPlay(card)));
};

/** The imbues on the card in hand slot `index` (none for a bad slot). */
export const imbuesAt = (state: CombatState, index: number): Imbue[] =>
  state.handImbues[index] ?? [];

/**
 * Keywords the villain's on/off buffs give this card (Berserker: Rampage
 * on Melee), shaped as imbues so they play and show like imbued ones.
 * Never stored in handImbues: they last only while the buff is on.
 */
const buffImbuesOf = (state: CombatState, cardId: CardId): Imbue[] => {
  const type = getCard(cardId).type;
  const fromBuffs = BUFF_KEYWORDS.filter(
    (entry) => state.player.statuses[entry.buff] > 0 && type === entry.type
  ).map(({ keyword }) => keyword);
  // OVERFLOW (skill tree): every Utility card has Hold.
  const fromSkills: CardKeyword[] =
    type === 'utility' && utilityHoldsOf(state.player.skillPicks) ? ['hold'] : [];
  return [...fromBuffs, ...fromSkills].map((keyword) => ({ gift: { kind: 'keyword', keyword } }));
};

/** Everything a card in hand carries when played: its imbues and buff keywords. */
export const cardImbuesAt = (state: CombatState, index: number): Imbue[] => {
  const cardId = state.hand[index];
  const own = imbuesAt(state, index);
  return cardId === undefined ? own : [...own, ...buffImbuesOf(state, cardId)];
};

/** The card's Imbue effect, or undefined for any other card. */
export const imbueEffectOf = (cardId: CardId): ImbueEffect | undefined =>
  getCard(cardId).effects.find(
    (effect): effect is ImbueEffect => effect.kind === 'imbue'
  );

/** The effects these imbues add to a card when it is played. */
export const imbuedEffects = (imbues: readonly Imbue[]): ImbuableEffect[] =>
  imbues.flatMap(({ gift }) => (gift.kind === 'effect' ? [gift.effect] : []));

/** A card's effects once its imbues are folded in (see foldImbuedDamage). */
export type FoldedEffects = {
  /** The card's own effects, Damage raised by any imbued damage. */
  own: CardEffect[];
  /** Imbued effects that still land on their own, after each hit. */
  extra: ImbuableEffect[];
};

/**
 * Folds imbued damage into the card's own Damage: Keen Edge (+5) on a
 * Damage 8 card makes it Damage 13 (every hit, on a multi-hit card),
 * so the number on the card is the number that lands. A card with no
 * Damage of its own keeps imbued damage as a separate hit. Every other
 * imbued effect stays extra.
 */
export const foldImbuedDamage = (
  cardEffects: readonly CardEffect[],
  imbued: readonly ImbuableEffect[]
): FoldedEffects => {
  const bonus = imbued.reduce(
    (sum, effect) => sum + (effect.kind === 'damage' ? effect.amount : 0),
    0
  );
  const hasOwnDamage = cardEffects.some((effect) => effect.kind === 'damage');
  if (!hasOwnDamage || bonus === 0)
    return { own: [...cardEffects], extra: [...imbued] };
  return {
    own: cardEffects.map((effect) =>
      effect.kind === 'damage'
        ? { ...effect, amount: effect.amount + bonus }
        : effect
    ),
    extra: imbued.filter((effect) => effect.kind !== 'damage'),
  };
};

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

// --- STACKING ---
/**
 * True for an effect that adds up when a card has it twice (an amount
 * to add); false for one that does the same thing however often it is
 * there. Keywords never stack.
 */
const EFFECT_STACKS: Record<ImbuableEffect['kind'], boolean> = {
  damage: true,
  hex: true,
  poison: true,
  burn: true,
  frost: true,
  shock: true,
  bleed: true,
  vex: true,
  weaken: true,
  guard: true,
  wrath: true,
  brace: true,
  buff: true,
  reap: true,
  draw: true,
  energy: true,
  heal: true,
  move: true,
  rush: true,
  armor: true,
  enfeeble: false,
  malaise: false,
  pin: false,
  cloak: false,
  protect: false,
  cleanse: false,
  dispel: false,
  disrupt: false,
};

/** What makes two effects "the same" for stacking: kind, and buff. */
const sameEffect = (a: CardEffect, b: ImbuableEffect): boolean =>
  a.kind === b.kind &&
  (a.kind !== 'buff' || b.kind !== 'buff' || a.buff === b.buff);

/** True when the card already has this effect, printed or imbued. */
const hasEffect = (
  cardId: CardId,
  imbues: readonly Imbue[],
  effect: ImbuableEffect
): boolean =>
  [...getCard(cardId).effects, ...imbuedEffects(imbues)].some((own) =>
    sameEffect(own, effect)
  );

/** True when a card aims a single-target hit at one hero. */
const hitsOneHero = (cardId: CardId): boolean =>
  getCard(cardId).effects.some(
    (effect) => effect.kind === 'damage' && effect.target === 'one'
  );

/** True when a card deals damage to heroes (so it can slay one). */
const dealsDamage = (cardId: CardId): boolean =>
  getCard(cardId).effects.some((effect) => effect.kind === 'damage');

/** True when a card fires Range or Magic damage (Out of Range applies). */
const firesShots = (cardId: CardId): boolean =>
  dealsDamage(cardId) && OUT_OF_RANGE_TYPES.has(getCard(cardId).type);

/**
 * Which cards each keyword may go on (besides one that already has it):
 * Hold and Remove on any card, Piercing on a card that hits one hero,
 * the free moves (Rampage on kill, Distance on hit) on any card that
 * deals damage,
 * Longrange on a card that fires Range or Magic damage. Exhaust and
 * Unique are printed only.
 */
const KEYWORD_FITS: Record<CardKeyword, (cardId: CardId) => boolean> = {
  hold: () => true,
  piercing: hitsOneHero,
  remove: () => true,
  // Exhaust is only printed (on consumables): no imbue grants it.
  exhaust: () => false,
  charge: (cardId) => getCard(cardId).type === 'melee' && dealsDamage(cardId),
  rampage: dealsDamage,
  distance: dealsDamage,
  longRange: firesShots,
  // Unique is a deck-building rule, printed only: no imbue grants it.
  unique: () => false,
};

/**
 * True when `gift` may go on `cardId` (already imbued with `imbues`).
 * A keyword goes on a card that lacks it and fits it (KEYWORD_FITS). An
 * effect the card already has goes on only if it stacks. A self effect
 * goes on any card; a hero effect only on a card that already aims at
 * one hero (and never as an area effect), so the card's aim stays the
 * same.
 */
export const canImbueOnto = (
  gift: ImbueGift,
  cardId: CardId,
  imbues: readonly Imbue[] = []
): boolean => {
  const { type } = getCard(cardId);
  if (type === 'buff' || type === 'imbue' || imbues.length >= MAX_IMBUES_PER_CARD) return false;
  if (gift.kind === 'keyword')
    return (
      !cardHasKeyword(cardId, imbues, gift.keyword) &&
      KEYWORD_FITS[gift.keyword](cardId)
    );
  const isRepeat = hasEffect(cardId, imbues, gift.effect);
  if (isRepeat && !EFFECT_STACKS[gift.effect.kind]) return false;
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
    index !== handIndex &&
    canImbueOnto(imbue.gift, other, imbuesAt(state, index))
      ? [index]
      : []
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
  const isAllowed =
    cardId !== undefined &&
    canImbueOnto(imbue.gift, cardId, imbuesAt(state, slot));
  if (!isAllowed) return state;
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
  // FATIGUE surcharges stay with their cards as the slots close up.
  ...(state.handFatigue && {
    handFatigue: state.handFatigue.filter((_, slot) => slot !== index),
  }),
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

/** Stows a card's imbues as it goes to a pile. */
const stowImbues = (
  state: CombatState,
  cardId: CardId,
  imbues: readonly Imbue[]
): CombatState =>
  imbues.length === 0
    ? state
    : {
        ...state,
        stowedImbues: [...state.stowedImbues, { cardId, imbues: [...imbues] }],
      };

/**
 * End of turn: cards with Hold stay in hand with their imbues; the rest
 * go to the discard pile, stowing theirs.
 */
export const discardHand = (state: CombatState): CombatState => {
  // Stored imbues travel with the card; buff and skill keywords only count.
  const slots = state.hand.map((cardId, index) => ({
    cardId,
    imbues: imbuesAt(state, index),
    isHeld: holdsCard(cardId, cardImbuesAt(state, index)),
  }));
  const kept = slots.filter((slot) => slot.isHeld);
  const dropped = slots.filter((slot) => !slot.isHeld);
  const discarded: CombatState = {
    ...state,
    hand: kept.map((slot) => slot.cardId),
    handImbues: kept.map((slot) => slot.imbues),
    // FATIGUE lasts one turn: held cards go back to their usual cost.
    handFatigue: [],
    discardPile: [...state.discardPile, ...dropped.map((slot) => slot.cardId)],
  };
  return dropped.reduce(
    (current, slot) => stowImbues(current, slot.cardId, slot.imbues),
    discarded
  );
};

/**
 * A played card's imbues go to the pile with it (they last the battle),
 * so the next copy drawn takes them back.
 */
export const stowPlayedImbues = (
  state: CombatState,
  cardId: CardId,
  imbues: readonly Imbue[]
): CombatState => stowImbues(state, cardId, imbues);
