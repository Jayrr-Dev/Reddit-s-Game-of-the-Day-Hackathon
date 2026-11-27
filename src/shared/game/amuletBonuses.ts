// --- SHOP AMULETS ---
// One amulet can be equipped at a time. These bonuses are stronger than a single ring.
export const SHOP_AMULET_BONUSES = {
  'ferryman-token': { draw: 0, reserve: 3 },
  'vesper-locket': { draw: 2, reserve: 0 },
  'last-lantern': { draw: 1, reserve: 2 },
} as const;

export type ShopAmuletId = keyof typeof SHOP_AMULET_BONUSES;

/** Return the effect for a shop amulet only. */
export function shopAmuletBonus(id: string | null | undefined) {
  const isKnown = (key: string): key is ShopAmuletId => Object.hasOwn(SHOP_AMULET_BONUSES, key);
  return id && isKnown(id) ? SHOP_AMULET_BONUSES[id] : undefined;
}

/** Readable effect text for the shelf, inventory and equipment details. */
export function shopAmuletSummary(id: string): string | undefined {
  const bonus = shopAmuletBonus(id);
  if (!bonus) return undefined;
  const effects = [];
  if (bonus.draw) effects.push(`+${bonus.draw} card${bonus.draw === 1 ? '' : 's'}/turn`);
  if (bonus.reserve) effects.push(`+${bonus.reserve} reserve capacity`);
  return effects.join(' · ');
}
