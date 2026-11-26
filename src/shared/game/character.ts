import { buySkill, healingSkillBonusOf, isSkillPick, type SkillPick } from './skills.ts';
import type { CombatState } from './types.ts';
import { PLAYER_MAX_HP, PLAYER_HP_CAP, CARDS_PER_TURN, RESERVE_ENERGY_SLOTS } from './rules.ts';

export const TRAITS = [
  'vigor',
  'strength',
  'dexterity',
  'intelligence',
  'scorn',
  'endurance',
] as const;
export type TraitId = (typeof TRAITS)[number];
/** The name players see for each trait. Ids stay fixed because saves store them. */
export const TRAIT_LABELS: Record<TraitId, string> = {
  vigor: 'Vigor',
  strength: 'Strength',
  dexterity: 'Dexterity',
  intelligence: 'Intelligence',
  scorn: 'Malevolence',
  endurance: 'Endurance',
};
export type Traits = Record<TraitId, number>;
export type TraitPath = 'left' | 'hybrid' | 'right';
type PathRanks = Record<TraitPath, number>;
export type TraitPaths = Partial<Record<TraitId, PathRanks>>;
export const isTraitPath = (path: unknown): path is TraitPath => path === 'left' || path === 'hybrid' || path === 'right';
export const TRAIT_CAP = 64;
export const traitPathCap = (trait: TraitId, path: TraitPath) =>
  (trait === 'vigor' && path === 'left') || (trait === 'endurance' && path === 'right') ? 52 : TRAIT_CAP;
export type TraitNodes = Partial<Record<TraitId, number[]>>;
const nodeIds = Array.from({ length: TRAIT_CAP }, (_, index) => index + 1);
const prefixes = Array.from({ length: TRAIT_CAP + 1 }, (_, count) => nodeIds.slice(0, count));
export const isTraitNode = (id: unknown): id is number => isTraitRank(id) && id > 0;
export const traitNodeIds = (traits: Partial<Traits>, nodes: TraitNodes | undefined, trait: TraitId): readonly number[] =>
  nodes?.[trait] ?? prefixes[traits[trait] ?? 0]!;
export const LEVEL_CAP = 70;
const PREVIOUS_LEVEL_CAP = 100;
const TRAIT_POINTS_PER_LEVEL = 3;
export const RING_SLOT_COUNT = 5;
export const isRingIndex = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < RING_SLOT_COUNT;
export type RingProgress = { bossWins: number; rareSlots: number[] };
export const trainingRingProgress = (): RingProgress => ({ bossWins: RING_SLOT_COUNT, rareSlots: [] });
export const ringSlotUnlocked = (character: CharacterState, index: number): boolean =>
  isRingIndex(index) && character.ringProgress.bossWins > index;
export const IRON_RING_RESERVE = 1;
export const TRAVELERS_AMULET_DRAW = 1;
export const ringSlotAccepts = (character: CharacterState, index: number, itemId: string) =>
  (index === 0 && itemId === 'iron-ring') || ringSlotUnlocked(character, index);
export type EquipmentSlot = 'ring' | 'amulet';
type Item = { id: string; name: string; slot: EquipmentSlot };
export type CharacterState = {
  skillPicks?: SkillPick[];
  level: number;
  xp: number;
  traits: Traits;
  traitNodes?: TraitNodes;
  /** Retained only while replaying historical three-path actions. */
  traitPaths?: TraitPaths;
  highestVigorHp?: number;
  /** Highest Vigor already credited to current HP, including refunded ranks. */
  highestVigor?: number;
  ringProgress: RingProgress;
  inventory: Item[];
  equipment: { rings: (string | null)[]; amulet: string | null };
};

export type Equipment = CharacterState['equipment'];
export const starterEquipment = (): Equipment => ({
  rings: ['iron-ring', ...Array<string | null>(RING_SLOT_COUNT - 1).fill(null)],
  amulet: null,
});
const starterItems: readonly Item[] = [
  { id: 'iron-ring', name: 'Iron Ring', slot: 'ring' },
  { id: 'travelers-amulet', name: "Traveler's Amulet", slot: 'amulet' },
];
export const createCharacter = (ringProgress: RingProgress = {bossWins: 0, rareSlots: []}): CharacterState => ({
  ringProgress,
  level: 1,
  xp: 0,
  traits: {
    vigor: 0,
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    scorn: 0,
    endurance: 0,
  },
  inventory: starterItems.map((item) => ({ ...item })),
  equipment: starterEquipment(),
});
export const isTrait = (id: unknown): id is TraitId =>
  TRAITS.some((trait) => trait === id);
export const traitPointsAvailable = (character: CharacterState) =>
  TRAIT_POINTS_PER_LEVEL * character.level -
  TRAITS.reduce((sum, id) => sum + character.traits[id], 0);

export const isTraitRank = (rank: unknown): rank is number =>
  typeof rank === 'number' && Number.isInteger(rank) && rank >= 0 && rank <= TRAIT_CAP;

function withNodes(character: CharacterState, trait: TraitId, ids: number[]): CharacterState {
  const traitNodes = { ...character.traitNodes };
  if (ids.every((node, i) => node === i + 1)) delete traitNodes[trait];
  else traitNodes[trait] = ids;
  const next: CharacterState = { ...character, traits: { ...character.traits, [trait]: ids.length } };
  if (Object.keys(traitNodes).length) next.traitNodes = traitNodes;
  else delete next.traitNodes;
  if (character.traitPaths?.[trait]) {
    next.traitPaths = { ...character.traitPaths };
    delete next.traitPaths[trait];
    if (!Object.keys(next.traitPaths).length) delete next.traitPaths;
  }
  if (trait === 'vigor') {
    const before = characterBonuses(character.traits, undefined, character.traitNodes).maxHp;
    const after = characterBonuses(next.traits, undefined, next.traitNodes).maxHp;
    next.highestVigor = Math.max(character.highestVigor ?? character.traits.vigor, ids.length);
    next.highestVigorHp = Math.max(character.highestVigorHp ?? characterBonuses({ vigor: character.highestVigor ?? 0 }).maxHp, before, after);
  }
  return next;
}

export type TraitArm = 'left' | 'right' | 'mixed';
type BoardArms = Record<TraitArm, number[]>;
const armNames: readonly TraitArm[] = ['left', 'right', 'mixed'];
// Keep the saved Endurance node IDs stable when tuning their rewards.
const enduranceArms: BoardArms = {
  left: [7, 12, 22, 35, 14, 53, 57, 43, 39, 41, 50, 36, 21, 60, 55, 49, 28, 25, 13, 9, 5],
  right: [62, 4, 31, 52, 15, 24, 3, 8, 58, 45, 51, 38, 23, 29, 34, 18, 30, 42, 2, 16, 48],
  mixed: [63, 10, 61, 56, 26, 27, 44, 59, 11, 6, 47, 33, 17, 54, 37, 19, 40, 46, 20, 32, 64],
};
const enduranceTips = Object.values(enduranceArms).map(arm => arm[arm.length - 1]!);
const boards = new Map<TraitId, BoardArms>();

/** Node IDs in purchase order, from the shared junction to each curl's tip. */
export function traitNodeArms(trait: TraitId): Readonly<Record<TraitArm, readonly number[]>> {

  const cached = boards.get(trait);
  if (cached) return cached;
  const arms = trait === 'endurance'
    ? { left: [...enduranceArms.left], right: [...enduranceArms.right], mixed: [...enduranceArms.mixed] }
    : distributeTraitNodes(trait);
  for (const arm of armNames) {
    arms[arm].sort((a, b) => traitRewardShare(trait, a) - traitRewardShare(trait, b) || a - b);
  }
  boards.set(trait, arms);
  return arms;
}

export function traitRewardShare(trait: TraitId, id: number): number {
  return statCurves[trait].reduce((sum, [, curve]) =>
    sum + (curve[id]! - curve[id - 1]!) / curve[TRAIT_CAP]!, 0);
}

function distributeTraitNodes(trait: TraitId): BoardArms {
  const arms: BoardArms = { left: [], right: [], mixed: [] };
  const families = { left: [] as number[], right: [] as number[] };
  const blank: number[] = [];
  const leftStat = statCurves[trait][0]![0];
  // The shared reward is paid once. Keep the last original reward on the mixed path.
  for (const id of nodeIds.slice(1, -1)) {
    const gain = traitNodeGains(trait, id);
    if (gain[leftStat]) families.left.push(id);
    else if (Object.keys(gain).length) families.right.push(id);
    else blank.push(id);
  }
  blank.forEach((id, index) => arms[armNames[index % 3]!].push(id));
  arms.mixed.push(TRAIT_CAP);
  const armLength = (TRAIT_CAP - 1) / 3;
  const mixedSpaces = armLength - arms.mixed.length;
  const mixedLeft = Math.round(mixedSpaces * families.left.length / (families.left.length + families.right.length));
  const overflow: number[] = [];
  for (const side of ['left', 'right'] as const) {
    const ids = families[side];
    const toMix = side === 'left' ? mixedLeft : mixedSpaces - mixedLeft;
    // Sample throughout the original schedule so all arms include early and late rewards.
    const remaining: number[] = [];
    ids.forEach((id, i) => {
      if (Math.floor((i + 1) * toMix / ids.length) > Math.floor(i * toMix / ids.length)) arms.mixed.push(id);
      else remaining.push(id);
    });
    const spaces = Math.min(remaining.length, armLength - arms[side].length);
    remaining.forEach((id, i) => {
      if (Math.floor((i + 1) * spaces / remaining.length) > Math.floor(i * spaces / remaining.length)) arms[side].push(id);
      else overflow.push(id);
    });
  }
  for (const arm of armNames) {
    arms[arm].push(...overflow.splice(0, armLength - arms[arm].length));
  }
  return arms;
}

/** Preserve each curl's purchased length when importing independently chosen nodes. */
export function normalizeTraitNodeIds(trait: TraitId, ids: readonly number[]): number[] {
  const owned = new Set(ids.filter(isTraitNode));
  if (!owned.size) return [];
  const arms = Object.values(traitNodeArms(trait));
  const counts = arms.map(arm => arm.filter(id => owned.has(id)).length);
  if (!owned.has(1)) {
    const mostInvested = counts.indexOf(Math.max(...counts));
    counts[mostInvested] = counts[mostInvested]! - 1;
  }
  return [1, ...arms.flatMap((arm, i) => arm.slice(0, counts[i]))].sort((a, b) => a - b);
}

type NodeBlocker = { kind: 'prerequisite' | 'dependent'; node: number } | { kind: 'invalid' | 'points' | 'unchanged' };
export function traitNodeBlocker(character: CharacterState, trait: TraitId, node: number, owned: boolean): NodeBlocker | undefined {
  if (!isTrait(trait) || !isTraitNode(node) || typeof owned !== 'boolean') return { kind: 'invalid' };
  const selected = traitNodeIds(character.traits, character.traitNodes, trait);
  if (selected.includes(node) === owned) return { kind: 'unchanged' };
  if (node === 1) {
    const dependent = selected.find(id => id !== 1);
    if (!owned && dependent !== undefined) return { kind: 'dependent', node: dependent };
    return owned && traitPointsAvailable(character) < 1 ? { kind: 'points' } : undefined;
  }
  if (owned && !selected.includes(1)) return { kind: 'prerequisite', node: 1 };
  const arm = Object.values(traitNodeArms(trait)).find(ids => ids.includes(node))!;
  const index = arm.indexOf(node);
  const previous = arm[index - 1];
  const next = arm[index + 1];
  if (owned && previous !== undefined && !selected.includes(previous)) return { kind: 'prerequisite', node: previous };
  if (!owned && next !== undefined && selected.includes(next)) return { kind: 'dependent', node: next };
  if (owned && traitPointsAvailable(character) < 1) return { kind: 'points' };
  return undefined;
}

export const canSetTraitNode = (character: CharacterState, trait: TraitId, node: number, owned: boolean) =>
  !traitNodeBlocker(character, trait, node, owned);

/** Address the node itself so duplicate actions and free refunds are idempotent. */
export function setTraitNode(character: CharacterState, trait: TraitId, node: number, owned: boolean): CharacterState {
  if (!canSetTraitNode(character, trait, node, owned)) return character;
  const selected = traitNodeIds(character.traits, character.traitNodes, trait);
  return withNodes(character, trait, owned ? [...selected, node].sort((a, b) => a - b) : selected.filter(id => id !== node));
}

/** Historical specialist actions rebuild the corresponding original-node selection. */
export function setTraitPathRank(character: CharacterState, trait: TraitId, path: TraitPath, rank: number): CharacterState {
  if (!isTrait(trait) || !isTraitPath(path) || !isTraitRank(rank) || rank > traitPathCap(trait, path)) return character;
  const previous = character.traitPaths?.[trait] ?? { left: 0, hybrid: character.traits[trait], right: 0 };
  const allocation = { ...previous, [path]: rank };
  const count = allocation.left + allocation.hybrid + allocation.right;
  if (rank === previous[path] || count > TRAIT_CAP || count - character.traits[trait] > traitPointsAvailable(character)) return character;
  const next = withNodes(character, trait, normalizeTraitNodeIds(trait, migratePathNodes(trait, allocation)));
  if (allocation.left || allocation.right) next.traitPaths = { ...next.traitPaths, [trait]: allocation };
  return next;
}

export const setTraitRank = (character: CharacterState, trait: TraitId, rank: number): CharacterState =>
  setTraitPathRank(character, trait, 'hybrid', rank);
export const allocateTrait = (character: CharacterState, trait: TraitId): CharacterState =>
  setTraitRank(character, trait, (character.traitPaths?.[trait]?.hybrid ?? character.traits[trait]) + 1);

export const equipItem = (
  character: CharacterState,
  slot: EquipmentSlot,
  id: string | null,
  ringIndex = 0
): CharacterState => {
  const { equipment } = character;
  if (
    id !== null &&
    !character.inventory.some((item) => item.slot === slot && item.id === id)
  )
    return character;
  if (slot === 'amulet') {
    return equipment.amulet === id
      ? character
      : { ...character, equipment: { ...equipment, amulet: id } };
  }
  if (
    slot !== 'ring' ||
    !isRingIndex(ringIndex) ||
    (id !== null && !ringSlotAccepts(character, ringIndex, id)) ||
    equipment.rings[ringIndex] === id
  )
    return character;
  // Each inventory ID is a physical item. Moving it frees its old slot.
  const rings = equipment.rings.map((current, i) =>
    i === ringIndex ? id : current === id ? null : current
  );
  return { ...character, equipment: { ...equipment, rings } };
};

/** Destroys one owned ring or amulet, taking it out of any slot it was worn in. */
export const discardItem = (character: CharacterState, id: string): CharacterState => {
  if (!character.inventory.some((item) => item.id === id)) return character;
  const { rings, amulet } = character.equipment;
  return {
    ...character,
    inventory: character.inventory.filter((item) => item.id !== id),
    equipment: {
      rings: rings.map((current) => (current === id ? null : current)),
      amulet: amulet === id ? null : amulet,
    },
  };
};

const levelXpThreshold = (level: number) => 100 + 5 * (level - 1);
export const xpToNextLevel = (level: number) =>
  level >= LEVEL_CAP ? 0 : levelXpThreshold(level);
export const awardCharacterVictory = (
  character: CharacterState
): CharacterState => {
  if (character.level >= LEVEL_CAP) return character;
  const xp = character.xp + 100;
  const threshold = xpToNextLevel(character.level);
  if (xp < threshold) return { ...character, xp };
  const level = character.level + 1;
  return { ...character, level, xp: level === LEVEL_CAP ? 0 : xp - threshold };
};

/** Preserve the old build proportions with integer quotas and stable trait-order ties. */
export function progressionFromWins(wins: number) {
  let level = 1;
  let xp = Math.max(0, Math.floor(wins)) * 100;
  while (level < LEVEL_CAP && xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level++;
  }
  return { level, xp: level === LEVEL_CAP ? 0 : xp };
}

function fitLegacyBuild(traits: Traits, spent: number): Traits {
  const budget = LEVEL_CAP * TRAIT_POINTS_PER_LEVEL;
  if (spent <= budget) return traits;
  const adjusted = { ...traits };
  const shares = TRAITS.map(id => {
    const numerator = traits[id] * budget;
    adjusted[id] = Math.floor(numerator / spent);
    return { id, remainder: numerator % spent };
  });
  const remaining = budget - TRAITS.reduce((sum, id) => sum + adjusted[id], 0);
  shares.sort((a, b) => b.remainder - a.remainder);
  for (const share of shares.slice(0, remaining)) adjusted[share.id]++;
  return adjusted;
}

export const restoreCharacter = (value: unknown, training = false): CharacterState => {
  const fresh = createCharacter(training ? trainingRingProgress() : undefined);
  if (!value || typeof value !== 'object') return fresh;
  const { level, xp, traits, equipment } = value as CharacterState;
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > PREVIOUS_LEVEL_CAP ||
    !Number.isInteger(xp) ||
    xp < 0 ||
    xp >= (level === PREVIOUS_LEVEL_CAP ? 1 : levelXpThreshold(level)) ||
    !traits ||
    !TRAITS.every(
      (id) =>
        Number.isInteger(traits[id]) &&
        traits[id] >= 0 &&
        traits[id] <= TRAIT_CAP
    )
  )
    return fresh;
  const spent = TRAITS.reduce((sum, id) => sum + traits[id], 0);
  if (spent > level * TRAIT_POINTS_PER_LEVEL) return fresh;
  const restoredLevel = Math.min(level, LEVEL_CAP);
  const restoredTraits = level > LEVEL_CAP ? fitLegacyBuild(traits, spent) : traits;
  const savedItems = (value as Partial<CharacterState>).inventory;
  const inventory = Array.isArray(savedItems)
    ? savedItems.filter(
        (item, index) =>
          item &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          (item.slot === 'ring' || item.slot === 'amulet') &&
          savedItems.findIndex((other) => other?.id === item.id) === index
      )
    : fresh.inventory;
  const savedProgress = (value as Partial<CharacterState>).ringProgress;
  const ringProgress = training || !savedProgress ? fresh.ringProgress : {
    bossWins: Number.isSafeInteger(savedProgress.bossWins) ? Math.max(0, savedProgress.bossWins) : 0,
    rareSlots: Array.isArray(savedProgress.rareSlots) ? [...new Set(savedProgress.rareSlots.filter(n => Number.isInteger(n) && n >= 6 && n <= 10))] : [],
  };
  const { highestVigor, highestVigorHp, traitPaths: savedPaths, traitNodes: savedNodes } = value as Partial<CharacterState>;
  const traitNodes: TraitNodes = {};
  for (const trait of TRAITS) {
    const nodes = savedNodes?.[trait];
    const allocation = savedPaths?.[trait];
    let chosen: number[] | undefined;
    if (Array.isArray(nodes) && nodes.length === traits[trait] && nodes.every(isTraitNode) && new Set(nodes).size === nodes.length)
      chosen = [...nodes].sort((a, b) => a - b);
    else if (allocation && (['left', 'hybrid', 'right'] as const).every(path =>
      isTraitRank(allocation[path]) && allocation[path] <= traitPathCap(trait, path)) &&
      allocation.left + allocation.hybrid + allocation.right === traits[trait])
      chosen = migratePathNodes(trait, allocation);
    const limited = normalizeTraitNodeIds(trait, (chosen ?? prefixes[traits[trait]]!).slice(0, restoredTraits[trait]));
    if (limited.some((id, index) => id !== index + 1)) traitNodes[trait] = limited;
  }
  let character: CharacterState = { ...fresh, level: restoredLevel, xp: restoredLevel === LEVEL_CAP ? 0 : xp,
    traits: restoredTraits, inventory, ringProgress,
    ...(Object.keys(traitNodes).length && { traitNodes }),
    ...(typeof highestVigorHp === 'number' && Number.isInteger(highestVigorHp) && highestVigorHp >= PLAYER_MAX_HP && highestVigorHp <= PLAYER_HP_CAP && { highestVigorHp }),
    ...((isTraitRank(highestVigor) || restoredTraits.vigor < traits.vigor) &&
      { highestVigor: Math.max(isTraitRank(highestVigor) ? highestVigor : 0, traits.vigor) }) };
  if ('skillPicks' in value && Array.isArray(value.skillPicks)) {
    for (const pick of value.skillPicks.slice(0, restoredLevel)) {
      if (isSkillPick(pick)) character = buySkill(character, pick);
    }
  }
  // Rebuild explicit saved loadouts from empty slots, including deliberate unequips.
  if (equipment || !inventory.some(item => item.id === 'iron-ring' && item.slot === 'ring'))
    character.equipment = { rings: Array<string | null>(RING_SLOT_COUNT).fill(null), amulet: null };
  const legacy = equipment as { ring?: string } | undefined;
  const rings = Array.isArray(equipment?.rings)
    ? equipment.rings
    : [legacy?.ring];
  rings.slice(0, RING_SLOT_COUNT).forEach((id, index) => {
    if (typeof id === 'string')
      character = equipItem(character, 'ring', id, index);
  });
  character = equipItem(character, 'amulet', equipment?.amulet ?? null);
  return character;
};

// A stat only advances on its own path nodes. Weight those nodes by the
// original taper, then round cumulative totals so rank 64 hits the exact cap.
function rankCurve(cap: number, eligible: (rank: number) => boolean, length = TRAIT_CAP): number[] {
  const weights = [0];
  let first = 0;
  let last = 0;
  for (let rank = 1; rank <= length; rank++) {
    const phase = rank % 16;
    const milestone = rank === length ? 4 : phase === 0 ? 3 : phase === 4 ? 2 : phase === 8 || phase === 12 ? 1.5 : 1;
    const edge = Math.abs(2 * (rank - 1) / (length - 1) - 1);
    const weight = eligible(rank) ? milestone * (1 + 1.5 * edge ** 3) : 0;
    if (weight) { first ||= rank; last = rank; }
    weights.push(weights[rank - 1]! + weight);
  }
  // Guarantee visible opening and mastery rewards, even on low-count paths.
  return weights.map((weight, rank) =>
    Math.floor((cap - 2) * weight / weights[length]! + 1e-9) +
    Number(rank >= first) + Number(rank >= last));
}

// Rank 16 of each block is always a primary milestone. The secondary
// milestones distribute smaller effects between the intervening ranks.
const vigorShield = (rank: number) => rank % 2 === 0 && rank % 8 !== 0;
const attackFlat = (rank: number) => rank % 4 === 1 || rank % 8 === 7;
const rangedAccuracy = (rank: number) => rank % 4 === 2;
const reserveRank = (rank: number) => [2, 8, 14].includes(rank % 16);
const capacityRank = (rank: number) => [4, 10, 15].includes(rank % 16);
const hpCurve = rankCurve(PLAYER_HP_CAP - PLAYER_MAX_HP, rank => !vigorShield(rank));
const shieldPercentCurve = rankCurve(100, vigorShield);
const attackFlatCurve = rankCurve(30, attackFlat);
const attackPercentCurve = rankCurve(100, rank => !attackFlat(rank));
const rangedPercentCurve = rankCurve(100, rank => !attackFlat(rank) && !rangedAccuracy(rank));
const accuracyCurve = rankCurve(50, rangedAccuracy);
// Redistribute existing guard to the former energy steps on the right and mixed arms.
const guardCurve = rankCurve(30, rank => rank % 16 !== 0 && !reserveRank(rank) && !capacityRank(rank))
  .map((total, id) => total - Number(id >= enduranceArms.left.at(-1)! && id < 16) + Number(id >= 32 && id < 61));
const reserveCurve = rankCurve(11, reserveRank);
const capacityCurve = rankCurve(10, capacityRank);
const afflictionMilestones = [4, 10, 16, 22, 32, 40, 48, 56, 60, 64];
const afflictionCurve = Array.from({ length: TRAIT_CAP + 1 }, (_, rank) =>
  afflictionMilestones.filter(milestone => milestone <= rank).length);
// Every non-stack rank gives at least one percentage point. Distribute the
// six remaining points across those same ranks using the usual taper.
const doubleDamageRanks = [1, 8, 20, 44, 57, 63];
const afflictionDamageCurve = afflictionCurve.map((stacks, rank) =>
  rank - stacks + doubleDamageRanks.filter(node => node <= rank).length);
const healingRewards = new Map<number, number>([
  [14, 5], [41, 1], [50, 1], [36, 1], [21, 2], [28, 7], // Guard arm
  [15, 5], [45, 1], [51, 1], [38, 1], [23, 2], [30, 7], // Energy arm
  [26, 5], [47, 2], [33, 1], [17, 1], [40, 7], // Hybrid arm
]);
const healingCurve = [0];
for (const id of nodeIds) healingCurve.push(healingCurve[id - 1]! + (healingRewards.get(id) ?? 0));
const startingEnergyCurve = Array.from({ length: TRAIT_CAP + 1 }, (_, rank) => enduranceTips.filter(id => id <= rank).length);
const baseStats = {
  maxHp: PLAYER_MAX_HP, shieldPercent: 0, meleePercent: 0, meleeFlat: 0, rangePercent: 0,
  rangeFlat: 0, accuracyPercent: 0, magicPercent: 0, magicFlat: 0, afflictionFlat: 0,
  afflictionDamagePercent: 0, shieldFlat: 0, healingPercent: 0, startingEnergy: 3, retainEnergy: RESERVE_ENERGY_SLOTS,
  cardsPerTurn: CARDS_PER_TURN, maxEnergy: 10,
};
type StatKey = keyof typeof baseStats;
type NodeGain = Partial<Record<StatKey, number>>;
const statCurves: Record<TraitId, [StatKey, number[]][]> = {
  vigor: [['maxHp', hpCurve], ['shieldPercent', shieldPercentCurve]],
  strength: [['meleeFlat', attackFlatCurve], ['meleePercent', attackPercentCurve]],
  dexterity: [['rangeFlat', attackFlatCurve], ['rangePercent', rangedPercentCurve], ['accuracyPercent', accuracyCurve]],
  intelligence: [['magicFlat', attackFlatCurve], ['magicPercent', attackPercentCurve]],
  scorn: [['afflictionFlat', afflictionCurve], ['afflictionDamagePercent', afflictionDamageCurve]],
  endurance: [['shieldFlat', guardCurve], ['startingEnergy', startingEnergyCurve], ['retainEnergy', reserveCurve], ['maxEnergy', capacityCurve], ['healingPercent', healingCurve]],
};

/** One board node grants exactly the marginal bonus of its original hybrid rank. */
export function traitNodeGains(trait: TraitId, node: number): NodeGain {
  const gain: NodeGain = {};
  if (!isTraitNode(node)) return gain;
  for (const [key, curve] of statCurves[trait]) {
    const delta = curve[node]! - curve[node - 1]!;
    if (delta) gain[key] = delta;
  }
  return gain;
}

/** Keep hybrid prefixes, then allocate distinct nodes matching the old preferred stats. */
export function migratePathNodes(trait: TraitId, allocation: PathRanks): number[] {
  const selected = new Set(prefixes[allocation.hybrid]);
  const categories = nodeIds.map(node => {
    const curves = statCurves[trait];
    const group = curves.findIndex(([, curve]) => curve[node]! > curve[node - 1]!);
    return { node, side: group < 0 ? undefined : group === 0 ? 'left' : 'right' };
  });
  for (const side of ['left', 'right'] as const) {
    const preferred = categories.filter(entry => entry.side === side && !selected.has(entry.node));
    for (const { node } of preferred.slice(0, allocation[side])) selected.add(node);
  }
  const count = allocation.left + allocation.hybrid + allocation.right;
  for (const { node } of [...categories.filter(entry => entry.side), ...categories]) {
    if (selected.size >= count) break;
    selected.add(node);
  }
  return [...selected].sort((a, b) => a - b);
}

export function healingAmount(
  base: number,
  owner?: { traits?: Traits; traitNodes?: TraitNodes; skillPicks?: readonly SkillPick[] }
) {
  // MENDER (skill tree) adds its percent on top of the traits' healing.
  const skillPercent = Math.round(healingSkillBonusOf(owner?.skillPicks) * 100);
  const traitPercent = owner?.traits
    ? characterBonuses(owner.traits, undefined, owner.traitNodes).healingPercent
    : 0;
  return Math.floor(base * (100 + traitPercent + skillPercent) / 100);
}

export function characterBonuses(traits: Partial<Traits> = {}, equipment?: Equipment, nodes?: TraitNodes) {
  const stats = { ...baseStats };
  for (const trait of TRAITS) {
    const selected = nodes?.[trait];
    for (const [key, curve] of statCurves[trait]) {
      stats[key] += selected
        ? selected.reduce((total, id) => total + curve[id]! - curve[id - 1]!, 0)
        : curve[traits[trait] ?? 0]!;
    }
  }
  if (equipment?.rings.includes('iron-ring')) stats.retainEnergy += IRON_RING_RESERVE;
  if (equipment?.amulet === 'travelers-amulet') stats.cardsPerTurn += TRAVELERS_AMULET_DRAW;
  return stats;
}

/** Only newly reached Vigor ranks grant HP, so refunds cannot be cycled for healing. */
export const traitHealth = (
  hp: number, maxHp: number, oldTraits: Partial<Traits> | undefined,
  character: CharacterState, creditedVigor = oldTraits?.vigor ?? 0,
  baseHp?: number, oldNodes?: TraitNodes, creditedHpBonus?: number,
) => {
  const oldHp = characterBonuses(oldTraits, undefined, oldNodes).maxHp;
  const base = baseHp ?? maxHp - oldHp + PLAYER_MAX_HP;
  const nextMax = Math.min(PLAYER_HP_CAP, base + characterBonuses(character.traits, undefined, character.traitNodes).maxHp - PLAYER_MAX_HP);
  const credited = Math.min(PLAYER_HP_CAP, base + (creditedHpBonus ?? Math.max(oldHp, characterBonuses({ vigor: creditedVigor }).maxHp)) - PLAYER_MAX_HP);
  return { maxHp: nextMax, hp: hp <= 0 ? 0 : Math.min(nextMax, hp + Math.max(0, nextMax - credited)) };
};

/** Apply live trait and resource limits without refilling energy. */
export const syncCharacterCombat = (
  combat: CombatState, character: CharacterState, creditedVigor = combat.player.traits?.vigor ?? 0, baseHp?: number, creditedHpBonus?: number
): CombatState => {
  const { maxEnergy, retainEnergy } = characterBonuses(character.traits, character.equipment, character.traitNodes);
  const player = { ...combat.player, traits: character.traits, equipment: character.equipment };
  if (character.traitNodes) player.traitNodes = character.traitNodes;
  else delete player.traitNodes;
  return { ...combat, energy: Math.min(combat.energy, maxEnergy), reserve: Math.min(combat.reserve, retainEnergy),
    player: { ...player,
      ...traitHealth(combat.player.hp, combat.player.maxHp, combat.player.traits, character, creditedVigor, baseHp, combat.player.traitNodes, creditedHpBonus) } };
};
