// ===================================================================
// CARD CATALOG
// Every card in Villain Arc, as data. Card text on screen is generated
// from these effects (see describe.ts), so the numbers here are the one
// source of truth for both the rules and the UI.
// ===================================================================

import type { CardDef, CardEffect, CardRarity } from './types.ts';

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
const draw = (amount: number): CardEffect => ({ kind: 'draw', amount });
const energy = (amount: number): CardEffect => ({ kind: 'energy', amount });
const heal = (amount: number): CardEffect => ({ kind: 'heal', amount });
const reap = (multiplier: number): CardEffect => ({ kind: 'reap', multiplier });
const pull: CardEffect = { kind: 'pull' };
const push: CardEffect = { kind: 'push' };

/** Optional card traits; both default to false. */
type CardTraits = { fades?: boolean; reach?: boolean };
const FADES: CardTraits = { fades: true };
const REACH: CardTraits = { reach: true };

/** Builds a card definition. */
const card = (
  name: string,
  cost: number,
  rarity: CardRarity,
  effects: CardEffect[],
  { fades = false, reach = false }: CardTraits = {}
): CardDef => ({ name, cost, rarity, effects, fades, reach });

// --- CATALOG ---
export const CARDS = {
  // STARTER DECK
  backhand: card('Backhand', 1, 'starter', [hit(6)]),
  darkCloak: card('Dark Cloak', 1, 'starter', [shroud(5)]),
  mourningCurse: card('Mourning Curse', 1, 'starter', [hit(4), hex(2)], REACH),
  chainsOfGrief: card('Chains of Grief', 1, 'starter', [pull, hit(5)]),

  // COMMON
  cruelSlash: card('Cruel Slash', 1, 'common', [hit(9)]),
  twinDaggers: card('Twin Daggers', 1, 'common', [hit(4, 2)]),
  boneWard: card('Bone Ward', 1, 'common', [shroud(8)]),
  whisperHex: card('Whisper Hex', 0, 'common', [hex(3)]),
  quickJab: card('Quick Jab', 0, 'common', [hit(3), draw(1)]),
  sneer: card('Sneer', 1, 'common', [shroud(5), dread(1)]),
  fortressOfSpite: card('Fortress of Spite', 2, 'common', [shroud(14)]),
  sear: card('Sear', 1, 'common', [hit(5), hex(3)]),
  cleave: card('Cleave', 1, 'common', [hitAll(6)]),
  spiteBolt: card('Spite Bolt', 1, 'common', [hit(6)], REACH),
  hurlAside: card('Hurl Aside', 1, 'common', [hit(5), push]),
  beckon: card('Beckon', 0, 'common', [pull, dread(1)]),

  // UNCOMMON
  reap: card('Reap', 1, 'uncommon', [reap(2)]),
  seethe: card('Seethe', 1, 'uncommon', [wrath(2)], FADES),
  ruin: card('Ruin', 2, 'uncommon', [hit(16)]),
  coldResolve: card('Cold Resolve', 1, 'uncommon', [shroud(6), draw(2)]),
  dreadGaze: card('Dread Gaze', 1, 'uncommon', [dread(2, 'all'), draw(1)]),
  bloodPact: card('Blood Pact', 0, 'uncommon', [energy(2)], FADES),
  stormOfBlades: card('Storm of Blades', 2, 'uncommon', [hit(3, 4)]),
  plague: card('Plague', 2, 'uncommon', [hex(4, 'all')]),
  darkBulwark: card('Dark Bulwark', 2, 'uncommon', [shroud(10), wrath(1)]),
  drain: card('Drain', 1, 'uncommon', [hit(6), heal(3)]),

  // RARE
  cataclysm: card('Cataclysm', 3, 'rare', [hitAll(14)], REACH),
  vengeance: card('Vengeance', 1, 'rare', [wrath(3)], FADES),
  gravePact: card('Grave Pact', 1, 'rare', [heal(8)], FADES),
  doom: card('Doom', 2, 'rare', [hex(9)], FADES),
  undyingHatred: card('Undying Hatred', 2, 'rare', [hit(20)]),
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
