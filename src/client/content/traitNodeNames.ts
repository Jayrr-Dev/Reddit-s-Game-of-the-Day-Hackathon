// --- TRAIT NODE NAMES ---
// Names for the trait board's nodes, picked by the stat a node raises
// and how big the gain is (each stat's names run weakest to grandest).

/** Names per stat key (see character.ts baseStats). */
const NODE_NAMES: Readonly<Record<string, readonly string[]>> = {
  maxHp: ['Thick Hide', 'Hearty Blood', 'Iron Constitution', 'Unbroken Will'],
  shieldPercent: ['Bulwark Stance', 'Steady Guard', 'Shield Discipline'],
  meleeFlat: ['Heavy Hand', 'Brute Force', 'Crushing Grip'],
  meleePercent: ['Savage Edge', 'Bloodlust', 'Warlord’s Fury'],
  rangeFlat: ['Barbed Tips', 'Drawn Taut', 'Keen Fletching'],
  rangePercent: ['Hawk Eye', 'Hunter’s Mark', 'Deadeye'],
  accuracyPercent: ['True Aim', 'Steady Breath', 'Sure Shot'],
  magicFlat: ['Dark Spark', 'Arcane Ember', 'Hexed Ink'],
  magicPercent: ['Forbidden Lore', 'Eldritch Surge', 'Black Grimoire'],
  afflictionFlat: ['Spite', 'Lingering Malice', 'Cruel Intent'],
  afflictionDamagePercent: ['Festering Wounds', 'Deep Rot', 'Venom in the Veins'],
  shieldFlat: ['Iron Skin', 'Stone Guard', 'Tempered Plate'],
  startingEnergy: ['Early Riser', 'Second Wind', 'Quickened Pulse'],
  retainEnergy: ['Banked Fury', 'Held Breath', 'Patient Rage'],
  maxEnergy: ['Deep Reserves', 'Endless Fire', 'Boundless Stamina'],
  healingPercent: ['Dark Renewal', 'Mending Shadow', 'Black Salve'],
  cardsPerTurn: ['Quick Hands', 'Sleight of Hand', 'Schemer’s Mind'],
};

/** One node as the namer sees it: its id and its first stat gain. */
type NamedNode = {
  id: number;
  changes: readonly { key: string; delta: number }[];
};

/**
 * NAMES BY SIZE: each node's name comes from its first stat, and how
 * big its gain is among the other nodes with that stat. The names are
 * listed weakest to grandest, so the biggest gains get the last one.
 */
export const nameTraitNodes = (
  nodes: readonly NamedNode[]
): ReadonlyMap<number, string> => {
  const deltasOf = new Map<string, number[]>();
  nodes.forEach(({ changes: [gain] }) => {
    if (gain) deltasOf.set(gain.key, [...(deltasOf.get(gain.key) ?? []), gain.delta]);
  });
  return new Map(
    nodes.map(({ id, changes: [gain] }) => {
      const names = gain ? NODE_NAMES[gain.key] : undefined;
      if (!gain || !names?.length) return [id, 'Node ' + id];
      const sizes = [...new Set(deltasOf.get(gain.key))].sort((a, b) => a - b);
      // Where this gain sits among the stat's gain sizes, 0 (smallest) to 1.
      const rank = sizes.length > 1 ? sizes.indexOf(gain.delta) / (sizes.length - 1) : 0;
      return [id, names[Math.round(rank * (names.length - 1))]!];
    })
  );
};
