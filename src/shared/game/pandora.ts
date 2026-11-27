import { isCardId, type CardId } from './cards.ts';
import { LEVEL_CAP } from './character.ts';

// --- PANDORA OUTCOMES ---
export const PANDORA_DUPLICATE_GOLD = { Common: 35, Uncommon: 65, Rare: 110, Epic: 175, Legendary: 275 } as const;
export type PandoraDuplicateRarity = keyof typeof PANDORA_DUPLICATE_GOLD;
export const PANDORA_RUN_EFFECTS = ['lasting-vigor', 'brittle-blood', 'half-life', 'half-life-double-gold'] as const;
export type PandoraRunEffect = (typeof PANDORA_RUN_EFFECTS)[number];
export type PandoraEvent =
  | { kind: 'gold'; change: number; duplicateRarity?: PandoraDuplicateRarity; rewardLevel?: number }
  | { kind: 'card'; cardId: CardId }
  | { kind: 'run'; effect: PandoraRunEffect; runId?: string; claimed?: boolean };

export const PANDORA_MAX_HP_GAIN = 12;
export const PANDORA_MAX_HP_LOSS = 10;
export const PANDORA_CURSE_BOUNTY = 160;
export const PANDORA_GOLD_REWARD = 180;
export const PANDORA_GOLD_LOSS_CAP = 60;
const PANDORA_GOLD_PERCENT_PER_LEVEL = 2;

/** Positive Gold outcomes keep their flat base and earn 2% of it per level above one. */
export function pandoraGoldBreakdown(level: number, duplicateRarity?: PandoraDuplicateRarity) {
  const base = duplicateRarity ? PANDORA_DUPLICATE_GOLD[duplicateRarity] : PANDORA_GOLD_REWARD;
  const percent = (level - 1) * PANDORA_GOLD_PERCENT_PER_LEVEL;
  const bonus = Math.floor(base * percent / 100);
  return { base, percent, bonus, total: base + bonus };
}

export function pandoraGoldReward(level = 1, duplicateRarity?: PandoraDuplicateRarity): Extract<PandoraEvent, { kind: 'gold' }> {
  return {
    kind: 'gold', change: pandoraGoldBreakdown(level, duplicateRarity).total,
    ...(level > 1 && { rewardLevel: level }), ...(duplicateRarity && { duplicateRarity }),
  };
}

export const PANDORA_RUN_COPY = {
  'lasting-vigor': { title: 'Borrowed Vitality', detail: 'Start your next conquest with +12 max HP.' },
  'brittle-blood': { title: 'Withered Blood', detail: 'Start your next conquest with 10 less max HP.' },
  'half-life': { title: 'The Toll of Half-Life', detail: 'Start your next conquest at half HP. Clear your first battle to earn 160 Gold.' },
  'half-life-double-gold': { title: 'The Toll of Half-Life', detail: 'Start your next conquest at half HP. Earn double Gold from every battle you win.' },
} as const satisfies Record<PandoraRunEffect, { title: string; detail: string }>;

/** Parse a trusted run modifier from a stored baseline. */
export const isPandoraRunEffect = (value: unknown): value is PandoraRunEffect =>
  PANDORA_RUN_EFFECTS.some(effect => effect === value);

/** Read an outcome stored alongside the box's receipt. */
export function readPandoraEvent(value: unknown): PandoraEvent {
  if (!value || typeof value !== 'object' || !('kind' in value)) throw new Error('Invalid Pandora event');
  if (value.kind === 'card' && 'cardId' in value && isCardId(value.cardId)) return { kind: 'card', cardId: value.cardId };
  if (value.kind === 'gold' && 'change' in value && typeof value.change === 'number' && Number.isSafeInteger(value.change)) {
    const rarity = 'duplicateRarity' in value ? value.duplicateRarity : undefined;
    const duplicateRarity = (Object.keys(PANDORA_DUPLICATE_GOLD) as PandoraDuplicateRarity[]).find(key => key === rarity);
    if (rarity !== undefined && !duplicateRarity) throw new Error('Invalid Pandora duplicate payout');
    const level = 'rewardLevel' in value ? value.rewardLevel : 1;
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > LEVEL_CAP)
      throw new Error('Invalid Pandora reward level');
    const reward = pandoraGoldReward(level, duplicateRarity);
    if (reward.change === value.change) return reward;
    if (!('rewardLevel' in value) && !duplicateRarity && value.change <= 0 && value.change >= -PANDORA_GOLD_LOSS_CAP)
      return { kind: 'gold', change: value.change };
    throw new Error('Invalid Pandora Gold payout');
  }
  if (value.kind !== 'run' || !('effect' in value) || !isPandoraRunEffect(value.effect))
    throw new Error('Invalid Pandora event');
  const runId = 'runId' in value ? value.runId : undefined;
  const claimed = 'claimed' in value ? value.claimed : undefined;
  if ((runId !== undefined && (typeof runId !== 'string' || !/^[a-f0-9-]{36}$/.test(runId))) ||
    (claimed !== undefined && (claimed !== true || value.effect !== 'half-life' || runId === undefined)))
    throw new Error('Invalid Pandora run event');
  return { kind: 'run', effect: value.effect, ...(runId && { runId }), ...(claimed && { claimed }) };
}

/** Resolves an extra outcome for the box instead of a piece of jewelry. */
export function drawPandoraEvent(roll: number, balanceAfterPrice: number, level = 1): PandoraEvent {
  if (roll < 20) return pandoraGoldReward(level);
  if (roll < 36) return { kind: 'gold', change: -Math.min(PANDORA_GOLD_LOSS_CAP, balanceAfterPrice) };
  if (roll < 61) return { kind: 'run', effect: 'lasting-vigor' };
  if (roll < 81) return { kind: 'run', effect: 'brittle-blood' };
  return { kind: 'run', effect: 'half-life-double-gold' };
}
