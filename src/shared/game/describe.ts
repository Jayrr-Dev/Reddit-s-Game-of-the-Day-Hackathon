// ===================================================================
// DESCRIPTIONS
// Turns game data into words and numbers for the screen. Card text and
// hero intents are generated from the same effects the engine runs, so
// the UI can never disagree with the rules.
// ===================================================================

import { targetRuleOf } from './battlefield.ts';
import { getCard, type CardId } from './cards.ts';
import {
  attackDamage,
  buffedAttackDamage,
  guardAmount,
  typeBonus,
} from './combatant.ts';
import { getHero } from './heroes.ts';
import {
  cardHitOn,
  heroAttackOf,
  plannedHeroMoves,
  scaleByMight,
} from './combat.ts';
import type {
  CardDef,
  CardEffect,
  Combatant,
  HeroAttackType,
  HeroEffect,
  HeroMove,
  HeroUnit,
  PassiveId,
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
    description:
      'From charging: your next Melee card this turn deals 50% more damage.',
  },
  protection: {
    label: 'Protection',
    description: 'Adds this much to every Guard your cards give.',
  },
  aloft: {
    label: 'Aloft',
    description:
      'High in the sky: no card can aim at or hit it until it dives back down.',
  },
};

/** What each boss passive is called and does (always on). */
export const PASSIVE_INFO: Record<PassiveId, StatusInfo> = {
  vigor: {
    label: 'Vigor',
    description: 'Boss passive: makes two moves every turn.',
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
 * Shroud with Protection added. When `target` is given too (the hero
 * the card is aimed at), single-target numbers are for that hero: a
 * Range card's long-range bonus, and Reap's damage from its Hex.
 * `cardDef` gives the type and reach.
 */
export const describeCardEffect = (
  effect: CardEffect,
  cardDef: CardDef,
  attacker?: Combatant,
  target?: HeroUnit
): string => {
  const isMelee = !cardDef.reach;
  switch (effect.kind) {
    case 'damage': {
      // In hand (no target) only the villain's own buffs count; Dread
      // and the target's own modifiers join once the card is aimed.
      const damageOf = target ? attackDamage : buffedAttackDamage;
      const perHit = attacker
        ? damageOf(effect.amount, attacker, cardDef.type)
        : effect.amount;
      const isAimed = target !== undefined && effect.target === 'one';
      const amount = isAimed ? cardHitOn(target, perHit, cardDef) : perHit;
      const times = effect.hits > 1 ? ` ${effect.hits} times` : '';
      return `Deal ${amount} damage${times}${areaSuffix(effect.target, isMelee)}.`;
    }
    case 'hex':
      return `Apply ${effect.amount} Hex${areaSuffix(effect.target)}.`;
    case 'dread':
      return `Apply ${effect.amount} Dread${areaSuffix(effect.target)}.`;
    case 'reap': {
      if (!target)
        return `Deal damage equal to ${effect.multiplier}× the target's Hex.`;
      const bonus = attacker ? typeBonus(attacker, cardDef.type) : 0;
      return `Deal ${target.statuses.hex * effect.multiplier + bonus} damage.`;
    }
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
  attacker?: Combatant,
  target?: HeroUnit
): string[] => {
  const cardDef = getCard(cardId);
  const lines = cardDef.effects.map((effect) =>
    describeCardEffect(effect, cardDef, attacker, target)
  );
  const targetLine = cardDef.targets > 1 ? [`Target ${cardDef.targets}.`] : [];
  return [...targetLine, ...lines, ...(cardDef.fades ? ['Fades.'] : [])];
};

/** True when playing this card needs the player to pick a hero. */
export const cardNeedsTarget = (cardId: CardId): boolean =>
  targetRuleOf(cardId) !== 'none';

// --- HERO INTENTS ---
export type IntentKind =
  | 'attack'
  | 'range'
  | 'magic'
  | 'curse'
  | 'dread'
  | 'guard'
  | 'buff'
  | 'heal'
  | 'summon'
  | 'revive'
  | 'soar'
  | 'advance';

/** The intent chip for each way a hero attack can land. */
const ATTACK_INTENT: Record<HeroAttackType, IntentKind> = {
  melee: 'attack',
  range: 'range',
  magic: 'magic',
};
/** How each attack type reads in a tooltip. */
const ATTACK_NAME: Record<HeroAttackType, string> = {
  melee: 'Melee',
  range: 'Range',
  magic: 'Magic',
};
/**
 * One intent chip: `text` is just the number (the icon says what it
 * is); `label` spells it out for the tooltip. `isSignature` marks a
 * chip of the hero's signature move (drawn in gold).
 */
export type Intent = {
  kind: IntentKind;
  text: string;
  label: string;
  isSignature?: boolean;
};

/** One intent chip for one effect of a hero's next move. */
const describeHeroEffect = (unit: HeroUnit, effect: HeroEffect): Intent => {
  const scaled = (amount: number) => scaleByMight(amount, unit.might);
  const toWhom = (who: 'self' | 'allies') =>
    who === 'allies' ? ' to every hero' : '';
  switch (effect.kind) {
    case 'attack': {
      const { type, perHit } = heroAttackOf(unit, effect);
      const text = effect.hits > 1 ? `${perHit}×${effect.hits}` : `${perHit}`;
      return {
        kind: ATTACK_INTENT[type],
        text,
        label: `${ATTACK_NAME[type]} attack for ${text}`,
      };
    }
    case 'hex': {
      const amount = scaled(effect.amount);
      return { kind: 'curse', text: `${amount}`, label: `Hex ${amount}` };
    }
    case 'dread':
      return {
        kind: 'dread',
        text: `${effect.amount}`,
        label: `Dread ${effect.amount}`,
      };
    case 'shroud': {
      const amount = scaled(effect.amount);
      return {
        kind: 'guard',
        text: `${amount}`,
        label: `Guard ${amount}${toWhom(effect.who)}`,
      };
    }
    case 'wrath':
      return {
        kind: 'buff',
        text: `+${effect.amount}`,
        label: `Wrath +${effect.amount}${toWhom(effect.who)}`,
      };
    case 'heal': {
      const amount = scaled(effect.amount);
      return {
        kind: 'heal',
        text: `${amount}`,
        label: `Heal ${amount}${toWhom(effect.who)}`,
      };
    }
    case 'revive':
      return { kind: 'revive', text: '', label: 'Revives every fallen ally' };
    case 'soar':
      return {
        kind: 'soar',
        text: '',
        label: 'Flies up out of reach, then dives next turn',
      };
    case 'summon':
      return {
        kind: 'summon',
        text: `${effect.count}`,
        label: `Summons ${effect.count} ${getHero(effect.heroId).name}${effect.count > 1 ? 's' : ''}`,
      };
  }
};

/** The chip for a hero with no move it can make from the back row. */
const ADVANCE_INTENT: Intent = {
  kind: 'advance',
  text: '',
  label: 'Steps up to the front row',
};

/**
 * One move a hero will make: its name, whether it is the hero's
 * signature, and one chip per effect. The view draws a move as ONE
 * action (a hero with two actions a turn, a boss, shows two), so a
 * move with two effects (Guard and Wrath) never reads as two actions.
 */
export type MoveIntent = {
  name: string;
  isSignature: boolean;
  intents: Intent[];
};

/** The chips for one move: one per effect, in order. */
const describeMove = (unit: HeroUnit, heroMove: HeroMove): MoveIntent => ({
  name: heroMove.name,
  isSignature: heroMove.isSignature ?? false,
  intents: heroMove.effects.map((effect) => ({
    ...describeHeroEffect(unit, effect),
    ...(heroMove.isSignature ? { isSignature: true } : {}),
  })),
});

/** What a hero with no move it can make does: it steps up. */
const ADVANCE_MOVE: MoveIntent = {
  name: 'Advance',
  isSignature: false,
  intents: [ADVANCE_INTENT],
};

/**
 * What a hero will do this turn: its moves' names ("A, then B" for a
 * boss with two actions), each move with its chips (`moves`), and
 * every chip in order (`intents`), or "Advance" when it has no move it
 * can make from where it stands.
 */
export const describeHeroIntent = (
  unit: HeroUnit,
  heroes: readonly HeroUnit[]
): { name: string; moves: MoveIntent[]; intents: Intent[] } => {
  const planned = plannedHeroMoves(unit, heroes).map((p) => p.move);
  const moves =
    planned.length === 0
      ? [ADVANCE_MOVE]
      : planned.map((heroMove) => describeMove(unit, heroMove));
  return {
    name: moves.map((move) => move.name).join(', then '),
    moves,
    intents: moves.flatMap((move) => move.intents),
  };
};
