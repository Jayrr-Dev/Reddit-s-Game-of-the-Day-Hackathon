import type { CardId } from './cards.ts';
import { canImbueOnto } from './imbue.ts';
import { hashSeed, nextInt, pickDistinct, pickOne, pickWeighted, type RngState } from './rng.ts';
import type { CombatState, ImbueGift } from './types.ts';

// --- POWER TEMPLATES ---
export const POWER_RARITIES = ['common', 'uncommon', 'rare', 'legendary'] as const;
export type PowerRarity = typeof POWER_RARITIES[number];
const STATS = {
  magicPercent: ['Magic damage', '%'],
  meleePercent: ['Melee damage', '%'],
  rangePercent: ['Ranged damage', '%'],
  afflictionDamagePercent: ['Affliction damage', '%'],
  accuracyPercent: ['Accuracy', '%'],
  shieldFlat: ['Guard gained', ''],
  healingPercent: ['Healing', '%'],
  startingEnergy: ['Energy per turn', ''],
  cardsPerTurn: ['Draw per turn', ''],
  maxEnergy: ['Energy capacity', ''],
  retainEnergy: ['Energy reserve', ''],
} as const;
export type BorrowedStat = keyof typeof STATS;
export type BorrowedStats = Partial<Record<BorrowedStat, number>>;
type Family = BorrowedStat | 'hpFlat' | 'hpPercent' | 'imbue';
type Benefit = { kind: 'stat'; stat: BorrowedStat; amount: number }
  | { kind: 'hp'; amount: number; percent: boolean }
  | { kind: 'imbue'; count: 3 | 'all'; gift: ImbueGift; label: string; eligible: number };
type Price = { kind: 'blood'; percent: number } | { kind: 'stat'; stat: 'healingPercent' | 'shieldFlat' | 'retainEnergy'; amount: number };
export type BorrowedPower = { rarity: PowerRarity; benefit: Benefit; price?: Price; seed: RngState };

const families: readonly Family[] = [
  'hpFlat', 'hpPercent', 'magicPercent', 'meleePercent', 'rangePercent',
  'afflictionDamagePercent', 'accuracyPercent', 'shieldFlat', 'healingPercent', 'startingEnergy',
  'cardsPerTurn', 'maxEnergy', 'retainEnergy', 'imbue',
];
const combatResources = new Set<Family>(['startingEnergy', 'cardsPerTurn']);

/** The only cards that can receive the gift are playable physical copies still in a pile. */
export function eligiblePowerCopies(combat: CombatState, deck: readonly CardId[], gift: ImbueGift): number[] {
  const copies = combat.copies;
  if (!copies) return [];
  const active = new Set([...copies.hand, ...copies.draw, ...copies.discard]);
  for (const copy of copies.destroyed) active.delete(copy);
  return [...active].sort((a, b) => a - b).filter(index => {
    const card = deck[index];
    return card !== undefined && canImbueOnto(gift, card, copies.gifts[index]);
  });
}

/** Choose a compatible gift. Legendary gifts apply to every eligible copy. */
function imbueBenefit(seed: RngState, tier: number, combat: CombatState, deck: readonly CardId[]): Benefit | undefined {
  const gifts: readonly { gift: ImbueGift; label: string }[] = [
    { gift: { kind: 'effect', effect: { kind: 'guard', amount: tier >= 2 ? 3 : 2 } }, label: 'Guard ' + (tier >= 2 ? 3 : 2) },
    { gift: { kind: 'effect', effect: { kind: 'heal', amount: tier >= 2 ? 2 : 1 } }, label: 'Heal ' + (tier >= 2 ? 2 : 1) },
    { gift: { kind: 'effect', effect: { kind: 'damage', amount: tier >= 2 ? 4 : 2, hits: 1, target: 'one' } }, label: 'Damage +' + (tier >= 2 ? 4 : 2) },
  ];
  const options = gifts.map(entry => ({ ...entry, eligible: eligiblePowerCopies(combat, deck, entry.gift).length }))
    .filter(entry => entry.eligible >= 3 && (tier !== 3 || entry.eligible > 3));
  if (!options.length) return undefined;
  const [entry] = pickOne(seed, options);
  return { kind: 'imbue', count: tier === 3 ? 'all' : 3, ...entry };
}

/** Rarity controls magnitude; energy and draw begin at Uncommon. */
function benefitOf(seed: RngState, family: Family, tier: number, combat: CombatState, deck: readonly CardId[]): Benefit | undefined {
  if (family === 'imbue') return imbueBenefit(seed, tier, combat, deck);
  if (family === 'hpFlat') return { kind: 'hp', amount: [8, 15, 24, 38][tier]!, percent: false };
  if (family === 'hpPercent') return { kind: 'hp', amount: [8, 13, 20, 30][tier]!, percent: true };
  const steps = combatResources.has(family) ? [1, 1, 2, 2]
    : STATS[family][1] === '%' ? [10, 18, 28, 45] : [1, 2, 3, 5];
  return { kind: 'stat', stat: family, amount: steps[tier]! };
}

/** Major gifts sometimes take HP now or weaken a different resource for the run. */
function priceOf(seed: RngState, tier: number, family: Family, combat: CombatState): Price | undefined {
  if (tier < 2 || nextInt(seed, 100)[0] >= (tier === 2 ? 48 : 75)) return undefined;
  const stats = combat.player.borrowedStats;
  const costs: Price[] = [
    { kind: 'blood', percent: tier === 2 ? 20 : 30 },
    ...(['healingPercent', 'shieldFlat', 'retainEnergy'] as const).flatMap(stat =>
      stat !== family && (stats?.[stat] ?? 0) >= 0
        ? [{ kind: 'stat' as const, stat, amount: stat === 'healingPercent' ? (tier === 2 ? 15 : 25) : 1 }]
        : []),
  ];
  return pickOne(hashSeed(seed + ':price'), costs)[0];
}

/** Roll three unique benefit families, backed by one deterministic checkpoint seed. */
export function rollBorrowedPowers(key: string, wave: number, combat: CombatState, deck: readonly CardId[]): BorrowedPower[] {
  let rng = hashSeed(key + ':borrow:' + wave);
  const used = new Set<Family>();
  const late = Math.min(10, Math.floor(wave / 10));
  return Array.from({ length: 3 }, () => {
    const [tier, next] = pickWeighted(rng, [43 - late, 33, 19, 5 + late].map((weight, item) => ({ weight, item })));
    const available = families.flatMap(family => {
      if (used.has(family) || (tier === 0 && combatResources.has(family))) return [];
      const benefit = benefitOf(next, family, tier, combat, deck);
      return benefit ? [{ family, benefit }] : [];
    });
    const [{ family, benefit }, seed] = pickOne(next, available);
    rng = seed;
    used.add(family);
    const price = priceOf(seed, tier, family, combat);
    return { rarity: POWER_RARITIES[tier]!, benefit, seed, ...(price && { price }) };
  });
}

/** Readable descriptions are shared between offers and the active buff list. */
export function borrowedBenefit(power: BorrowedPower): string {
  const effect = power.benefit;
  if (effect.kind === 'hp') return '+' + effect.amount + (effect.percent ? '%' : '') + ' max HP';
  if (effect.kind === 'imbue') return 'Imbue ' + (effect.count === 'all' ? 'all eligible cards' : '3 cards') + ' with ' + effect.label;
  const [label, unit] = STATS[effect.stat];
  return '+' + effect.amount + unit + ' ' + label;
}

/** Names the price before a player commits to a power. */
export function borrowedPrice(power: BorrowedPower): string | undefined {
  const price = power.price;
  if (!price) return undefined;
  if (price.kind === 'blood') return 'Lose ' + price.percent + '% of max HP now (nonlethal)';
  const [label, unit] = STATS[price.stat];
  return '−' + price.amount + unit + ' ' + label + ' for this run';
}

/** Apply the power to copies rather than card IDs, so duplicates can differ. */
export function imbueBorrowedCopies(combat: CombatState, deck: readonly CardId[], power: BorrowedPower): CombatState {
  const effect = power.benefit;
  const copies = combat.copies;
  if (!copies || effect.kind !== 'imbue') return combat;
  const eligible = eligiblePowerCopies(combat, deck, effect.gift);
  const selected = effect.count === 'all' ? eligible : pickDistinct(power.seed, eligible, effect.count)[0];
  if (!selected.length) return combat;
  const gifts = { ...copies.gifts };
  for (const id of selected) gifts[id] = [...(gifts[id] ?? []), { gift: effect.gift }];
  return { ...combat, copies: { ...copies, gifts }, handImbues: copies.hand.map(id => gifts[id] ?? []) };
}
