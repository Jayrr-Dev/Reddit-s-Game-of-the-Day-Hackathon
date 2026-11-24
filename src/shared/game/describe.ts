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
import { ELEMENT_ON_HIT } from './rules.ts';
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
  Duration,
  Imbue,
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
  brace: {
    label: 'Brace',
    description:
      'Your Guard does not expire at the start of your turn. -1 each turn it keeps it.',
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
    case 'poison':
    case 'burn':
    case 'frost':
    case 'bleed':
    case 'weaken':
      return describeStatusLine(effect);
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
    case 'brace':
      return `Gain ${effect.amount} Brace.`;
    case 'cleanse':
      return 'Cleanse 1 random affliction.';
    case 'protect':
      return 'Gain Protection. Recast next turn to raise it.';
    case 'buff':
      return `Gain ${effect.amount} ${STATUS_INFO[effect.buff].label}${durationSuffix(effect.duration)}.`;
    case 'draw':
      return `Draw ${effect.amount} card${effect.amount === 1 ? '' : 's'}.`;
    case 'energy':
      return `Gain ${effect.amount} energy.`;
    case 'heal':
      return `Heal ${effect.amount} HP.`;
    case 'pull':
      return FORCE_PULL_INFO.label;
    case 'push':
      return FORCE_PUSH_INFO.label;
    case 'imbue':
      return describeImbueEffect(effect);
  }
};

// --- IMBUE TEXT ---
/** Each keyword's name and what it does (its badge's tooltip). */
export const KEYWORD_INFO: Record<CardKeyword, StatusInfo> = {
  hold: {
    label: 'Hold',
    description: 'Stays in your hand at the end of the turn.',
  },
  piercing: {
    label: 'Piercing',
    description:
      "Each hit also strikes the hero in the other row of its target's column.",
  },
  remove: {
    label: 'Remove',
    description:
      'Once played, goes to the Remove pile until the fight is over.',
  },
  rampage: {
    label: 'Rampage',
    description: 'On kill: Charge if possible (paying its usual cost).',
  },
  distance: {
    label: 'Distance',
    description: 'On kill: Back Step if possible (paying its usual cost).',
  },
};

// --- DURATIONS ---
/**
 * How each duration reads on a card (in italics, after its gift) and
 * what it means (a badge's tooltip).
 */
export const DURATION_INFO: Record<Duration, StatusInfo> = {
  action: {
    label: 'this action',
    description: 'Lasts until the next card is played.',
  },
  turn: { label: 'this turn', description: 'Lasts until the end of the turn.' },
  battle: {
    label: 'this battle',
    description: 'Lasts the whole fight, even after the card is played.',
  },
};

/** " this turn" after a timed gift; nothing for a lasting one. */
const durationSuffix = (duration: Duration | undefined): string =>
  duration ? ` ${DURATION_INFO[duration].label}` : '';
/** What Imbue means, wherever it shows. */
export const IMBUE_INFO: StatusInfo = {
  label: 'Imbue',
  description:
    'Give another card in your hand this keyword or effect. It lasts until that card is played, unless it says how long.',
};
/** What Force Pull and Force Push mean, wherever they show. */
export const FORCE_PULL_INFO: StatusInfo = {
  label: 'Force Pull',
  description: 'Pulls the target hero to the front row.',
};
export const FORCE_PUSH_INFO: StatusInfo = {
  label: 'Force Push',
  description: 'Pushes the target hero to the back row.',
};
/** What Cleanse means, wherever it shows. */
export const CLEANSE_INFO: StatusInfo = {
  label: 'Cleanse',
  description: 'Removes 1 random affliction from you.',
};

/**
 * THE GLOSSARY: every word with a meaning of its own (statuses,
 * keywords, Imbue, Cleanse), by the name it is printed with.
 * Card text bolds these and explains them on hover or long press, and
 * badges and chips read the same entries, so a definition lives here
 * only.
 */
export const GLOSSARY: Readonly<Record<string, StatusInfo>> =
  Object.fromEntries(
    [
      ...Object.values(STATUS_INFO),
      ...Object.values(KEYWORD_INFO),
      IMBUE_INFO,
      CLEANSE_INFO,
      FORCE_PULL_INFO,
      FORCE_PUSH_INFO,
    ].map((info) => [info.label, info])
  );

/** How each keyword reads on a card. */
const KEYWORD_LABEL = (keyword: CardKeyword): string =>
  KEYWORD_INFO[keyword].label;

/** What an imbue grants, as card text: "Hold." or "Poison 3". */
export const describeImbueGift = (gift: ImbueGift, cardDef: CardDef): string =>
  gift.kind === 'keyword'
    ? `${KEYWORD_LABEL(gift.keyword)}.`
    : describeCardEffect(gift.effect, cardDef);

/**
 * A short tag for an imbue, small enough for the badge on a card in
 * hand: "Hold", "Poison 3", "Cleanse", "+2 dmg".
 */
export const imbueTag = (gift: ImbueGift): string => {
  if (gift.kind === 'keyword') return KEYWORD_LABEL(gift.keyword);
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
      return `${STATUS_INFO[effect.kind].label} ${effect.amount}`;
    case 'buff':
      return `${STATUS_INFO[effect.buff].label} ${effect.amount}`;
    case 'enfeeble':
      return 'Enfeeble';
    case 'brace':
      return `Brace ${effect.amount}`;
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

/**
 * An Imbue card's own line: what it grants, and for how long when that
 * isn't "until that card is played" ("Imbue Hold this battle.").
 */
const describeImbueEffect = ({ gift, duration }: Imbue): string =>
  `Imbue ${imbueTag(gift)}${durationSuffix(duration)}.`;

// --- STATUS LINES ---
/** Card effects that lay a status on heroes. */
type AppliedStatus = Extract<
  CardEffect,
  { kind: 'hex' | 'poison' | 'burn' | 'frost' | 'bleed' | 'weaken' }
>;

/** A status laid on heroes, as its name and number: "Hex 2", "Hex 4 to ALL". */
const describeStatusLine = (effect: AppliedStatus): string =>
  `${STATUS_INFO[effect.kind].label} ${effect.amount}${areaSuffix(effect.target)}`;

/** The line for what a card's element lays on each hit, if anything. */
const elementLines = (cardDef: CardDef): string[] => {
  const onHit = cardDef.element ? ELEMENT_ON_HIT[cardDef.element] : null;
  if (!onHit) return [];
  const { label } = STATUS_INFO[onHit.status];
  return [`${label} ${onHit.amount} per hit`];
};

/**
 * A card's rules lines: Target N, then its effects (its type shows
 * reach). Its keywords are left out: on screen they are
 * badges (see describeCard for the full text).
 */
export const describeCardRules = (
  cardId: CardId,
  attacker?: Combatant,
  target?: HeroUnit
): string[] => {
  const cardDef = getCard(cardId);
  const lines = cardDef.effects.map((effect) =>
    describeCardEffect(effect, cardDef, attacker, target)
  );
  const targetLine = cardDef.targets > 1 ? [`Target ${cardDef.targets}.`] : [];
  return [...targetLine, ...lines, ...elementLines(cardDef)];
};

/**
 * All text lines for a card: its rules, then its keywords together on
 * one last line ("Hold.", or "Hold. Piercing.").
 */
export const describeCard = (
  cardId: CardId,
  attacker?: Combatant,
  target?: HeroUnit
): string[] => {
  const cardDef = getCard(cardId);
  const keywordLine = cardDef.keywords
    .map((keyword) => `${KEYWORD_LABEL(keyword)}.`)
    .join(' ');
  const traitLines = keywordLine ? [keywordLine] : [];
  return [...describeCardRules(cardId, attacker, target), ...traitLines];
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
