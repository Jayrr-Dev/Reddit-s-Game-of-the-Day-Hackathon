// ===================================================================
// CARD BADGES (DATA)
// The small icon badges stacked under a card's cost coin: every gift
// an Imbue card gave it (its printed keywords are card text). Each is
// an icon, with a number where the gift has one ("3" on a Poison
// drop), and a tooltip from the glossary. The same gift imbued twice
// shows once with the amounts added (Poison 3 + 3 = 6). Icons and
// colours come from the same looks as the status chips, so a badge
// matches its chip.
// Drawn by CardBadges (components/game/CardBadges.tsx).
// ===================================================================

import { getCard, type CardId } from '../../shared/game/cards';
import {
  CLEANSE_INFO,
  DISPEL_INFO,
  DISRUPT_INFO,
  IMBUE_INFO,
  KEYWORD_INFO,
  STATUS_INFO,
  describeImbueGift,
  type StatusInfo,
} from '../../shared/game/describe';
import { healingAmount } from '../../shared/game/character';
import { afflictionAmount, guardAmount } from '../../shared/game/combatant';
import { STATUS_IS_AFFLICTION } from '../../shared/game/rules';
import type { StatusId } from '../../shared/game/types';
import { guardApplications, imbuedEffects } from '../../shared/game/imbue';
import type { Combatant, Imbue, ImbuableEffect } from '../../shared/game/types';
import { INTENT_LOOK, KEYWORD_LOOK, STATUS_LOOK, type Look } from './visuals';

// --- TYPES ---
export type CardBadge = Look & {
  key: string;
  /** The number on the badge (a gift's amount), if any. */
  count?: number;
  title: string;
  description: string;
};

/** A badge's icon, number and glossary entry. */
type BadgeLook = Look & { count?: number; info: StatusInfo };

// --- LOOKS ---

/** A plain action's own words (no status of its own to name it). */
const action = (label: string, description: string): StatusInfo => ({
  label,
  description,
});

/**
 * The badge for an imbued effect: its status chip's icon and glossary
 * entry where it has one, its amount as the number.
 */
const effectBadgeOf = (effect: ImbuableEffect): BadgeLook => {
  switch (effect.kind) {
    case 'damage':
      return {
        glyph: 'sword',
        toneClass: 'text-hp',
        count: effect.amount,
        info: action('Damage', 'Deals this much more damage.'),
      };
    case 'hex':
    case 'poison':
    case 'burn':
    case 'frost':
    case 'bleed':
    case 'shock':
    case 'vex':
    case 'weaken':
    case 'malaise':
    case 'guard':
    case 'wrath':
    case 'brace':
    case 'move':
    case 'rush':
    case 'armor':
      return {
        ...STATUS_LOOK[effect.kind],
        count: effect.amount,
        info: STATUS_INFO[effect.kind],
      };
    case 'enfeeble':
      return { ...STATUS_LOOK.enfeeble, info: STATUS_INFO.enfeeble };
    case 'buff':
      return {
        ...STATUS_LOOK[effect.buff],
        count: effect.amount,
        info: STATUS_INFO[effect.buff],
      };
    case 'reap':
      return {
        ...STATUS_LOOK.hex,
        count: effect.multiplier,
        info: action(
          'Reap',
          "Deals damage equal to the target's Hex times this."
        ),
      };
    case 'disrupt':
      return { ...INTENT_LOOK.disrupt, info: effect.allAfflictions ? {
        ...DISRUPT_INFO,
        description: 'Lowers one random buff and every existing debuff by ' + effect.amount + ' on each enemy.',
      } : DISRUPT_INFO };
    case 'dispel':
      return { ...INTENT_LOOK.dispel, info: DISPEL_INFO };
    case 'cleanse':
      return { ...INTENT_LOOK.cleanse, info: CLEANSE_INFO };
    case 'protect':
      return { ...STATUS_LOOK.protection, info: STATUS_INFO.protection };
    case 'draw':
      return {
        glyph: 'cards',
        toneClass: 'text-ink',
        count: effect.amount,
        info: action('Draw', 'Draws this many cards.'),
      };
    case 'energy':
      return {
        ...STATUS_LOOK.momentum,
        count: effect.amount,
        info: action('Energy', 'Gives this much energy.'),
      };
    case 'heal':
      return {
        ...INTENT_LOOK.heal,
        count: effect.amount,
        info: action('Heal', 'Heals you this much.'),
      };
  }
};

// --- HELPERS ---
/** One imbue's badge, its tooltip ending with the gift's card text. */
const imbueBadgeOf = (
  { gift }: Imbue,
  index: number,
  cardId: CardId
): CardBadge => {
  const look: BadgeLook =
    gift.kind === 'keyword'
      ? { ...KEYWORD_LOOK[gift.keyword], info: KEYWORD_INFO[gift.keyword] }
      : effectBadgeOf(gift.effect);
  const gives = describeImbueGift(gift, getCard(cardId));
  const { info, ...shown } = look;
  return {
    ...shown,
    key: `imbue-${index}`,
    title: `${IMBUE_INFO.label}: ${info.label}`,
    description: `**${gives}**\n${info.description}`,
  };
};

/**
 * Folds badges of the same gift into one, adding their
 * numbers (two Poison 3 imbues show as one Poison 6).
 */
const mergeStacked = (badges: readonly CardBadge[]): CardBadge[] =>
  badges.reduce<CardBadge[]>((merged, badge) => {
    const twin = merged.find((other) => other.title === badge.title);
    if (!twin) return [...merged, badge];
    const count = (twin.count ?? 0) + (badge.count ?? 0);
    return merged.map((other) =>
      other === twin ? { ...twin, ...(count ? { count } : {}) } : other
    );
  }, []);

/**
 * Every badge a card shows: one per gift from an Imbue card. Its own
 * printed keywords are card text instead (see describeCard).
 */
export const cardBadgesOf = (
  cardId: CardId,
  imbues: readonly Imbue[] = [],
  attacker?: Combatant
): CardBadge[] => {
  const repeats = guardApplications(getCard(cardId), imbuedEffects(imbues));
  return mergeStacked(imbues.map(({ gift }, index) => {
    if (attacker && gift.kind === 'effect' && gift.effect.kind === 'heal') {
      const amount = healingAmount(gift.effect.amount, attacker);
      return imbueBadgeOf({ gift: { ...gift, effect: { ...gift.effect, amount } } }, index, cardId);
    }
    if (attacker && gift.kind === 'effect' && gift.effect.kind === 'guard') {
      const amount = guardAmount(gift.effect.amount, attacker, repeats);
      return imbueBadgeOf({ gift: { ...gift, effect: { ...gift.effect, amount } } }, index, cardId);
    }
    if (attacker && gift.kind === 'effect' && 'amount' in gift.effect &&
        STATUS_IS_AFFLICTION[gift.effect.kind as StatusId]) {
      const amount = afflictionAmount(gift.effect.amount, attacker, gift.effect.kind as StatusId);
      return imbueBadgeOf({ gift: { ...gift, effect: { ...gift.effect, amount } } }, index, cardId);
    }
    return imbueBadgeOf({ gift }, index, cardId);
  }));
};
