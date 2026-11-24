// ===================================================================
// DESCRIPTIONS
// Turns game data into words and numbers for the screen. Card text and
// hero intents are generated from the same effects the engine runs, so
// the UI can never disagree with the rules.
// ===================================================================

import { targetRuleOf } from './battlefield.ts';
import { getCard, isKeywordOn, type CardId } from './cards.ts';
import {
  afflictionAmount,
  attackDamage,
  buffedAttackDamage,
  guardAmount,
  typeBonus,
} from './combatant.ts';
import { getHero } from './heroes.ts';
import { foldImbuedDamage, imbuedEffects } from './imbue.ts';
import {
  ELEMENT_ON_HIT,
  ON_OFF_BUFFS,
  OUT_OF_RANGE_HIT_CHANCE,
  ALOFT_EVASION,
  SHARPSHOOTER_DAMAGE_FACTOR,
  OUT_OF_RANGE_ROW,
  EXHAUST_USES,
  SHOCK_BURST_FACTOR,
  SHOCK_HITS,
} from './rules.ts';
import { usesOf } from './uses.ts';
import {
  cardHitOn,
  heroAttackOf,
  plannedHeroMoves,
  scaleByMight,
} from './combat.ts';
import type {
  HeroRow,
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
/**
 * A glossary entry. `description` is tiny markup for its tooltip: one
 * bullet per line ("\n"), and **bold** for key words and numbers (a
 * bold glossary word also shows its icon, see Tooltip).
 */
export type StatusInfo = { label: string; description: string };

/** A count as an ordinal word for rules text: 3 -> "3rd", 4 -> "4th". */
const ordinal = (count: number): string => {
  const lastTwo = count % 100;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[
          count % 10
        ] ?? 'th');
  return `${count}${suffix}`;
};

/** Sharpshooter's Range boost as a percentage ("+20%"). */
export const SHARPSHOOTER_BONUS_TEXT = `+${Math.round((SHARPSHOOTER_DAMAGE_FACTOR - 1) * 100)}%`;

export const STATUS_INFO: Record<StatusId | 'guard', StatusInfo> = {
  guard: {
    label: 'Guard',
    description: 'Blocks damage\nGone at the start of your next turn',
  },
  hex: {
    label: 'Hex',
    description:
      'Before its turn, if **odd**: deals this much, then loses a third\nIf it ends in **3**: doubles, then clears\nIf **even**: +1',
  },
  burn: {
    label: 'Burn',
    description:
      'Loses this much HP after each action\nThen halves (rounds down)',
  },
  frost: {
    label: 'Frost',
    description:
      'Each hit it deals is this much weaker\nHalves after each action',
  },
  bleed: {
    label: 'Bleed',
    description:
      'Loses this much HP after each action\nGoes down by **1** each time',
  },
  shock: {
    label: 'Shock',
    description: `The **${ordinal(SHOCK_HITS)}** hit taken in one turn sets it off: **${SHOCK_BURST_FACTOR}×** this much damage, then it clears\nAny hit counts: Melee, Range or Magic`,
  },
  poison: {
    label: 'Poison',
    description: 'Loses this much HP each turn\nThen goes down by **1**',
  },
  weaken: {
    label: 'Weaken',
    description: 'Deals **25%** less damage\nGoes down by **1** each turn',
  },
  wrath: { label: 'Wrath', description: 'Every hit deals this much more' },
  might: {
    label: 'Might',
    description: 'Every **Melee** hit deals this much more',
  },
  surge: {
    label: 'Surge',
    description: 'Every **Magic** hit deals this much more',
  },
  hone: {
    label: 'Hone',
    description: 'Every **Range** hit deals this much more',
  },
  momentum: {
    label: 'Momentum',
    description: 'Your next **Melee** card this turn deals **+50%**',
  },
  protection: {
    label: 'Protection',
    description:
      "Cuts each hit you take: I **25%**, II **50%**, III **75%**\nEach cast this turn raises it a tier\nLasts through the heroes' turn",
  },
  enfeeble: {
    label: 'Enfeeble',
    description:
      'Cuts the damage it deals: I **25%**, II **50%**, III **75%**\nLasts a turn; reapply to deepen it',
  },
  brace: {
    label: 'Brace',
    description:
      "Your **Guard** doesn't expire at the start of your turn\nGoes down by **1** each turn it holds",
  },
  reinforce: {
    label: 'Reinforce',
    description: 'Every **Guard** your cards give is this much bigger',
  },
  vex: {
    label: 'Vex',
    description:
      'Every **affliction** laid on it gets this many more stacks\nGoes down by **1** each turn',
  },
  instinct: {
    label: 'Instinct',
    description:
      "Chance to dodge each hero hit or affliction: 1 **25%**, 2 **50%**, 4 **75%**\n5+ is **Ultra Instinct**: **99%**\n**Hex** can't be dodged\nLasts through the heroes' turn",
  },
  bane: {
    label: 'Bane',
    description:
      'Every **affliction** your cards lay gets this many more stacks\n**Hex**, **Poison**, **Burn**, **Frost**, **Bleed** and **Shock**',
  },
  sharpshooter: {
    label: 'Sharpshooter',
    description: `Your shots ignore **Out of Range**\nEvery **Range** hit deals **${SHARPSHOOTER_BONUS_TEXT}**`,
  },
  aloft: {
    label: 'Aloft',
    description: `Out of **Melee** reach until it dives\nEvades **${Math.round(ALOFT_EVASION * 100)}%** of **Range** and **Magic** hits\n**Curses** always land`,
  },
  armor: {
    label: 'Armor',
    description:
      'Each **Melee** or **Range** hit taken is this much lower\nLasts the whole fight',
  },
  rush: {
    label: 'Rush',
    description:
      'Your next this many **Charges** or **Back Steps** this turn cost **0**\nEach one uses **1**',
  },
};

/** What each boss passive is called and does (always on). */
export const PASSIVE_INFO: Record<PassiveId, StatusInfo> = {
  vigor: {
    label: 'Vigor',
    description: 'Boss passive\nTakes **two** moves every turn',
  },
  longRange: {
    label: 'Longrange',
    description: 'Its shots ignore **Out of Range**',
  },
  anchored: {
    label: 'Anchored',
    description:
      "Never walks on its own\n**Pull** and **Knockback** can't move it",
  },
};

// --- CARD TEXT ---

/** Who a card effect lands on: one, all, or a random hero per hit. */
type AimTarget = 'one' | 'all' | 'random';

/**
 * " ALL" after an area effect's name ("Damage ALL 14", "Hex ALL 4").
 * A melee sweep only reaches the front, so it reads "to Line 1" after
 * the number instead (see areaSuffix).
 */
const areaWord = (target: AimTarget, isMelee = false): string =>
  target === 'all' && !isMelee ? ' ALL' : '';

/** " to Line 1" after a melee sweep's number; nothing otherwise. */
const areaSuffix = (target: AimTarget, isMelee = false): string => {
  if (target === 'random') return ` ${RANDOMLY_INFO.label}`;
  return target === 'all' && isMelee ? ` to ${rowLabel('front')}` : '';
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
      const times = effect.hits > 1 ? ` ×${effect.hits}` : '';
      return `Damage${areaWord(effect.target, isMelee)} ${amount}${times}${areaSuffix(effect.target, isMelee)}`;
    }
    case 'hex':
    case 'poison':
    case 'burn':
    case 'frost':
    case 'bleed':
    case 'shock':
    case 'vex':
    case 'weaken':
      return describeStatusLine(effect, attacker);
    case 'enfeeble':
      return `Enfeeble${timesSuffix(effect.times)}${areaWord(effect.target)}`;
    case 'reap': {
      if (!target) return `Damage ${effect.multiplier}× Hex`;
      const bonus = attacker ? typeBonus(attacker, cardDef.type) : 0;
      return `Damage ${target.statuses.hex * effect.multiplier + bonus}`;
    }
    case 'guard': {
      const amount = attacker
        ? guardAmount(effect.amount, attacker)
        : effect.amount;
      return `Guard ${amount}`;
    }
    case 'wrath':
      return `Wrath ${effect.amount}`;
    case 'brace':
    case 'rush':
    case 'armor':
      return `${STATUS_INFO[effect.kind].label} ${effect.amount}`;
    case 'cleanse':
      return CLEANSE_INFO.label;
    case 'protect':
      return STATUS_INFO.protection.label;
    case 'buff':
      return `${STATUS_INFO[effect.buff].label}${buffAmountText(effect)}${durationSuffix(effect.duration)}`;
    case 'draw':
      return `Draw ${effect.amount}`;
    case 'energy':
      return `Energy ${effect.amount}`;
    case 'heal':
      return `Heal ${effect.amount}`;
    case 'pull':
      return `${PULL_INFO.label} ${effect.rows}`;
    case 'push':
      return `${KNOCKBACK_INFO.label} ${effect.rows}`;
    case 'amplify':
      return amplifyLabel(effect.factor, STATUS_INFO[effect.status].label);
    case 'imbue':
      return describeImbueEffect(effect);
  }
};

/** "Double Shock" for ×2, else "Shock ×N" (Overcharge's line). */
const amplifyLabel = (factor: number, label: string): string =>
  factor === 2 ? `Double ${label}` : `${label} ×${factor}`;

/** " ×N" for an effect cast more than once, else nothing. */
const timesSuffix = (times = 1): string => (times > 1 ? ` ×${times}` : '');

// --- IMBUE TEXT ---
/** Each keyword's name and what it does (its badge's tooltip). */
export const KEYWORD_INFO: Record<CardKeyword, StatusInfo> = {
  hold: {
    label: 'Hold',
    description: 'Stays in your hand at the end of the turn',
  },
  piercing: {
    label: 'Piercing',
    description:
      'Hit all units in a single column\nIgnores **Armor** and **Protection**',
  },
  remove: {
    label: 'Remove',
    description: "Once played, it's out for the rest of the fight",
  },
  exhaust: {
    label: 'Use',
    description: `Play it ${EXHAUST_USES} times in the run\nThen it **Exhausts**: gone for good`,
  },
  rampage: {
    label: 'Rampage',
    description: '**Charge** on kill',
  },
  distance: {
    label: 'Distance',
    description: "On hit: a free **Back Step**\nOnly if there's room",
  },
  longRange: {
    label: 'Longrange',
    description: 'Ignores **Out of Range**\nNever misses into **Line 3**',
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
    description: 'Until the next card is played',
  },
  turn: { label: 'this turn', description: 'Until the end of the turn' },
  battle: {
    label: 'this battle',
    description: 'For the whole fight',
  },
};

/** A buff's stacks as card text (" 3"), or nothing for an on/off buff. */
const buffAmountText = (
  effect: Extract<CardEffect, { kind: 'buff' }>
): string => (ON_OFF_BUFFS.has(effect.buff) ? '' : ` ${effect.amount}`);

/** " this turn" after a timed gift; nothing for a lasting one. */
const durationSuffix = (duration: Duration | undefined): string =>
  duration ? ` ${DURATION_INFO[duration].label}` : '';
/** What Imbue means, wherever it shows. */
export const IMBUE_INFO: StatusInfo = {
  label: 'Imbue',
  description:
    'Gives another card in your hand this keyword or effect\nAn effect lands on every hit that lands\nThen **Remove** this card',
};
/** What Pull N and Knockback N mean, wherever they show. */
export const PULL_INFO: StatusInfo = {
  label: 'Pull',
  description:
    'Pulls the target hero **N lines** nearer\nStops early if the way is blocked',
};
export const KNOCKBACK_INFO: StatusInfo = {
  label: 'Knockback',
  description:
    'Knocks the target hero **N lines** back\nStops early if the way is blocked',
};
/** What Homing means (a hero attack that can't be dodged). */
export const RANDOMLY_INFO: StatusInfo = {
  label: 'Randomly',
  description: 'No aim: each hit lands on a random hero it can reach',
};
export const HOMING_INFO: StatusInfo = {
  label: 'Homing',
  description: "Its hits can't be dodged",
};
/** What Cleanse means, wherever it shows. */
export const CLEANSE_INFO: StatusInfo = {
  label: 'Cleanse',
  description: 'Removes **1** random affliction from you',
};

/**
 * THE GLOSSARY: every word with a meaning of its own (statuses,
 * keywords, Imbue, Cleanse), by the name it is printed with.
 * Card text bolds these and explains them on hover or long press, and
 * badges and chips read the same entries, so a definition lives here
 * only.
 */
/**
 * What players call each row (Line 1 is nearest the villain) and what
 * it means. The engine's names (front, back, horizon) never show.
 */
export const ROW_INFO: Record<HeroRow, StatusInfo> = {
  front: {
    label: 'Line 1',
    description: 'The nearest row\n**Melee** reaches only here',
  },
  back: {
    label: 'Line 2',
    description: 'The middle row\nArchers and healers keep here',
  },
  horizon: {
    label: 'Line 3',
    description:
      'The farthest row\nNew heroes march in from here\nShots from or into it are **Out of Range**',
  },
};

/** A row's player-facing name: "Line 1", "Line 2", "Line 3". */
export const rowLabel = (row: HeroRow): string => ROW_INFO[row].label;

/** Shots from or into the Horizon may miss (see OUT_OF_RANGE_HIT_CHANCE). */
export const OUT_OF_RANGE_INFO: StatusInfo = {
  label: 'Out of Range',
  description: `**Range** and **Magic** shots from or into **${rowLabel(OUT_OF_RANGE_ROW)}**\nLand only **${Math.round(
    OUT_OF_RANGE_HIT_CHANCE * 100
  )}%** of the time\nBoth ways: you and the heroes\n**Longrange** ignores it`,
};

export const GLOSSARY: Readonly<Record<string, StatusInfo>> =
  Object.fromEntries(
    [
      ...Object.values(STATUS_INFO),
      ...Object.values(KEYWORD_INFO),
      IMBUE_INFO,
      CLEANSE_INFO,
      PULL_INFO,
      KNOCKBACK_INFO,
      HOMING_INFO,
      RANDOMLY_INFO,
      ...Object.values(ROW_INFO),
      OUT_OF_RANGE_INFO,
    ].map((info) => [info.label, info])
  );

/** How each keyword reads on a card. */
const KEYWORD_LABEL = (keyword: CardKeyword): string =>
  KEYWORD_INFO[keyword].label;

/**
 * An Exhaust card's count, counting up to its last use: "Use 1/3" on
 * a fresh card, "Use 3/3" on its last.
 */
const useCountLabel = (cardId: CardId, usesSpent: number): string => {
  const uses = usesOf(cardId) ?? EXHAUST_USES;
  return `${KEYWORD_INFO.exhaust.label} ${usesSpent + 1}/${uses}`;
};

/** How many hits a card lands in one play: each damage hit, per pick. */
const hitsPerPlay = (cardDef: CardDef): number =>
  cardDef.targets *
  cardDef.effects.reduce(
    (hits, effect) => hits + (effect.kind === 'damage' ? effect.hits : 0),
    0
  );

/**
 * What an imbue grants, as card text: "Hold" or "Poison 3". An effect
 * imbued on a card that hits more than once lands on every hit, so it
 * says so: "Poison 3 per hit".
 */
export const describeImbueGift = (
  gift: ImbueGift,
  cardDef: CardDef
): string => {
  if (gift.kind === 'keyword') return KEYWORD_LABEL(gift.keyword);
  const gives = describeCardEffect(gift.effect, cardDef);
  return hitsPerPlay(cardDef) > 1 ? `${gives} per hit` : gives;
};

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
    case 'shock':
    case 'vex':
    case 'weaken':
    case 'guard':
    case 'wrath':
      return `${STATUS_INFO[effect.kind].label} ${effect.amount}`;
    case 'buff':
      return `${STATUS_INFO[effect.buff].label}${buffAmountText(effect)}`;
    case 'enfeeble':
      return 'Enfeeble';
    case 'brace':
    case 'rush':
    case 'armor':
      return `${STATUS_INFO[effect.kind].label} ${effect.amount}`;
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

/** An Imbue card's own line: what it grants ("Imbue Hold"). */
const describeImbueEffect = ({ gift }: Imbue): string =>
  `Imbue ${imbueTag(gift)}`;

// --- STATUS LINES ---
/** Card effects that lay a status on heroes. */
type AppliedStatus = Extract<
  CardEffect,
  {
    kind:
      | 'hex'
      | 'poison'
      | 'burn'
      | 'frost'
      | 'shock'
      | 'bleed'
      | 'vex'
      | 'weaken';
  }
>;

/** A status laid on heroes, as its name and number: "Hex 2", "Hex ALL 4". */
const describeStatusLine = (
  effect: AppliedStatus,
  attacker?: Combatant
): string => {
  const amount = attacker
    ? afflictionAmount(effect.amount, attacker, effect.kind)
    : effect.amount;
  return `${STATUS_INFO[effect.kind].label}${areaWord(effect.target)} ${amount}`;
};

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
  target?: HeroUnit,
  imbues: readonly Imbue[] = []
): string[] => {
  const cardDef = getCard(cardId);
  // Imbued damage reads inside the card's own Damage number (8 -> 13).
  const { own } = foldImbuedDamage(cardDef.effects, imbuedEffects(imbues));
  const lines = own.map((effect) =>
    describeCardEffect(effect, cardDef, attacker, target)
  );
  const targetLine = cardDef.targets > 1 ? [`Target ${cardDef.targets}`] : [];
  return [...targetLine, ...lines, ...elementLines(cardDef)];
};

/**
 * All text lines for a card, terse "Name N" lines ("Target 2",
 * "Damage 5", "Hex 1"), then its keywords together on one last line
 * ("Hold", or "Hold, Piercing").
 */
export const describeCard = (
  cardId: CardId,
  attacker?: Combatant,
  target?: HeroUnit,
  usesSpent = 0,
  imbues: readonly Imbue[] = []
): string[] => {
  const cardDef = getCard(cardId);
  const keywordLine = cardDef.keywords
    .filter(isKeywordOn)
    .map((keyword) =>
      keyword === 'exhaust'
        ? useCountLabel(cardId, usesSpent)
        : KEYWORD_LABEL(keyword)
    )
    .join(', ');
  const traitLines = keywordLine ? [keywordLine] : [];
  return [
    ...describeCardRules(cardId, attacker, target, imbues),
    ...traitLines,
  ];
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
  | 'shock'
  | 'bleed'
  | 'weaken'
  | 'guard'
  | 'buff'
  | 'heal'
  | 'cleanse'
  | 'summon'
  | 'revive'
  | 'soar'
  | 'knockBack'
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
        label: `${ATTACK_NAME[type]} attack for ${text}${effect.isHoming ? `\n${HOMING_INFO.label}: ${HOMING_INFO.description}` : ''}`,
      };
    }
    case 'hex': {
      const amount = scaled(effect.amount);
      return { kind: 'curse', text: `${amount}`, label: `Hex ${amount}` };
    }
    case 'poison':
    case 'burn':
    case 'frost':
    case 'bleed':
    case 'shock': {
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
    case 'knockBack':
      return {
        kind: 'knockBack',
        text: `${effect.lines}`,
        label: `Knocks you back ${effect.lines} line${effect.lines > 1 ? 's' : ''}`,
      };
    case 'summon':
      return {
        kind: 'summon',
        text: `${effect.count}`,
        label: `Summons ${effect.count} ${getHero(effect.heroId).name}${effect.count > 1 ? 's' : ''}`,
      };
  }
};

/** The chip for a hero with no move it can make from where it stands. */
const ADVANCE_INTENT: Intent = {
  kind: 'advance',
  text: '',
  label: 'Steps one line nearer',
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
