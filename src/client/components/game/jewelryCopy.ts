// ===================================================================
// JEWELRY COPY
// Flavor and one-line effect text for rings and amulets.
// ===================================================================
import { IRON_RING_RESERVE, TRAVELERS_AMULET_DRAW } from '../../../shared/game/character';
import { TRAINING_JEWELRY } from '../../../shared/game/trainingJewelry';

/** Flavor line for every ring and amulet. */
export const itemFlavor: Record<string, string> = {
  ...Object.fromEntries(TRAINING_JEWELRY.map(item => [item.id, item.flavor])),
  'iron-ring': 'The smith left a single hammer mark inside the band.',
  'travelers-amulet': 'The clasp is worn smooth where a traveler rubbed it at every crossroads.',
};

/** Short ledger copy uses the same item values as the detailed effect. */
export const itemBonusSummary = (id: string) => {
  if (id === 'iron-ring') return '+' + IRON_RING_RESERVE + ' reserve energy';
  if (id === 'travelers-amulet') return '+' + TRAVELERS_AMULET_DRAW + ' card per turn';
  return 'Cosmetic';
};

/** Display the same effect icon and ink in the inventory and item details. */
export const itemInk = (id: string) => id === 'travelers-amulet' ? 'draw' : id === 'iron-ring' ? 'energy' : undefined;
