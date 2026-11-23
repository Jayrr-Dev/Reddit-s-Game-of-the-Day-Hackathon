// ===================================================================
// CARD CATALOG
// Every card in Villain Arc, as data. Card text on screen is generated
// from these effects (see describe.ts), so the numbers here are the one
// source of truth for both the rules and the UI.
// ===================================================================

import type {
  BuffId,
  CardDef,
  CardEffect,
  CardRarity,
  CardType,
} from './types.ts';

// --- EFFECT BUILDERS ---
// Short constructors keep the catalog readable and fully typed.
const hit = (amount: number, hits = 1): CardEffect => ({
  kind: 'damage',
  amount,
  hits,
  target: 'one',
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
const dread = (amount: number, target: 'one' | 'all' = 'one'): CardEffect => ({
  kind: 'dread',
  amount,
  target,
});
const shroud = (amount: number): CardEffect => ({ kind: 'shroud', amount });
const wrath = (amount: number): CardEffect => ({ kind: 'wrath', amount });
const buff = (which: BuffId, amount: number): CardEffect => ({
  kind: 'buff',
  buff: which,
  amount,
});
const draw = (amount: number): CardEffect => ({ kind: 'draw', amount });
const energy = (amount: number): CardEffect => ({ kind: 'energy', amount });
const heal = (amount: number): CardEffect => ({ kind: 'heal', amount });
const reap = (multiplier: number): CardEffect => ({ kind: 'reap', multiplier });
const pull: CardEffect = { kind: 'pull' };
const push: CardEffect = { kind: 'push' };

/** Optional card traits: fading (default no) and Target N (default 1). */
type CardTraits = { fades?: boolean; targets?: number };
const FADES: CardTraits = { fades: true };

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
  { fades = false, targets = 1 }: CardTraits = {}
): CardDef => ({
  name,
  type,
  cost,
  rarity,
  effects,
  fades,
  reach: REACHING_TYPES.has(type),
  targets,
});

// --- CATALOG ---
export const CARDS = {
  // STARTER DECK
  backhand: card('Backhand', 'melee', 1, 'starter', [hit(6)]),
  darkCloak: card('Dark Cloak', 'buff', 1, 'starter', [shroud(5)]),
  mourningCurse: card('Mourning Curse', 'curse', 1, 'starter', [
    hit(4),
    hex(2),
  ]),
  chainsOfGrief: card('Chains of Grief', 'curse', 1, 'starter', [pull, hit(5)]),

  // COMMON
  cruelSlash: card('Cruel Slash', 'melee', 1, 'common', [hit(9)]),
  twinDaggers: card('Twin Daggers', 'melee', 1, 'common', [hit(4, 2)]),
  boneWard: card('Bone Ward', 'buff', 1, 'common', [shroud(8)]),
  whisperHex: card('Whisper Hex', 'curse', 0, 'common', [hex(3)]),
  quickJab: card('Quick Jab', 'melee', 0, 'common', [hit(3), draw(1)]),
  sneer: card('Sneer', 'curse', 1, 'common', [shroud(5), dread(1)]),
  fortressOfSpite: card('Fortress of Spite', 'buff', 2, 'common', [shroud(14)]),
  sear: card('Sear', 'melee', 1, 'common', [hit(5), hex(3)]),
  cleave: card('Cleave', 'melee', 1, 'common', [hitAll(6)]),
  spiteBolt: card('Spite Bolt', 'range', 1, 'common', [hit(6)]),
  hurlAside: card('Hurl Aside', 'melee', 1, 'common', [hit(5), push]),
  beckon: card('Beckon', 'curse', 0, 'common', [pull, dread(1)]),
  hexfire: card('Hexfire', 'magic', 1, 'common', [hit(6), hex(1)]),
  barbedVolley: card('Barbed Volley', 'range', 1, 'common', [hit(2, 3)]),
  flurry: card('Flurry', 'melee', 1, 'common', [hit(3, 3)]),
  spikedGuard: card('Spiked Guard', 'melee', 1, 'common', [hit(5), shroud(5)]),
  blackArrow: card('Black Arrow', 'range', 1, 'common', [hit(7)]),
  retreatingShot: card('Retreating Shot', 'range', 1, 'common', [
    hit(4),
    shroud(4),
  ]),
  wardingBolt: card('Warding Bolt', 'magic', 1, 'common', [hit(4), shroud(4)]),
  // Fight-long buffs. One type each, so they hit harder than Wrath per
  // stack; Piercing and Surge are a bit bigger because fewer cards use them.
  // TARGET N: pick a hero per shot (the same one again is fine)
  scatterShot: card('Scatter Shot', 'range', 1, 'common', [hit(3)], {
    targets: 3,
  }),
  forkedBolt: card('Forked Bolt', 'magic', 1, 'common', [hit(5)], {
    targets: 2,
  }),
  reapingCuts: card('Reaping Cuts', 'melee', 1, 'common', [hit(4)], {
    targets: 2,
  }),
  bloodlust: card('Bloodlust', 'buff', 1, 'common', [buff('might', 2)], FADES),
  darkSurge: card('Dark Surge', 'buff', 1, 'common', [buff('surge', 3)], FADES),
  deadeye: card('Deadeye', 'buff', 1, 'common', [buff('piercing', 3)], FADES),
  ironHide: card(
    'Iron Hide',
    'buff',
    1,
    'common',
    [shroud(4), buff('protection', 2)],
    FADES
  ),

  // UNCOMMON
  reap: card('Reap', 'magic', 1, 'uncommon', [reap(2)]),
  seethe: card('Seethe', 'buff', 1, 'uncommon', [wrath(2)], FADES),
  ruin: card('Ruin', 'melee', 2, 'uncommon', [hit(16)]),
  coldResolve: card('Cold Resolve', 'buff', 1, 'uncommon', [
    shroud(6),
    draw(2),
  ]),
  dreadGaze: card('Dread Gaze', 'curse', 1, 'uncommon', [
    dread(2, 'all'),
    draw(1),
  ]),
  bloodPact: card('Blood Pact', 'buff', 0, 'uncommon', [energy(2)], FADES),
  stormOfBlades: card('Storm of Blades', 'melee', 2, 'uncommon', [hit(3, 4)]),
  plague: card('Plague', 'curse', 2, 'uncommon', [hex(4, 'all')]),
  darkBulwark: card('Dark Bulwark', 'buff', 2, 'uncommon', [
    shroud(10),
    wrath(1),
  ]),
  drain: card('Drain', 'melee', 1, 'uncommon', [hit(6), heal(3)]),
  shadowBarrage: card('Shadow Barrage', 'magic', 2, 'uncommon', [hit(3, 4)]),
  rainOfThorns: card('Rain of Thorns', 'range', 2, 'uncommon', [hitAll(5)]),
  soulLance: card('Soul Lance', 'magic', 2, 'uncommon', [hit(14)]),
  tyrantsStance: card(
    "Tyrant's Stance",
    'buff',
    1,
    'uncommon',
    [buff('might', 2), buff('protection', 2)],
    FADES
  ),

  // RARE
  cataclysm: card('Cataclysm', 'magic', 3, 'rare', [hitAll(14)]),
  vengeance: card('Vengeance', 'buff', 1, 'rare', [wrath(3)], FADES),
  gravePact: card('Grave Pact', 'buff', 1, 'rare', [heal(8)], FADES),
  doom: card('Doom', 'curse', 2, 'rare', [hex(9)], FADES),
  undyingHatred: card('Undying Hatred', 'melee', 2, 'rare', [hit(20)]),
  ascendance: card(
    'Ascendance',
    'buff',
    2,
    'rare',
    [buff('might', 3), buff('surge', 3)],
    FADES
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
export const getCard = (id: CardId): CardDef => CARDS[id];

/** Card ids of one rarity, used to build reward offers. */
export const cardsOfRarity = (rarity: CardRarity): CardId[] =>
  ALL_CARD_IDS.filter((id) => CARDS[id].rarity === rarity);

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
];
