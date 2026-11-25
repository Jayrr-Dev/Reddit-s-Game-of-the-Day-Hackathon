// --- TRAIT NODE NAMES ---
// Names for the trait board's nodes, picked by the stat a node raises.
// Each stat has a few names; a node takes one by its id, so neighbours
// on the board read differently but a node always keeps its name.

/** Names per stat key (see character.ts baseStats). */
const NODE_NAMES: Readonly<Record<string, readonly string[]>> = {
  maxHp: ['Iron Constitution', 'Thick Hide', 'Hearty Blood', 'Unbroken Will'],
  shieldPercent: ['Bulwark Stance', 'Steady Guard', 'Shield Discipline'],
  meleeFlat: ['Heavy Hand', 'Brute Force', 'Crushing Grip'],
  meleePercent: ['Bloodlust', 'Savage Edge', 'Warlord’s Fury'],
  rangeFlat: ['Barbed Tips', 'Drawn Taut', 'Keen Fletching'],
  rangePercent: ['Hawk Eye', 'Deadeye', 'Hunter’s Mark'],
  accuracyPercent: ['True Aim', 'Steady Breath', 'Sure Shot'],
  magicFlat: ['Dark Spark', 'Arcane Ember', 'Hexed Ink'],
  magicPercent: ['Forbidden Lore', 'Eldritch Surge', 'Black Grimoire'],
  afflictionFlat: ['Spite', 'Lingering Malice', 'Cruel Intent'],
  afflictionDamagePercent: ['Festering Wounds', 'Deep Rot', 'Venom in the Veins'],
  shieldFlat: ['Iron Skin', 'Stone Guard', 'Tempered Plate'],
  startingEnergy: ['Second Wind', 'Early Riser', 'Quickened Pulse'],
  retainEnergy: ['Banked Fury', 'Held Breath', 'Patient Rage'],
  maxEnergy: ['Deep Reserves', 'Endless Fire', 'Boundless Stamina'],
  healingPercent: ['Dark Renewal', 'Mending Shadow', 'Black Salve'],
  cardsPerTurn: ['Quick Hands', 'Sleight of Hand', 'Schemer’s Mind'],
};

/** A node's name from its first stat, or a plain fallback. */
export const traitNodeName = (
  id: number,
  statKey: string | undefined
): string => {
  const names = statKey ? NODE_NAMES[statKey] : undefined;
  return names?.length ? names[id % names.length]! : 'Node ' + id;
};
