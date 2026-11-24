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
  CardKeyword,
  Imbue,
  ImbueDuration,
  ImbueGift,
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

export const STATUS_INFO: Record<StatusId | 'guard', StatusInfo> = {
  guard: {
    label: 'Guard',
    description: 'Blocks damage until your next turn.',
  },
  hex: {
    label: 'Hex',
    description:
      'Before its turn: if odd, burns for this much, then loses a third (ends in 3: double, then clears). If even, +1.',
  },
  burn: {
    label: 'Burn',
    description:
      'After each action: lose this much HP, then halve (rounds down).',
  },
  frost: {
    label: 'Frost',
    description: 'Every hit deals this much less. Halves after each action.',
  },
  bleed: {
    label: 'Bleed',
    description:
      'Stacks. The 3rd non-Magic hit in a row deals this much, then clears. Magic resets the count.',
  },
  poison: {
    label: 'Poison',
    description: 'Lose this much HP each turn, then -1.',
  },
  weaken: {
    label: 'Weaken',
    description: '25% less damage. -1 each turn.',
  },
  wrath: { label: 'Wrath', description: 'Adds this much damage to every hit.' },
  might: { label: 'Might', description: 'Adds this much to every Melee hit.' },
  surge: { label: 'Surge', description: 'Adds this much to every Magic hit.' },
  hone: {
    label: 'Hone',
    description: 'Adds this much to every Range hit.',
  },
  momentum: {
    label: 'Momentum',
    description: 'Next Melee card this turn +50%.',
  },
  protection: {
    label: 'Protection',
    description:
      'Cuts each hit: I 25%, II 50%, III 75%. Recast next turn to raise it, or it lapses.',
  },
  enfeeble: {
    label: 'Enfeeble',
    description:
      'Cuts the damage it deals: I 25%, II 50%, III 75%. Lasts a turn; reapply next turn to deepen it.',
  },
  reinforce: {
    label: 'Reinforce',
    description: 'Adds this much to every Guard your cards give.',
  },
  aloft: {
    label: 'Aloft',
    description: 'Out of reach until it dives.',
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

/** " to ALL" suffix for area effects; melee sweeps the front only. */
const areaSuffix = (target: 'one' | 'all', isMelee = false): string => {
  if (target === 'one') return '';
  return isMelee ? ' to the front row' : ' to ALL';
};

/**
 * One line of card text. When `attacker` is given, numbers are a live
 * preview: damage after the villain's wrath, type buff and weaken, and
 * Guard with Reinforce added. When `target` is given too (the hero
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
      // In hand (no target) only the villain's own buffs count; Weaken
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
    case 'poison':
      return `Apply ${effect.amount} Poison${areaSuffix(effect.target)}.`;
    case 'burn':
      return `Apply ${effect.amount} Burn${areaSuffix(effect.target)}.`;
    case 'frost':
      return `Apply ${effect.amount} Frost${areaSuffix(effect.target)}.`;
    case 'bleed':
      return `Apply ${effect.amount} Bleed${areaSuffix(effect.target)}.`;
    case 'weaken':
      return `Apply ${effect.amount} Weaken${areaSuffix(effect.target)}.`;
    case 'enfeeble':
      return `Enfeeble${areaSuffix(effect.target)}. Reapply to deepen.`;
    case 'reap': {
      if (!target)
        return `Deal damage equal to ${effect.multiplier}× the target's Hex.`;
      const bonus = attacker ? typeBonus(attacker, cardDef.type) : 0;
      return `Deal ${target.statuses.hex * effect.multiplier + bonus} damage.`;
    }
    case 'guard': {
      const amount = attacker
        ? guardAmount(effect.amount, attacker)
        : effect.amount;
      return `Gain ${amount} Guard.`;
    }
    case 'wrath':
      return `Gain ${effect.amount} Wrath.`;
    case 'cleanse':
      return 'Cleanse 1 random affliction.';
    case 'protect':
      return 'Gain Protection. Recast next turn to raise it.';
    case 'buff':
      return `Gain ${effect.amount} ${STATUS_INFO[effect.buff].label}.`;
    case 'draw':
      return `Draw ${effect.amount} card${effect.amount === 1 ? '' : 's'}.`;
    case 'energy':
      return `Gain ${effect.amount} energy.`;
    case 'heal':
      return `Heal ${effect.amount} HP.`;
    case 'pull':
      return 'Pull a hero forward.';
    case 'push':
      return 'Push it to the back.';
    case 'imbue':
      return describeImbueEffect(effect, cardDef);
  }
};

// --- IMBUE TEXT ---
/** How each keyword reads on a card. */
const KEYWORD_LABEL: Record<CardKeyword, string> = {
  hold: 'Hold',
  piercing: 'Piercing',
};
/** How each imbue duration reads. */
export const DURATION_LABEL: Record<ImbueDuration, string> = {
  turn: 'this turn',
  battle: 'this battle',
};

/** What an imbue grants, as card text: "Hold." or "Apply 3 Poison.". */
export const describeImbueGift = (gift: ImbueGift, cardDef: CardDef): string =>
  gift.kind === 'keyword'
    ? `${KEYWORD_LABEL[gift.keyword]}.`
    : describeCardEffect(gift.effect, cardDef);

/**
 * A short tag for an imbue, small enough for the badge on a card in
 * hand: "Hold", "3 Poison", "Cleanse", "+2 dmg".
 */
export const imbueTag = (gift: ImbueGift): string => {
  if (gift.kind === 'keyword') return KEYWORD_LABEL[gift.keyword];
  const { effect } = gift;
  switch (effect.kind) {
    case 'damage':
      return `+${effect.amount} dmg`;
    case 'hex':
    case 'poison':
    case 'burn':
    case 'frost':
    case 'bleed':
    case 'weaken':
    case 'guard':
    case 'wrath':
      return `${effect.amount} ${STATUS_INFO[effect.kind].label}`;
    case 'buff':
      return `${effect.amount} ${STATUS_INFO[effect.buff].label}`;
    case 'enfeeble':
      return 'Enfeeble';
    case 'reap':
      return 'Reap';
    case 'cleanse':
      return 'Cleanse';
    case 'protect':
      return 'Protection';
    case 'draw':
      return `Draw ${effect.amount}`;
    case 'energy':
      return `+${effect.amount} energy`;
    case 'heal':
      return `Heal ${effect.amount}`;
  }
};

/** An Imbue card's own line: what it grants and for how long. */
const describeImbueEffect = (
  { gift, duration }: Imbue,
  cardDef: CardDef
): string =>
  gift.kind === 'keyword'
    ? `Imbue ${KEYWORD_LABEL[gift.keyword]} ${DURATION_LABEL[duration]}.`
    : `Imbue ${DURATION_LABEL[duration]}: ${describeImbueGift(gift, cardDef)}`;

// --- STATUS LINES ---
/** Card effects that lay a status on heroes ("Apply 2 Hex."). */
type AppliedStatus = Extract<
  CardEffect,
  { kind: 'hex' | 'poison' | 'burn' | 'frost' | 'bleed' | 'weaken' }
>;
const APPLIED_KINDS: ReadonlySet<CardEffect['kind']> = new Set([
  'hex',
  'poison',
  'burn',
  'frost',
  'bleed',
  'weaken',
]);
const isAppliedStatus = (effect: CardEffect): effect is AppliedStatus =>
  APPLIED_KINDS.has(effect.kind);

/** Joins words as "a", "a and b", "a, b and c". */
const joinAnd = (words: readonly string[]): string =>
  words.length <= 1
    ? (words[0] ?? '')
    : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;

/** One line for statuses laid on the same heroes: "Apply 1 Weaken and 1 Hex." */
const describeAppliedRun = (run: readonly AppliedStatus[]): string => {
  const parts = run.map(
    (effect) => `${effect.amount} ${STATUS_INFO[effect.kind].label}`
  );
  return `Apply ${joinAnd(parts)}${areaSuffix(run[0]?.target ?? 'one')}.`;
};

/**
 * A card's effects grouped for its text: statuses laid one after
 * another on the same heroes share one line, every other effect is a
 * line of its own. Keeps cards short enough for their face.
 */
const groupForText = (
  effects: readonly CardEffect[]
): (CardEffect | AppliedStatus[])[] =>
  effects.reduce<(CardEffect | AppliedStatus[])[]>((groups, effect) => {
    const last = groups.at(-1);
    const run = Array.isArray(last) ? last : null;
    if (!isAppliedStatus(effect)) return [...groups, effect];
    if (run && run[0]?.target === effect.target) {
      return [...groups.slice(0, -1), [...run, effect]];
    }
    return [...groups, [effect]];
  }, []);

/**
 * All text lines for a card: the effects (its type shows reach),
 * then "Hold." and "Fades." when it has those traits.
 */
export const describeCard = (
  cardId: CardId,
  attacker?: Combatant,
  target?: HeroUnit
): string[] => {
  const cardDef = getCard(cardId);
  const lines = groupForText(cardDef.effects).map((group) =>
    Array.isArray(group)
      ? describeAppliedRun(group)
      : describeCardEffect(group, cardDef, attacker, target)
  );
  const targetLine = cardDef.targets > 1 ? [`Target ${cardDef.targets}.`] : [];
  const traitLines = [
    ...cardDef.keywords.map((keyword) => `${KEYWORD_LABEL[keyword]}.`),
    ...(cardDef.fades ? ['Fades.'] : []),
  ];
  return [...targetLine, ...lines, ...traitLines];
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
  | 'poison'
  | 'burn'
  | 'frost'
  | 'bleed'
  | 'weaken'
  | 'guard'
  | 'buff'
  | 'heal'
  | 'cleanse'
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
    case 'poison':
    case 'burn':
    case 'frost':
    case 'bleed': {
      const amount = scaled(effect.amount);
      const label = STATUS_INFO[effect.kind].label;
      return {
        kind: effect.kind,
        text: `${amount}`,
        label: `${label} ${amount}`,
      };
    }
    case 'weaken':
      return {
        kind: 'weaken',
        text: `${effect.amount}`,
        label: `Weaken ${effect.amount}`,
      };
    case 'guard': {
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
    case 'cleanse':
      return {
        kind: 'cleanse',
        text: '',
        label: `Cleanses 1 affliction from ${effect.who === 'allies' ? 'every hero' : 'itself'}`,
      };
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
