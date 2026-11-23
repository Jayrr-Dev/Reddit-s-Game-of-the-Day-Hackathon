// ===================================================================
// DESCRIPTIONS
// Turns game data into words and numbers for the screen. Card text and
// hero intents are generated from the same effects the engine runs, so
// the UI can never disagree with the rules.
// ===================================================================

import { targetRuleOf } from './battlefield.ts';
import { getCard, type CardId } from './cards.ts';
import { attackDamage, guardAmount } from './combatant.ts';
import { nextHeroMove, scaleByMight } from './combat.ts';
import type {
  CardDef,
  CardEffect,
  Combatant,
  HeroEffect,
  HeroUnit,
  StatusId,
} from './types.ts';

// --- STATUS GLOSSARY ---
export type StatusInfo = { label: string; description: string };

export const STATUS_INFO: Record<StatusId | 'shroud', StatusInfo> = {
  shroud: {
    label: 'Guard',
    description: 'Blocks damage. Fades at the start of your turn.',
  },
  hex: {
    label: 'Hex',
    description: 'Loses this much HP each turn, then Hex drops by 1.',
  },
  dread: {
    label: 'Dread',
    description: 'Deals 25% less attack damage. Drops by 1 each turn.',
  },
  wrath: { label: 'Wrath', description: 'Adds this much damage to every hit.' },
  might: { label: 'Might', description: 'Adds this much to every Melee hit.' },
  surge: { label: 'Surge', description: 'Adds this much to every Magic hit.' },
  piercing: {
    label: 'Piercing',
    description: 'Adds this much to every Range hit.',
  },
  momentum: {
    label: 'Momentum',
    description: 'From charging: your next Melee card deals 50% more damage.',
  },
  protection: {
    label: 'Protection',
    description: 'Adds this much to every Guard your cards give.',
  },
};

// --- CARD TEXT ---

/** "to all heroes" suffix for area effects; melee sweeps the front only. */
const areaSuffix = (target: 'one' | 'all', isMelee = false): string => {
  if (target === 'one') return '';
  return isMelee ? ' to the front row' : ' to ALL heroes';
};

/**
 * One line of card text. When `attacker` is given, numbers are a live
 * preview: damage after the villain's wrath, type buff and dread, and
 * Shroud with Protection added. `cardDef` gives the type and reach.
 */
export const describeCardEffect = (
  effect: CardEffect,
  cardDef: CardDef,
  attacker?: Combatant
): string => {
  const isMelee = !cardDef.reach;
  switch (effect.kind) {
    case 'damage': {
      const amount = attacker
        ? attackDamage(effect.amount, attacker, cardDef.type)
        : effect.amount;
      const times = effect.hits > 1 ? ` ${effect.hits} times` : '';
      return `Deal ${amount} damage${times}${areaSuffix(effect.target, isMelee)}.`;
    }
    case 'hex':
      return `Apply ${effect.amount} Hex${areaSuffix(effect.target)}.`;
    case 'dread':
      return `Apply ${effect.amount} Dread${areaSuffix(effect.target)}.`;
    case 'reap':
      return `Deal damage equal to ${effect.multiplier}× the target's Hex.`;
    case 'shroud': {
      const amount = attacker
        ? guardAmount(effect.amount, attacker)
        : effect.amount;
      return `Gain ${amount} Guard.`;
    }
    case 'wrath':
      return `Gain ${effect.amount} Wrath.`;
    case 'buff':
      return `Gain ${effect.amount} ${STATUS_INFO[effect.buff].label}.`;
    case 'draw':
      return `Draw ${effect.amount} card${effect.amount === 1 ? '' : 's'}.`;
    case 'energy':
      return `Gain ${effect.amount} energy.`;
    case 'heal':
      return `Heal ${effect.amount} HP.`;
    case 'pull':
      return 'Pull a hero to the front.';
    case 'push':
      return 'Push it to the back.';
  }
};

/**
 * All text lines for a card: the effects (its type shows reach),
 * then "Fades." when it does.
 */
export const describeCard = (
  cardId: CardId,
  attacker?: Combatant
): string[] => {
  const cardDef = getCard(cardId);
  const lines = cardDef.effects.map((effect) =>
    describeCardEffect(effect, cardDef, attacker)
  );
  return [...lines, ...(cardDef.fades ? ['Fades.'] : [])];
};

/** True when playing this card needs the player to pick a hero. */
export const cardNeedsTarget = (cardId: CardId): boolean =>
  targetRuleOf(cardId) !== 'none';

// --- HERO INTENTS ---
export type IntentKind = 'attack' | 'curse' | 'guard' | 'buff' | 'heal';
export type Intent = { kind: IntentKind; text: string };

/** One intent chip for one effect of a hero's next move. */
const describeHeroEffect = (unit: HeroUnit, effect: HeroEffect): Intent => {
  const scaled = (amount: number) => scaleByMight(amount, unit.might);
  const allies = (who: 'self' | 'allies') => (who === 'allies' ? ' all' : '');
  switch (effect.kind) {
    case 'attack': {
      const perHit = attackDamage(scaled(effect.amount), unit);
      return {
        kind: 'attack',
        text: effect.hits > 1 ? `${perHit}×${effect.hits}` : `${perHit}`,
      };
    }
    case 'hex':
      return { kind: 'curse', text: `Hex ${scaled(effect.amount)}` };
    case 'dread':
      return { kind: 'curse', text: `Dread ${effect.amount}` };
    case 'shroud':
      return {
        kind: 'guard',
        text: `${scaled(effect.amount)}${allies(effect.who)}`,
      };
    case 'wrath':
      return {
        kind: 'buff',
        text: `Wrath +${effect.amount}${allies(effect.who)}`,
      };
    case 'heal':
      return {
        kind: 'heal',
        text: `${scaled(effect.amount)}${allies(effect.who)}`,
      };
  }
};

/** What a hero will do next: the move's name plus one chip per effect. */
export const describeHeroIntent = (
  unit: HeroUnit
): { name: string; intents: Intent[] } => {
  const heroMove = nextHeroMove(unit);
  return {
    name: heroMove.name,
    intents: heroMove.effects.map((effect) => describeHeroEffect(unit, effect)),
  };
};
