// ===================================================================
// DESCRIPTIONS
// Turns game data into words and numbers for the screen. Card text and
// hero intents are generated from the same effects the engine runs, so
// the UI can never disagree with the rules.
// ===================================================================

import { healingAmount } from './character.ts';
import { preferredRow, targetRuleOf } from './battlefield.ts';
import { bonusUsesOf, volleyHitsOf } from './skills.ts';
import { getCard, hitsPerPlay, isKeywordOn, type CardId } from './cards.ts';
import {
  afflictionAmount,
  scornBonus,
  attackDamage,
  buffedAttackDamage,
  guardAmount,
  reapDamage,
} from './combatant.ts';
import { foldPerHitAfflictions, getHero, type HeroId } from './heroes.ts';
import { cardHasKeyword, foldImbuedDamage, guardApplications, imbuedEffects } from './imbue.ts';
import {
  ELEMENT_ON_HIT,
  BUFF_KEYWORDS,
  ON_OFF_BUFFS,
  OUT_OF_RANGE_HIT_CHANCE,
  ALOFT_EVASION,
  SHARPSHOOTER_ACCURACY_BONUS,
  SHARPSHOOTER_DAMAGE_FACTOR,
  OUT_OF_RANGE_ROW,
  ROW_LABEL,
  EXHAUST_USES,
  SHOCK_BURST_FACTOR,
  SHOCK_HITS,
  STATUS_IS_AFFLICTION,
  TIERED_MAX_TIER,
  MALAISE_TURNS,
  REFLEX_DODGE,
} from './rules.ts';
import { usesOf } from './uses.ts';
import {
  cardHitOn,
  createHeroUnit,
  heroAttackOf,
  plannedHeroMoves,
  scaleByMight,
} from './combat.ts';
import type {
  BuffId,
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

const STACK_TIER_SUMMARY = 'I 25%, II 50%, III 75%, IV 95%.';
const STACK_TIMING = `Recast to rank up and reset to 2 turns. Tier IV expires into **Malaise ${MALAISE_TURNS}**.`;

export const STATUS_INFO: Record<StatusId | 'guard', StatusInfo> = {
  guard: {
    label: 'Guard',
    description: 'Blocks damage until your next turn.',
  },
  hex: {
    label: 'Hex',
    description:
      'Before its turn: **even** adds 1; **odd** deals double, then loses a third. Ending in **3** deals triple and clears.',
  },
  burn: {
    label: 'Burn',
    description:
      'Deals damage after each action, then halves (round down).',
  },
  frost: {
    label: 'Frost',
    description:
      'Reduces damage dealt by this much per hit. Halves after each action.',
  },
  bleed: {
    label: 'Bleed',
    description: `Each successful **Melee** or **Range** attack deals **⅓** of Bleed as bonus damage (round up). Then Bleed drops by **1**.`,
  },
  shock: {
    label: 'Shock',
    description: `The **${ordinal(SHOCK_HITS)}** hit taken in one turn sets it off: **${SHOCK_BURST_FACTOR}×** its stacks as damage, then clears, and sets off every other Shock on its side, one by one. Loses 1 stack after each action.`,
  },
  poison: {
    label: 'Poison',
    description:
      'Deals damage before each action, then loses 1 stack.',
  },
  weaken: {
    label: 'Weaken',
    description: 'Deals **25%** less damage. Loses 1 stack per turn.',
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
      `Reduces hit and affliction damage. Round up. ${STACK_TIER_SUMMARY}\n${STACK_TIMING}`,
  },
  enfeeble: {
    label: 'Enfeeble',
    description:
      `The target deals less attack damage. Round up. ${STACK_TIER_SUMMARY}\n${STACK_TIMING}`,
  },
  hitLimit: { label: 'Hit Limit', description: 'Each attack hits at most once.' },
  malaise: {
    label: 'Malaise',
    description: 'Blocks buffs for **N** turns. Cleanse can remove it.',
  },
  cloak: {
    label: 'Cloak',
    description: 'Untargetable for **N** enemy turns or until attacking. Area effects and existing afflictions still apply.',
  },
  brace: {
    label: 'Brace',
    description:
      "Keeps Guard for an extra turn per stack.",
  },
  reinforce: {
    label: 'Reinforce',
    description: 'Every **Guard** your cards give is this much bigger',
  },
  vex: {
    label: 'Vex',
    description:
      'Adds this many stacks to incoming afflictions. Loses 1 stack per turn.',
  },
  invincible: {
    label: 'Invincible',
    description:
      'The next damage it takes becomes **0**, then it loses 1 stack\nEach stack negates one more hit',
  },
  reflex: {
    label: 'Reflex',
    description: `+${Math.round(REFLEX_DODGE * 100)}% dodge for one enemy turn. Does not stack with itself.`,
  },
  instinct: {
    label: 'Instinct',
    description:
      `Dodges hits and afflictions except Hex. ${STACK_TIER_SUMMARY}\n${STACK_TIMING} Tier IV is **Ultra Instinct**.`,
  },
  bane: {
    label: 'Bane',
    description:
      'Your cards add this many extra stacks of damaging afflictions and Frost.',
  },
  sharpshooter: {
    label: 'Sharpshooter',
    description: `**+${Math.round(SHARPSHOOTER_ACCURACY_BONUS * 100)}%** hit accuracy\nBonus Accuracy subtracts from dodge. Above 100% shot accuracy can crit.\nRange hits deal **${SHARPSHOOTER_BONUS_TEXT}** damage.\nLasts this many turns (-1 at the end of each turn).`,
  },
  berserker: {
    label: 'Berserker',
    description:
      'Every Melee card gains **Rampage**.',
  },
  aloft: {
    label: 'Aloft',
    description: `Out of **Melee** reach until it dives\nEvades **${Math.round(ALOFT_EVASION * 100)}%** of **Range** and **Magic** hits\n**Curses** always land`,
  },
  armor: {
    label: 'Armor',
    description:
      'Reduces each Melee or Range hit taken. Lasts the fight.',
  },
  move: { label: 'Move', description: 'Your next **Charge** or **Back Step** travels up to this many extra rows.' },
  rush: {
    label: 'Rush',
    description:
      'Each stack makes one **Charge** or **Back Step** free this turn.',
  },
};

/** What each boss passive is called and does (always on). */
export const PASSIVE_INFO: Record<PassiveId, StatusInfo> = {
  vigor: {
    label: 'Vigor',
    description: 'Takes **two** moves per turn.',
  },
  longRange: {
    label: 'Longrange',
    description: 'Its shots ignore **Out of Range**',
  },
  anchored: {
    label: 'Anchored',
    description:
      'Immune to Pull and Knockback. Holds its line when you **Charge** or **Back Step**.',
  },
};

// --- CARD TEXT ---

/** Who a card effect lands on: one, all, or a random hero per hit. */
type AimTarget = 'one' | 'all' | 'random';

/**
 * " ALL" after an area effect's name ("Damage ALL 14", "Hex ALL 4").
 * A melee sweep only reaches the front, so it reads "to Frontline" after
 * the number instead (see areaSuffix).
 */
const areaWord = (target: AimTarget, isMelee = false): string =>
  target === 'all' && !isMelee ? ' ALL' : '';

/** " to Frontline" after a melee sweep's number; nothing otherwise. */
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
 * `cardDef` gives the type and reach; `isRampage` doubles Momentum's bonus.
 */
export const describeCardEffect = (
  effect: CardEffect,
  cardDef: CardDef,
  attacker?: Combatant,
  target?: HeroUnit,
  isRampage = false,
  guardRepeats = guardApplications(cardDef, [])
): string => {
  const isMelee = !cardDef.reach;
  switch (effect.kind) {
    case 'damage': {
      // In hand (no target) only the villain's own buffs count; Weaken
      // and the target's own modifiers join once the card is aimed.
      const damageOf = target ? attackDamage : buffedAttackDamage;
      const perHit = attacker
        ? damageOf(effect.amount, attacker, cardDef.type, isRampage, hitsPerPlay(cardDef), cardDef.edge)
        : effect.amount;
      const isAimed = target !== undefined && effect.target === 'one';
      const amount = isAimed ? cardHitOn(target, perHit, cardDef, attacker?.skillPicks) : perHit;
      const hits = volleyHitsOf(effect.hits, cardDef.type, attacker);
      const times = hits > 1 ? ` ×${hits}` : '';
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
      return describeStatusLine(effect, attacker, target);
    case 'malaise':
      return `Malaise ${effect.amount}${areaWord(effect.target)}`;
    case 'cloak':
      return `Cloak ${effect.amount}`;
    case 'enfeeble':
      return `Enfeeble ${tierNumeral((target?.statuses.enfeeble ?? 0) + (effect.times ?? 1) + (attacker ? scornBonus(attacker, 'enfeeble') : 0))}${areaWord(effect.target)}`;
    case 'reap': {
      if (!target) return `Damage ${effect.multiplier}× Hex`;
      const amount = attacker ? reapDamage(target.statuses.hex, effect.multiplier, attacker, cardDef.type) : target.statuses.hex * effect.multiplier;
      return `Damage ${amount}`;
    }
    case 'guard': {
      const amount = attacker
        ? guardAmount(effect.amount, attacker, guardRepeats)
        : effect.amount;
      return `Guard ${amount}`;
    }
    case 'wrath':
      return `Wrath ${effect.amount}`;
    case 'move':
    case 'brace':
    case 'rush':
    case 'armor':
      return `${STATUS_INFO[effect.kind].label} ${effect.amount}`;
    case 'charge':
      return 'Charge';
    case 'backStep':
      return 'Back Step. Gain Reflex.';
    case 'momentum':
      return STATUS_INFO.momentum.label;
    case 'cleanse':
      return CLEANSE_INFO.label;
    case 'dispel':
      return `Dispel ${effect.amount}${areaWord(effect.target)}`;
    case 'disrupt':
      return `Disrupt ${effect.amount}${areaWord(effect.target)}`;
    case 'protect':
      return `Protection ${tierNumeral((attacker?.statuses.protection ?? 0) + 1)}`;
    case 'buff':
      return (
        buffImbueText(effect.buff) ??
        `${STATUS_INFO[effect.buff].label}${buffAmountText(effect, attacker?.statuses.instinct)}${durationSuffix(effect.duration)}`
      );
    case 'draw':
      return `Draw ${effect.amount}`;
    case 'energy':
      return `Energy ${effect.amount}`;
    case 'heal':
      return `Heal ${healingAmount(effect.amount, attacker)}`;
    case 'pull':
      return `${PULL_INFO.label} ${effect.rows}`;
    case 'push':
      return `${KNOCKBACK_INFO.label}${areaWord(effect.target ?? 'one', isMelee)} ${effect.rows}`;
    case 'amplify':
      return amplifyLabel(effect.factor, STATUS_INFO[effect.status].label);
    case 'imbue':
      return imbueTag(effect.gift);
  }
};

/** "Double Shock" for ×2, else "Shock ×N" (Overcharge's line). */
const amplifyLabel = (factor: number, label: string): string =>
  factor === 2 ? `Double ${label}` : `${label} ×${factor}`;

const TIER_NUMERALS = ['', 'I', 'II', 'III', 'IV'] as const;
export const tierNumeral = (tier: number): string => TIER_NUMERALS[Math.min(tier, TIERED_MAX_TIER)] ?? '';

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
      'Hit all units in a single column\nIgnores **Armor**, **Protection** and **Guard**',
  },
  remove: {
    label: 'Remove',
    description: "Once played, it's out for the rest of the fight",
  },
  exhaust: {
    label: 'Use',
    description: `Play it ${EXHAUST_USES} times in the run\nThen it **Exhausts**: gone for good`,
  },
  charge: {
    label: 'Charge',
    description: 'If there’s room, move forward before attacking. Gain **Momentum** for this attack.',
  },
  rampage: {
    label: 'Rampage',
    description: '**Charge** on kill\n**Momentum** gives it double the bonus',
  },
  distance: {
    label: 'Distance',
    description: 'On hit: free **Back Step** if there is room.',
  },
  longRange: {
    label: 'Longrange',
    description: `Ignores **Out of Range**\nNever misses into **${ROW_LABEL.horizon}**`,
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

/**
 * A buff that grants a keyword (BUFF_KEYWORDS) reads as the imbue it
 * is: "Imbue all Melee: Rampage". Null for any other buff.
 */
const buffImbueText = (buff: BuffId): string | null => {
  const grant = BUFF_KEYWORDS.find((entry) => entry.buff === buff);
  if (!grant) return null;
  const typeLabel = grant.type.charAt(0).toUpperCase() + grant.type.slice(1);
  return `Imbue all ${typeLabel}: ${KEYWORD_LABEL(grant.keyword)}`;
};

/** A buff's stacks as card text (" 3"), or nothing for an on/off buff. */
const buffAmountText = (
  effect: Extract<CardEffect, { kind: 'buff' }>,
  instinct = 0
): string => ON_OFF_BUFFS.has(effect.buff) ? '' : effect.buff === 'instinct'
  ? ` ${tierNumeral(instinct + effect.amount)}`
  : ` ${effect.amount}`;

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
/** What Dispel N means, wherever it shows. */
export const DISPEL_INFO: StatusInfo = {
  label: 'Dispel',
  description: 'Dispel N removes **N** distinct random buffs from the target. Guard, passives and afflictions stay.',
};

export const DISRUPT_INFO: StatusInfo = {
  label: 'Disrupt',
  description: 'Disrupt N lowers one random buff or affliction by N stacks or tiers.',
};

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
 * What players call each row (the Frontline is nearest the villain) and what
 * it means. The engine's names (front, back, horizon) never show.
 */
export const ROW_INFO: Record<HeroRow, StatusInfo> = {
  front: {
    label: ROW_LABEL.front,
    description: 'The nearest row\n**Melee** reaches only here',
  },
  back: {
    label: ROW_LABEL.back,
    description: 'The middle row\nArchers and healers keep here',
  },
  horizon: {
    label: ROW_LABEL.horizon,
    description:
      'The farthest row\nNew heroes march in from here\nShots from or into it are **Out of Range**',
  },
};

/** A row's player-facing name (see ROW_LABEL in rules.ts). */
export const rowLabel = (row: HeroRow): string => ROW_INFO[row].label;

/**
 * The line a hero prefers to fight from, e.g. "Midline": its catalog
 * row, fitted to the rows in play (preferredRow).
 */
export const preferredPositionLabel = (heroId: HeroId): string =>
  rowLabel(preferredRow({ heroId }));

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
        { label: 'Charge', description: `Move forward when the ${ROW_LABEL.front} is empty and gain **Momentum**` },
        { label: 'Back Step', description: 'Move back if there is room. Gain **Reflex**.' },
      { label: 'Energy', description: 'Gain this much energy immediately to spend on cards or movement.' },
      IMBUE_INFO,
      CLEANSE_INFO,
      DISPEL_INFO,
      DISRUPT_INFO,
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
const useCountLabel = (cardId: CardId, usesSpent: number, bonusUses = 0): string => {
  const uses = usesOf(cardId, bonusUses) ?? EXHAUST_USES;
  return `${KEYWORD_INFO.exhaust.label} ${Math.min(usesSpent + 1, uses)}/${uses}`;
};

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
    case 'malaise':
      return `Malaise ${effect.amount}`;
    case 'cloak':
      return `Cloak ${effect.amount}`;
    case 'enfeeble':
      return `Enfeeble ${tierNumeral(effect.times ?? 1)}`;
    case 'move':
    case 'brace':
    case 'rush':
    case 'armor':
      return `${STATUS_INFO[effect.kind].label} ${effect.amount}`;
    case 'reap':
      return 'Reap';
    case 'cleanse':
      return 'Cleanse';
    case 'dispel':
      return `Dispel ${effect.amount}`;
    case 'disrupt':
      return `Disrupt ${effect.amount}`;
    case 'protect':
      return 'Protection I';
    case 'draw':
      return `Draw ${effect.amount}`;
    case 'energy':
      return `+${effect.amount} energy`;
    case 'heal':
      return `Heal ${effect.amount}`;
  }
};


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
  attacker?: Combatant,
  target?: HeroUnit
): string => {
  const amount = attacker
    ? afflictionAmount(effect.amount, attacker, effect.kind, target)
    : effect.amount;
  return `${STATUS_INFO[effect.kind].label}${areaWord(effect.target)} ${amount}`;
};

/** True for an effect kind that lays an affliction (Burn, Hex ...). */
const isAfflictionKind = (kind: CardEffect['kind']): boolean =>
  kind in STATUS_IS_AFFLICTION && STATUS_IS_AFFLICTION[kind as StatusId];

/** The line for what a card's element lays on each hit, if anything. */
const elementLines = (cardDef: CardDef, attacker?: Combatant): string[] => {
  const onHit = cardDef.element ? ELEMENT_ON_HIT[cardDef.element] : null;
  if (!onHit) return [];
  const { label } = STATUS_INFO[onHit.status];
  return [`${label} ${onHit.amount + (attacker ? scornBonus(attacker, onHit.status) : 0)} per hit`];
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
  const gifts = imbuedEffects(imbues);
  const { own } = foldImbuedDamage(cardDef.effects, gifts);
  const guardRepeats = guardApplications(cardDef, gifts);
  // An attack's afflictions land on every hit: a multi-hit card says so.
  const isMultiHit = !(attacker && attacker.statuses.hitLimit > 0) && cardDef.effects.some(
    (effect) => effect.kind === 'damage' && effect.hits > 1
  );
  const isRampage = cardHasKeyword(cardId, imbues, 'rampage');
  const lines = own.flatMap((effect) => {
    const line = describeCardEffect(
      attacker && attacker.statuses.hitLimit > 0 && effect.kind === 'damage' ? { ...effect, hits: 1 } : effect,
      cardDef,
      attacker,
      target,
      isRampage,
      guardRepeats
    );
    if (effect.kind === 'disrupt') return [line,
      ...(effect.allAfflictions ? [`Debuffs −${effect.amount}`] : []),
      ...(effect.hitLimitTurns ? [`Max 1 hit for ${effect.hitLimitTurns} ${effect.hitLimitTurns === 1 ? 'turn' : 'turns'}`] : []),
    ];
    return [isMultiHit && isAfflictionKind(effect.kind) ? `${line} per hit` : line];
  });
  if (cardDef.requiredKillsInOneHit) lines.unshift(`Kill ${cardDef.requiredKillsInOneHit} in one blow this fight`);
  if (cardId === 'followUp') lines.push('Free once after Knockback this turn');
  if (cardDef.costReductionPerKill) lines.push(`-${cardDef.costReductionPerKill} cost per kill this turn`);
  const targetLine = cardDef.targets > 1 ? [`Target ${cardDef.targets}`] : [];
  return [...targetLine, ...lines, ...elementLines(cardDef, attacker)];
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
        ? useCountLabel(cardId, usesSpent, bonusUsesOf(cardDef.type, attacker?.skillPicks))
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
  | 'malaise'
  | 'cloak'
  | 'guard'
  | 'buff'
  | 'protect'
  | 'heal'
  | 'cleanse'
  | 'dispel'
  | 'disrupt'
  | 'summon'
  | 'revive'
  | 'soar'
  | 'pullPlayer'
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
  hoverText?: string;
};

/** One intent chip for one effect of a hero's next move. */
const describeHeroEffect = (
  unit: HeroUnit,
  effect: HeroEffect,
  debuffBonus = 0
): Intent => {
  const scaled = (amount: number) => scaleByMight(amount, unit.might);
  const toWhom = (who: 'self' | 'allies') =>
    who === 'allies' ? ' to every hero' : '';
  // ALL on the chip, like a card's "Damage ALL": it lands on every hero.
  const allTag = (who: 'self' | 'allies') => (who === 'allies' ? 'ALL ' : '');
  switch (effect.kind) {
    case 'attack': {
      const { type, perHit } = heroAttackOf(unit, effect, debuffBonus);
      const text = effect.hits > 1 ? `${perHit}×${effect.hits}` : `${perHit}`;
      const hoverText = effect.hits > 1 ? String(perHit * effect.hits) : undefined;
      const detail = hoverText ? `${text}=${hoverText}` : text;
      return {
        kind: ATTACK_INTENT[type],
        text,
        ...(hoverText && { hoverText }),
        label: `${ATTACK_NAME[type]} attack for ${detail}${effect.isHoming ? `\n${HOMING_INFO.label}: ${HOMING_INFO.description}` : ''}`,
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
    case 'malaise':
      return { kind: 'malaise', text: String(effect.amount), label: `Malaise ${effect.amount}\n${STATUS_INFO.malaise.description}` };
    case 'cloak':
      return { kind: 'cloak', text: String(effect.amount), label: `Cloak ${effect.amount}\n${STATUS_INFO.cloak.description}` };
    case 'guard': {
      const amount = scaled(effect.amount);
      return {
        kind: 'guard',
        text: `${allTag(effect.who)}${amount}`,
        label: `Guard ${amount}${toWhom(effect.who)}`,
      };
    }
    case 'wrath':
      return {
        kind: 'buff',
        text: `${allTag(effect.who)}+${effect.amount}`,
        label: `Wrath +${effect.amount}${toWhom(effect.who)}`,
      };
    case 'heal': {
      const amount = scaled(effect.amount);
      return {
        kind: 'heal',
        text: `${allTag(effect.who)}${amount}`,
        label: `Heal ${amount}${toWhom(effect.who)}`,
      };
    }
    case 'protect':
      return {
        kind: 'protect',
        text: effect.who === 'allies' ? 'ALL' : '',
        label: `Protection${toWhom(effect.who)}\n${STATUS_INFO.protection.description.split('\n')[0]}\nLasts until the heroes' next turn`,
      };
    case 'cleanse':
      return {
        kind: 'cleanse',
        text: effect.who === 'allies' ? 'ALL' : '',
        label: `Cleanses 1 affliction from ${effect.who === 'allies' ? 'every hero' : 'itself'}`,
      };
    case 'dispel':
      return { kind: 'dispel', text: String(effect.amount), label: `Dispel ${effect.amount}: removes ${effect.amount === 1 ? 'one random buff' : effect.amount + ' distinct random buffs'} from you.` };
    case 'disrupt':
      return { kind: 'disrupt', text: String(effect.amount), label: `Disrupt ${effect.amount}: lowers one random buff or affliction by ${effect.amount}.` };
    case 'revive':
      return { kind: 'revive', text: '', label: 'Revives every fallen ally' };
    case 'soar':
      return {
        kind: 'soar',
        text: '',
        label: 'Flies up out of reach, then dives next turn',
      };
    case 'pullPlayer':
      return { kind: 'pullPlayer', text: String(effect.lines), label: `Pulls you closer by ${effect.lines} line${effect.lines === 1 ? '' : 's'}` };
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
        label: `Summons ${effect.count} ${getHero(effect.heroId).name}${effect.count > 1 ? 's' : ''}${effect.onceAt ? ' (once per fight)' : ''}`,
      };
    case 'detonate':
      return {
        kind: 'shock',
        text: '',
        label: `Sets off your Shock now: ${SHOCK_BURST_FACTOR}× its stacks`,
      };
  }
};

/**
 * The extra chip for an attack that lays an affliction on every hit
 * (Thunder Talons: Shock 6 ×3). None for other effects.
 */
const perHitIntents = (unit: HeroUnit, effect: HeroEffect): Intent[] => {
  if (effect.kind !== 'attack') return [];
  return (effect.perHit ?? []).map(({ status, amount }) => {
    const scaled =
      status === 'weaken' ? amount : scaleByMight(amount, unit.might);
    const intentKind: IntentKind = status === 'hex' ? 'curse' : status;
    return {
      kind: intentKind,
      text: effect.hits > 1 ? `${scaled}×${effect.hits}` : `${scaled}`,
      label: `${STATUS_INFO[status].label} ${scaled} on every hit`,
    };
  });
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
const describeMove = (
  unit: HeroUnit,
  heroMove: HeroMove,
  debuffBonus = 0
): MoveIntent => ({
  name: heroMove.name,
  isSignature: heroMove.isSignature ?? false,
  intents: foldPerHitAfflictions(heroMove.effects)
    .flatMap((effect) => [
      describeHeroEffect(unit, effect, debuffBonus),
      ...perHitIntents(unit, effect),
    ])
    .map((intent) => ({
      ...intent,
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
  heroes: readonly HeroUnit[],
  /** The villain's DEBILITATE bonus, so chips match the real hits. */
  debuffBonus = 0
): { name: string; moves: MoveIntent[]; intents: Intent[] } => {
  const planned = plannedHeroMoves(unit, heroes).map((p) => p.move);
  const moves =
    planned.length === 0
      ? [ADVANCE_MOVE]
      : planned.map((heroMove) => describeMove(unit, heroMove, debuffBonus));
  return {
    name: moves.map((move) => move.name).join(', then '),
    moves,
    intents: moves.flatMap((move) => move.intents),
  };
};

// --- UNIT MOVE LIST ---
/** Prefix on a boss's second-phase moves in the unit move list. */
const SECOND_PHASE_PREFIX = 'Phase 2 · ';

/**
 * Every move a hero can make, in the order it cycles them, at base
 * strength (no might, no buffs), then its second-phase moves. Built from
 * the same describeMove as the battlefield chips, so the Units tab's
 * info can never disagree with a fight.
 */
export const describeHeroMoveList = (heroId: HeroId): MoveIntent[] => {
  const hero = getHero(heroId);
  const unit: HeroUnit = { ...createHeroUnit(heroId, 0, 1), row: hero.row, col: 0 };
  const firstPhase = hero.moves.map((heroMove) => describeMove(unit, heroMove));
  const secondPhase = (hero.secondPhase?.moves ?? []).map((heroMove) => {
    const move = describeMove({ ...unit, phase: 2 }, heroMove);
    return { ...move, name: SECOND_PHASE_PREFIX + move.name };
  });
  return [...firstPhase, ...secondPhase];
};
