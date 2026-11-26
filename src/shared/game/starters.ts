import { STARTER_DECK, type CardId } from './cards.ts';
import { keepsUniqueLimit } from './unique.ts';

export const starterNames = ['Warrior', 'Mage', 'Hexer', 'Archer'] as const;
export type StarterName = (typeof starterNames)[number];
export const signatures = {
  Warrior: 'backhand',
  Mage: 'arcaneBolt',
  Hexer: 'mourningCurse',
  Archer: 'arrowShot',
} as const;
export const isStarterName = (s: unknown): s is StarterName =>
  starterNames.some((name) => name === s);
export const starterPool = (name: StarterName): CardId[] => [
  ...new Set<CardId>([
    signatures[name],
    'backhand',
    'darkCloak',
    'chainsOfGrief',
    'mourningCurse',
    'healingPotion',
  ]),
];
export function starterDeck(name: StarterName): CardId[] {
  if (name === 'Warrior') return [...STARTER_DECK];
  return [
    signatures[name],
    signatures[name],
    signatures[name],
    signatures[name],
    'backhand',
    name === 'Hexer' ? 'chainsOfGrief' : signatures[name],
    'darkCloak',
    'darkCloak',
    'darkCloak',
    'darkCloak',
    'healingPotion',
  ];
}
export function validStarter(
  name: StarterName,
  cards: unknown
): cards is CardId[] {
  return (
    Array.isArray(cards) &&
    cards.length === STARTER_DECK.length &&
    cards.every((id) => starterPool(name).includes(id)) &&
    cards.filter((id) => id === signatures[name]).length >= 3 &&
    cards.filter((id) => id === 'healingPotion').length <= 1 &&
    keepsUniqueLimit(cards)
  );
}
