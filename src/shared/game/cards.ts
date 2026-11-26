// ===================================================================
// CARD CATALOG
// Every card in Villain Run, as data. Card text on screen is generated
// from these effects (see describe.ts), so the numbers here are the one
// source of truth for both the rules and the UI.
// ===================================================================

import { isLongRangeOn } from './features.ts';
import type {
  BuffId,
  Duration,
  CardDef,
  CardEffect,
  CardKeyword,
  CardRarity,
  CardType,
  ImbuableEffect,
  ImbueGift,
  MagicElement,
  MeleeEdge,
} from './types.ts';

// --- EFFECT BUILDERS ---
// Short constructors keep the catalog readable and fully typed.
const hit = (amount: number, hits = 1): CardEffect => ({
  kind: 'damage',
  amount,
  hits,
  target: 'one',
});
/** Randomly: each of `hits` hits lands on a random hero it can reach. */
const hitRandomly = (amount: number, hits = 1): CardEffect => ({
  kind: 'damage',
  amount,
  hits,
  target: 'random',
});
const hitAll = (amount: number): CardEffect => ({
  kind: 'damage',
  amount,
  hits: 1,
  target: 'all',
});
const hex = (amount: number, target: 'one' | 'all' = 'one'): CardEffect => ({
  kind: 'hex',
  amount,
  target,
});
const burn = (amount: number, target: 'one' | 'all' = 'one'): CardEffect => ({
  kind: 'burn',
  amount,
  target,
});
const poison = (amount: number, target: 'one' | 'all' = 'one'): CardEffect => ({
  kind: 'poison',
  amount,
  target,
});
const bleed = (amount: number): CardEffect => ({
  kind: 'bleed',
  amount,
  target: 'one',
});
const shock = (amount: number, target: 'one' | 'all' = 'one'): CardEffect => ({
  kind: 'shock',
  amount,
  target,
});
/** Multiplies the target's Shock (Overcharge doubles it). */
const amplifyShock = (factor: number): CardEffect => ({
  kind: 'amplify',
  status: 'shock',
  factor,
  target: 'one',
});
const weaken = (amount: number, target: 'one' | 'all' = 'one'): CardEffect => ({
  kind: 'weaken',
  amount,
  target,
});
const guard = (amount: number): CardEffect => ({ kind: 'guard', amount });
const wrath = (amount: number): CardEffect => ({ kind: 'wrath', amount });
/** A buff for the fight, or only for `duration` (this action, this turn). */
const buff = (
  which: BuffId,
  amount: number,
  duration?: Duration
): CardEffect => ({
  kind: 'buff',
  buff: which,
  amount,
  ...(duration ? { duration } : {}),
});
const protect: CardEffect = { kind: 'protect' };
const cleanse: CardEffect = { kind: 'cleanse' };
const draw = (amount: number): CardEffect => ({ kind: 'draw', amount });
const energy = (amount: number): CardEffect => ({ kind: 'energy', amount });
const heal = (amount: number): CardEffect => ({ kind: 'heal', amount });
const reap = (multiplier: number): CardEffect => ({ kind: 'reap', multiplier });
/** Imbues another card in hand with a keyword or an effect, for the battle. */
const imbue = (gift: ImbueGift): CardEffect => ({ kind: 'imbue', gift });
const giftHold: ImbueGift = { kind: 'keyword', keyword: 'hold' };
const giftOf = (effect: ImbuableEffect): ImbueGift => ({
  kind: 'effect',
  effect,
});
/** Pull N: drags the target hero up to N lines nearer. */
const pull = (rows: number): CardEffect => ({ kind: 'pull', rows });
/** Knockback N: shoves the target hero up to N lines back. */
const knockback = (rows: number): CardEffect => ({ kind: 'push', rows });

/**
 * Optional card traits: keywords such as Hold, Piercing and Remove
 * (default none) and Target N (default 1).
 */
type CardTraits = {
  requiredKillsInOneHit?: number;
  costReductionPerKill?: number;
  keywords?: readonly CardKeyword[];
  targets?: number;
  element?: MagicElement;
  /** A Melee card's edge: Sharp or Blunt (cosmetic). */
  edge?: MeleeEdge;
  /** An Exhaust card's own number of uses (default EXHAUST_USES). */
  uses?: number;
  /** Out of the pool (see CardDef.retired). */
  retired?: boolean;
};
const REMOVES: CardTraits = { keywords: ['remove'] };
/** Consumables: a few uses in the run (EXHAUST_USES), then gone. */
const EXHAUSTS: CardTraits = { keywords: ['exhaust'] };
const FIRE: CardTraits = { element: 'fire' };
const ICE: CardTraits = { element: 'ice' };
/** Lightning magic: a yellow bolt on its type ribbon; it lays Shock. */
const LIGHTNING: CardTraits = { element: 'lightning' };
/** Healing magic: a green + on its type ribbon. */
const HEALING: CardTraits = { element: 'healing' };
/** Melee edges (cosmetic): blades slice, fists and hammers thud. */
const SHARP: CardTraits = { edge: 'sharp' };
const BLUNT: CardTraits = { edge: 'blunt' };
const HOLDS: CardTraits = { keywords: ['hold'] };
const PIERCES: CardTraits = { keywords: ['piercing'] };
const RAMPAGES: CardTraits = { keywords: ['rampage'] };
const DISTANCES: CardTraits = { keywords: ['distance'] };
const LONG_RANGES: CardTraits = { keywords: ['longRange'] };

/** Card types that can hit the back row (Melee only hits the front). */
const REACHING_TYPES: ReadonlySet<CardType> = new Set([
  'range',
  'magic',
  'curse',
]);

/** Builds a card definition; its reach comes from its type. */
const card = (
  name: string,
  type: CardType,
  cost: number,
  rarity: CardRarity,
  effects: CardEffect[],
  { keywords = [], targets = 1, element, edge, uses, costReductionPerKill, requiredKillsInOneHit, retired }: CardTraits = {}
): CardDef => ({
  name,
  type,
  cost,
  rarity,
  effects,
  keywords,
  ...(element ? { element } : {}),
  ...(edge ? { edge } : {}),
  ...(requiredKillsInOneHit ? { requiredKillsInOneHit } : {}),
  ...(costReductionPerKill ? { costReductionPerKill } : {}),
  ...(uses ? { uses } : {}),
  ...(retired ? { retired } : {}),
  reach: REACHING_TYPES.has(type),
  targets,
});

// --- CATALOG ---
export const CARDS = {
  // STARTER DECK
  arcaneBolt: card('Arcane Bolt', 'magic', 1, 'basic', [hit(6)]),
  dispel: card('Dispel', 'magic', 1, 'uncommon', [{ kind: 'dispel', amount: 1, target: 'one' }]),
  massDisrupt: card('Mass Disrupt', 'magic', 2, 'rare', [{ kind: 'disrupt', amount: 5, target: 'all', allAfflictions: true, hitLimitTurns: 1 }]),
  arrowShot: card('Arrow Shot', 'range', 1, 'basic', [hit(6)]),
  backhand: card('Bash', 'melee', 1, 'basic', [hit(6)], BLUNT),
  darkCloak: card('Dark Cloak', 'defend', 1, 'basic', [guard(5)]),
  healingPotion: card(
    'Healing Potion',
    'utility',
    0,
    'basic',
    [heal(10)],
    { ...EXHAUSTS, uses: 1 }
  ),
  rushPotion: card(
    'Rush Potion',
    'utility',
    0,
    'common',
    [{ kind: 'rush', amount: 2 }],
    EXHAUSTS
  ),
  // Utility generally grants energy, restores HP, or draws cards. These tonics also Exhaust.
  antidote: card(
    'Antidote',
    'utility',
    0,
    'common',
    [cleanse, heal(4)],
    EXHAUSTS
  ),
  swiftTonic: card(
    'Swift Tonic',
    'utility',
    0,
    'uncommon',
    [energy(2), draw(1)],
    EXHAUSTS
  ),
  // Curses never strike: they lay Hex (an odd Hex burns before the
  // hero's next turn; see hexBurn), so their damage arrives a turn late.
  mourningCurse: card('Mourning Curse', 'curse', 1, 'basic', [hex(3)]),
  chainsOfGrief: card('Chains of Grief', 'curse', 1, 'basic', [
    pull(1),
    hex(2),
  ]),

  // COMMON
  cruelSlash: card(
    'Cruel Slash',
    'melee',
    1,
    'common',
    [hit(9), bleed(3)],
    { ...SHARP, keywords: ['charge'] }
  ),
  twinDaggers: card('Twin Daggers', 'melee', 1, 'common', [hit(4, 2)], SHARP),
  boneWard: card('Bone Ward', 'defend', 1, 'common', [guard(8)]),
  whisperHex: card('Whisper Hex', 'curse', 0, 'common', [hex(3)]),
  vexingWord: card('Vexing Word', 'curse', 1, 'common', [
    hex(1),
    { kind: 'vex', amount: 3, target: 'one' },
  ]),
  quickJab: card('Quick Jab', 'melee', 0, 'common', [hit(3), draw(1)], {
    ...RAMPAGES,
    ...BLUNT,
  }),
  sneer: card('Sneer', 'curse', 1, 'common', [guard(5), weaken(1), hex(1)]),
  fortressOfSpite: card('Fortress of Spite', 'defend', 2, 'common', [
    guard(14),
  ]),
  sear: card('Sear', 'melee', 1, 'common', [hit(5), burn(3)], SHARP),
  cleave: card('Cleave', 'melee', 1, 'common', [hitAll(6)], {
    ...RAMPAGES,
    ...SHARP,
  }),
  spiteBolt: card('Spite Bolt', 'range', 1, 'common', [hit(6)], DISTANCES),
  hurlAside: card('Hurl Aside', 'melee', 1, 'common', [hit(5), knockback(1)], {
    ...RAMPAGES,
    ...BLUNT,
  }),
  beckon: card('Beckon', 'curse', 0, 'common', [pull(1), weaken(1), hex(1)]),
  repulse: card('Repulse', 'magic', 1, 'common', [hit(5), knockback(1)]),
  hexfire: card(
    'Hexfire',
    'magic',
    1,
    'common',
    [hit(6), hex(1), burn(2)],
    FIRE
  ),
  barbedVolley: card('Barbed Volley', 'range', 1, 'common', [
    hit(2, 3),
    bleed(2),
  ]),
  flurry: card('Flurry', 'melee', 1, 'common', [hit(3, 3)], SHARP),
  spikedGuard: card(
    'Spiked Guard',
    'melee',
    1,
    'common',
    [hit(5), guard(5), knockback(1)],
    BLUNT
  ),
  blackArrow: card(
    'Black Arrow',
    'range',
    1,
    'common',
    [hit(7), poison(3)],
    PIERCES
  ),
  retreatingShot: card(
    'Retreating Shot',
    'range',
    1,
    'common',
    [hit(4), guard(4)],
    DISTANCES
  ),
  wardingBolt: card(
    'Warding Bolt',
    'magic',
    1,
    'common',
    [hit(4), shock(2), guard(4)],
    LIGHTNING
  ),
  // RANDOMLY: no aim, every hit picks its own hero
  chaosBolt: card(
    'Chaos Bolt',
    'magic',
    1,
    'common',
    [hitRandomly(7), burn(2)],
    FIRE
  ),
  wildVolley: card('Wild Volley', 'range', 1, 'common', [hitRandomly(3, 4)]),
  // LIGHTNING: Shock only (no damage), and Overcharge to double it
  staticCharge: card(
    'Static Charge',
    'magic',
    1,
    'common',
    [shock(5)],
    LIGHTNING
  ),
  stormFront: card(
    'Storm Front',
    'magic',
    2,
    'uncommon',
    [shock(4, 'all')],
    LIGHTNING
  ),
  overcharge: card(
    'Overcharge',
    'magic',
    1,
    'uncommon',
    [amplifyShock(2)],
    LIGHTNING
  ),
  // IMBUE: grant another card in hand a keyword or an effect
  holdFast: card('Hold Fast', 'imbue', 0, 'common', [imbue(giftHold)]),
  barbedTip: card('Barbed Tip', 'imbue', 0, 'common', [
    imbue({ kind: 'keyword', keyword: 'piercing' }),
  ]),
  emberRune: card('Ember Rune', 'imbue', 0, 'common', [
    imbue(giftOf({ kind: 'burn', amount: 4, target: 'one' })),
  ]),
  keenEdge: card('Keen Edge', 'imbue', 0, 'common', [
    imbue(giftOf({ kind: 'damage', amount: 5, hits: 1, target: 'one' })),
  ]),
  // BLEED with no blow: opens wounds that every later hit tears at.
  hemorrhage: card('Hemorrhage', 'curse', 1, 'uncommon', [bleed(5), hex(1)]),
  // Ids venomCoat/venomDart stay for old saves; both lay Poison (Venom is its own status).
  venomCoat: card('Poison Coat', 'imbue', 1, 'common', [
    imbue(giftOf({ kind: 'poison', amount: 3, target: 'one' })),
  ]),
  // AFFLICTIONS: one card each for Poison, Frost, Shock and Enfeeble
  sapStrength: card('Sap Strength', 'curse', 1, 'common', [
    { kind: 'enfeeble', target: 'one' },
    hex(1),
  ]),
  sap: card('Sap', 'curse', 2, 'uncommon', [
    { kind: 'enfeeble', target: 'one', times: 3 },
    hex(1),
  ]),
  venomDart: card('Poison Dart', 'range', 1, 'common', [hit(3), poison(4)]),
  frostBolt: card('Frost Bolt', 'magic', 1, 'common', [hit(3, 2)], ICE),
  // HEALING SPELLS: reusable Magic heals (unlike the Exhaust potions)
  mend: card('Mend', 'magic', 1, 'common', [heal(7)], HEALING),
  siphonBolt: card(
    'Siphon Bolt',
    'magic',
    1,
    'uncommon',
    [hit(5), heal(4)],
    HEALING
  ),
  darkRenewal: card(
    'Dark Renewal',
    'magic',
    2,
    'rare',
    [heal(14), cleanse],
    HEALING
  ),
  serratedSlash: card(
    'Serrated Slash',
    'melee',
    1,
    'common',
    [hit(4), shock(4)],
    SHARP
  ),
  // Fight-long buffs. One type each, so they hit harder than Wrath per
  // stack; Hone and Surge are a bit bigger because fewer cards use them.
  // TARGET N: pick a hero per shot (the same one again is fine)
  scatterShot: card('Scatter Shot', 'range', 1, 'common', [hit(3)], {
    targets: 3,
  }),
  forkedBolt: card('Forked Bolt', 'magic', 1, 'common', [hit(4), shock(2)], {
    ...LIGHTNING,
    targets: 2,
  }),
  reapingCuts: card('Reaping Cuts', 'melee', 1, 'common', [hit(4), bleed(2)], {
    targets: 2,
    ...SHARP,
  }),
  bloodlust: card(
    'Bloodlust',
    'buff',
    1,
    'common',
    [buff('might', 2)],
    REMOVES
  ),
  darkSurge: card(
    'Dark Surge',
    'buff',
    1,
    'common',
    [buff('surge', 3)],
    REMOVES
  ),
  deadeye: card('Deadeye', 'buff', 1, 'common', [buff('hone', 3)], REMOVES),
  adrenaline: card('Adrenaline', 'movement', 0, 'common', [
    { kind: 'rush', amount: 2 },
  ]),
  jump: card('Jump', 'movement', 1, 'common', [{ kind: 'momentum' }]),
  followUp: card('Follow Up', 'movement', 1, 'common', [{ kind: 'move', amount: 2 }]),
  chargeForward: card('Charge Forward', 'movement', 1, 'common', [{ kind: 'charge' }]),
  retreat: card('Retreat', 'movement', 1, 'common', [{ kind: 'backStep' }]),
  evasiveStep: card('Evasive Step', 'movement', 1, 'common', [
    { kind: 'rush', amount: 1 },
    guard(5),
  ]),
  quickFootwork: card('Quick Footwork', 'movement', 1, 'uncommon', [
    { kind: 'rush', amount: 2 },
    draw(1),
  ]),
  instinct: card(
    'Instinct',
    'buff',
    1,
    'uncommon',
    [buff('instinct', 1)],
    REMOVES
  ),
  bane: card('Bane', 'buff', 1, 'uncommon', [buff('bane', 3)], REMOVES),
  plateArmor: card(
    'Plate Armor',
    'buff',
    1,
    'uncommon',
    [{ kind: 'armor', amount: 2 }],
    REMOVES
  ),
  // Move a hero two lines while cursing it.
  forcePull: card('Force Pull', 'curse', 1, 'uncommon', [pull(2), hex(2)]),
  forcePush: card('Force Push', 'curse', 1, 'uncommon', [knockback(2), hex(2)]),
  sharpshooter: card(
    'Sharpshooter',
    'buff',
    1,
    'uncommon',
    [buff('sharpshooter', 3)],
    REMOVES
  ),
  // TIMED BUFFS: cheaper or bigger, but they wear off
  steadyAim: card('Steady Aim', 'buff', 0, 'common', [
    buff('hone', 4, 'action'),
  ]),
  battleFury: card('Battle Fury', 'buff', 1, 'common', [
    buff('might', 3, 'turn'),
  ]),
  bulwark: card('Bulwark', 'buff', 1, 'common', [protect]),
  standFirm: card('Stand Firm', 'defend', 1, 'common', [
    guard(5),
    { kind: 'brace', amount: 1 },
  ]),
  ironRune: card('Iron Rune', 'imbue', 0, 'common', [
    imbue(giftOf({ kind: 'brace', amount: 1 })),
  ]),
  purge: card('Purge', 'buff', 0, 'common', [cleanse]),
  ironHide: card(
    'Iron Hide',
    'defend',
    1,
    'common',
    [guard(4), buff('reinforce', 2)],
    REMOVES
  ),

  // UNCOMMON
  wardRune: card('Ward Rune', 'imbue', 1, 'uncommon', [
    imbue(giftOf({ kind: 'guard', amount: 4 })),
  ]),
  purifyingRune: card('Purifying Rune', 'imbue', 1, 'uncommon', [
    imbue(giftOf({ kind: 'cleanse' })),
  ]),
  lastRites: card('Last Rites', 'imbue', 0, 'uncommon', [
    imbue({ kind: 'keyword', keyword: 'remove' }),
    draw(1),
  ]),
  redMist: card('Red Mist', 'imbue', 0, 'uncommon', [
    imbue({ kind: 'keyword', keyword: 'rampage' }),
  ]),
  vanish: card('Vanish', 'imbue', 0, 'uncommon', [
    imbue({ kind: 'keyword', keyword: 'distance' }),
  ]),
  eagleEye: card('Eagle Eye', 'imbue', 0, 'uncommon', [
    imbue({ kind: 'keyword', keyword: 'longRange' }),
  ]),
  reap: card('Reap', 'magic', 1, 'uncommon', [reap(2)]),
  seethe: card('Seethe', 'buff', 1, 'uncommon', [wrath(2)], REMOVES),
  impale: card('Impale', 'melee', 2, 'uncommon', [hit(10), bleed(4)], {
    ...PIERCES,
    ...SHARP,
  }),
  ruin: card('Ruin', 'melee', 2, 'uncommon', [hit(16), knockback(2)], {
    ...HOLDS,
    ...BLUNT,
  }),
  coldResolve: card('Cold Resolve', 'defend', 1, 'uncommon', [
    guard(6),
    draw(2),
  ]),
  weakeningGaze: card('Weakening Gaze', 'curse', 1, 'uncommon', [
    weaken(2, 'all'),
    hex(1, 'all'),
    draw(1),
  ]),
  bloodPact: card('Blood Pact', 'buff', 0, 'uncommon', [energy(2)], REMOVES),
  stormOfBlades: card(
    'Storm of Blades',
    'melee',
    2,
    'uncommon',
    [hit(3, 4)],
    SHARP
  ),
  plague: card('Plague', 'curse', 2, 'uncommon', [hex(4, 'all')]),
  darkBulwark: card('Dark Bulwark', 'defend', 2, 'uncommon', [
    guard(10),
    wrath(1),
  ]),
  drain: card('Drain', 'melee', 1, 'uncommon', [hit(6), heal(3)], SHARP),
  shadowBarrage: card('Shadow Barrage', 'magic', 2, 'uncommon', [hit(3, 4)]),
  rainOfThorns: card(
    'Rain of Thorns',
    'range',
    2,
    'uncommon',
    [hitAll(5), poison(2, 'all')],
    LONG_RANGES
  ),
  soulLance: card('Soul Lance', 'magic', 2, 'uncommon', [hit(14)], {
    keywords: ['hold', 'longRange'],
  }),
  tyrantsStance: card(
    "Tyrant's Stance",
    'buff',
    1,
    'uncommon',
    [buff('might', 2), buff('reinforce', 2)],
    REMOVES
  ),

  // RARE
  // Retired by Sam (2026-11-26): out of the pool.
  killingSpree: card('Killing Spree', 'utility', 1, 'rare', [draw(3), energy(3)], {
    requiredKillsInOneHit: 3,
    retired: true,
  }),
  siegeBlast: card('Siege Blast', 'melee', 2, 'rare', [hitAll(12), { kind: 'push', rows: 2, target: 'all' }], {

    ...BLUNT,
    ...RAMPAGES,
  }),
  cataclysm: card(
    'Cataclysm',
    'magic',
    3,
    'rare',
    [hitAll(14), burn(3, 'all')],
    {
      ...HOLDS,
      ...FIRE,
    }
  ),
  vengeance: card('Vengeance', 'buff', 1, 'rare', [wrath(3)], REMOVES),
  gravePact: card('Grave Pact', 'buff', 1, 'rare', [heal(8)], REMOVES),
  // LEGENDARY: the rarest offers (see RARITY_ODDS)
  decimate: card('Decimate', 'melee', 3, 'legendary', [hit(50)], {
    ...BLUNT,
    ...RAMPAGES,
    costReductionPerKill: 1,
  }),
  doom: card('Doom', 'curse', 3, 'legendary', [hex(33)], REMOVES),
  berserker: card(
    'Berserker',
    'buff',
    2,
    'legendary',
    [buff('berserker', 1)],
    REMOVES
  ),
  undyingHatred: card('Undying Hatred', 'melee', 2, 'rare', [hit(20)], {
    ...RAMPAGES,
    ...BLUNT,
  }),
  ascendance: card(
    'Ascendance',
    'buff',
    2,
    'rare',
    [buff('might', 3), buff('surge', 3)],
    REMOVES
  ),
} as const satisfies Record<string, CardDef>;

// --- DERIVED DATA ---
export type CardId = keyof typeof CARDS;

/** Every card id, in catalog order. */
export const ALL_CARD_IDS = Object.keys(CARDS).filter(isCardId);

/** True when `value` names a card in the catalog (used to validate input). */
export function isCardId(value: unknown): value is CardId {
  return typeof value === 'string' && Object.hasOwn(CARDS, value);
}

/** Looks up a card definition. */
/** How many hits a card lands in one play: each damage hit, per pick. */
export const hitsPerPlay = (cardDef: CardDef): number =>
  cardDef.targets *
  cardDef.effects.reduce(
    (hits, effect) => hits + (effect.kind === 'damage' ? effect.hits : 0),
    0
  );

export const getCard = (id: CardId): CardDef => CARDS[id];

/** Energy required before resolving the card, using kills this turn. */
export const cardCost = (id: CardId, killsThisTurn: number, followUpReady = false): number => {
  if (id === 'followUp' && followUpReady) return 0;
  const card = getCard(id);
  return Math.max(0, card.cost - killsThisTurn * (card.costReductionPerKill ?? 0));
};

/**
 * True while a keyword is in play: Longrange only with the three-row
 * flag on (see features.ts). An off keyword is neither printed nor
 * applied.
 */
export const isKeywordOn = (keyword: CardKeyword): boolean =>
  keyword !== 'longRange' || isLongRangeOn();

/** True when the card is printed with `keyword` (and it is in play). */
export const hasKeyword = (id: CardId, keyword: CardKeyword): boolean =>
  CARDS[id].keywords.includes(keyword) && isKeywordOn(keyword);

/**
 * True when a card can be offered: a retired card cannot, nor can an
 * Imbue card that grants a keyword not in play (Eagle Eye with the
 * three-row flag off).
 */
export const isCardInPlay = (id: CardId): boolean =>
  !getCard(id).retired &&
  CARDS[id].effects.every(
    (effect) =>
      effect.kind !== 'imbue' ||
      effect.gift.kind !== 'keyword' ||
      isKeywordOn(effect.gift.keyword)
  );

/** Card ids of one rarity that are in play, used to build reward offers. */
export const cardsOfRarity = (rarity: CardRarity): CardId[] =>
  ALL_CARD_IDS.filter((id) => CARDS[id].rarity === rarity && isCardInPlay(id));

/** The deck every villain starts the day with. */
export const STARTER_DECK: readonly CardId[] = [
  'backhand',
  'backhand',
  'backhand',
  'backhand',
  'chainsOfGrief',
  'darkCloak',
  'darkCloak',
  'darkCloak',
  'darkCloak',
  'mourningCurse',
  'healingPotion',
];
