import { shopAmuletBonus } from './amuletBonuses.ts';
import { buySkill, healingSkillBonusOf, isSkillPick, type SkillPick } from './skills.ts';
import type { CombatState } from './types.ts';
import { PLAYER_MAX_HP, PLAYER_HP_CAP, LEGACY_PLAYER_HP_CAP, CARDS_PER_TURN, RESERVE_ENERGY_SLOTS } from './rules.ts';

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
export const LEVEL_CAP = 100;
const LEGACY_RUN_LEVEL_CAP = 70;
const LEGACY_TRAIT_POINTS_PER_LEVEL = 3;
const TRAIT_POINTS_PER_LEVEL = 2;
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
  /** Retained only by runs started before the progression update. */
  legacyProgression?: true;
  scaledExperience?: true;
  level: number;
  xp: number;
  traits: Traits;
  traitNodes?: TraitNodes;
  /** Trait nodes locked in by Save traits; only a respec can refund them. */
  savedTraitNodes?: TraitNodes;
  /** Retained only while replaying historical three-path actions. */
  traitPaths?: TraitPaths;
  highestVigorHp?: number;
  legacyVigor?: true;
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
  (character.legacyProgression ? LEGACY_TRAIT_POINTS_PER_LEVEL : TRAIT_POINTS_PER_LEVEL) * character.level -
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
    const before = characterBonuses(character.traits, undefined, character.traitNodes, character.legacyVigor).maxHp;
    const after = characterBonuses(next.traits, undefined, next.traitNodes, character.legacyVigor).maxHp;
    next.highestVigor = Math.max(character.highestVigor ?? character.traits.vigor, ids.length);
    next.highestVigorHp = Math.max(character.highestVigorHp ?? characterBonuses({ vigor: character.highestVigor ?? 0 }, undefined, undefined, character.legacyVigor).maxHp, before, after);
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
    arms[arm].sort((a, b) => baseRewardShare(trait, a) - baseRewardShare(trait, b) || a - b);
  }
  boards.set(trait, arms);
  return arms;
}

/** A node's share of its trait's total bonus, from the given curves. */
const shareOf = (curves: [StatKey, number[]][], id: number) =>
  curves.reduce((sum, [, curve]) => sum + (curve[id]! - curve[id - 1]!) / curve[TRAIT_CAP]!, 0);
/** The share under the original schedule; it fixes each arm's purchase order. */
const baseRewardShare = (trait: TraitId, id: number) => shareOf(baseCurves[trait], id);
/** The share a node pays now (after the arm reward pattern). */
export function traitRewardShare(trait: TraitId, id: number): number {
  return shareOf(rewardCurves(trait), id);
}

function distributeTraitNodes(trait: TraitId): BoardArms {
  const arms: BoardArms = { left: [], right: [], mixed: [] };
  const families = { left: [] as number[], right: [] as number[] };
  const blank: number[] = [];
  const leftStat = baseCurves[trait][0]![0];
  // The shared reward is paid once. Keep the last original reward on the mixed path.
  for (const id of nodeIds.slice(1, -1)) {
    const gain = nodeGainsFrom(baseCurves[trait], id);
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

// --- SAVED TRAITS ---
/** True when Save traits locked this node in. */
export const isTraitNodeSaved = (character: CharacterState, trait: TraitId, node: number): boolean =>
  character.savedTraitNodes?.[trait]?.includes(node) ?? false;

/** Nodes spent since the last save (what Save traits would lock in). */
export const unsavedTraitNodeCount = (character: CharacterState): number =>
  TRAITS.reduce((sum, trait) => sum + traitNodeIds(character.traits, character.traitNodes, trait)
    .filter(node => !isTraitNodeSaved(character, trait, node)).length, 0);

/** Locks every spent trait node in; afterwards only a respec refunds them. */
export function saveTraits(character: CharacterState): CharacterState {
  if (!unsavedTraitNodeCount(character)) return character;
  const savedTraitNodes: TraitNodes = {};
  for (const trait of TRAITS) {
    const ids = traitNodeIds(character.traits, character.traitNodes, trait);
    if (ids.length) savedTraitNodes[trait] = [...ids];
  }
  return { ...character, savedTraitNodes };
}

/** Keeps only saved (locked) nodes the restored character still owns. */
function restoreSavedTraitNodes(saved: unknown, traits: Traits, owned: TraitNodes): TraitNodes | undefined {
  if (!saved || typeof saved !== 'object') return undefined;
  const kept: TraitNodes = {};
  for (const trait of TRAITS) {
    const ids = (saved as TraitNodes)[trait];
    if (!Array.isArray(ids)) continue;
    const have = traitNodeIds(traits, owned, trait);
    const valid = ids.filter(id => isTraitNode(id) && have.includes(id));
    if (valid.length) kept[trait] = valid;
  }
  return Object.keys(kept).length ? kept : undefined;
}

type NodeBlocker = { kind: 'prerequisite' | 'dependent'; node: number } | { kind: 'invalid' | 'points' | 'unchanged' | 'saved' };
export function traitNodeBlocker(character: CharacterState, trait: TraitId, node: number, owned: boolean): NodeBlocker | undefined {
  if (!isTrait(trait) || !isTraitNode(node) || typeof owned !== 'boolean') return { kind: 'invalid' };
  const selected = traitNodeIds(character.traits, character.traitNodes, trait);
  if (selected.includes(node) === owned) return { kind: 'unchanged' };
  if (!owned && isTraitNodeSaved(character, trait, node)) return { kind: 'saved' };
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

const XP_PER_VICTORY = 100;

/** A rising curve: early gains teach the systems; high ranks take longer. */
function levelXpThreshold(level: number, scaled = false) {
  const steps = level - 1;
  return scaled ? 260 + 14 * steps + Math.floor(steps * steps / 5) : 100 + 5 * steps;
}

/** XP required from this level to the next; zero at the cap. */
export const xpToNextLevel = (level: number, legacyProgression = false, scaled = false) =>
  level >= (legacyProgression ? LEGACY_RUN_LEVEL_CAP : LEVEL_CAP) ? 0 : levelXpThreshold(level, scaled);
export const awardCharacterVictory = (
  character: CharacterState
): CharacterState => {
  const cap = character.legacyProgression ? LEGACY_RUN_LEVEL_CAP : LEVEL_CAP;
  if (character.level >= cap) return character;
  const xp = character.xp + XP_PER_VICTORY;
  const threshold = xpToNextLevel(character.level, !!character.legacyProgression, !!character.scaledExperience);
  if (xp < threshold) return { ...character, xp };
  const level = character.level + 1;
  return { ...character, level, xp: level === cap ? 0 : xp - threshold };
};

/** Walk cumulative XP forward from a known level. */
function progressAt(level: number, xp: number, cap: number, scaled = false) {
  while (level < cap && xp >= levelXpThreshold(level, scaled)) {
    xp -= levelXpThreshold(level, scaled);
    level++;
  }
  return { level, xp: level === cap ? 0 : xp };
}

/** Preserve the level and progress already earned at the changeover. */
export function progressionFromWins(wins: number, legacyProgression = false, xpStartWins?: number) {
  const count = Math.max(0, Math.floor(wins));
  const cap = legacyProgression ? LEGACY_RUN_LEVEL_CAP : LEVEL_CAP;
  if (xpStartWins === undefined) return progressAt(1, count * XP_PER_VICTORY, cap);
  const migratedAt = Math.min(count, Math.max(0, Math.floor(xpStartWins)));
  const { level, xp } = progressAt(1, migratedAt * XP_PER_VICTORY, cap);
  const carried = Math.floor(xp * levelXpThreshold(level, true) / levelXpThreshold(level));
  return progressAt(level, carried + (count - migratedAt) * XP_PER_VICTORY, cap, true);
}

/** Preserve build proportions with integer quotas and stable trait-order ties. */
function fitLegacyBuild(traits: Traits, spent: number, budget: number): Traits {
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
    level > LEVEL_CAP ||
    !Number.isInteger(xp) ||
    xp < 0 ||
    xp >= (level === LEVEL_CAP ? 1 : levelXpThreshold(level)) ||
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
  if (spent > level * LEGACY_TRAIT_POINTS_PER_LEVEL) return fresh;
  const restoredLevel = level;
  // Older saves could spend three points per level. Keep the build, trimming only its excess allocation.
  const restoredTraits = fitLegacyBuild(traits, spent, restoredLevel * TRAIT_POINTS_PER_LEVEL);
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
  const { highestVigor, highestVigorHp, traitPaths: savedPaths, traitNodes: savedNodes, savedTraitNodes: lockedNodes } = value as Partial<CharacterState>;
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
  const savedTraitNodes = restoreSavedTraitNodes(lockedNodes, restoredTraits, traitNodes);
  let character: CharacterState = { ...fresh, level: restoredLevel, xp: restoredLevel === LEVEL_CAP ? 0 : xp,
    traits: restoredTraits, inventory, ringProgress,
    ...(Object.keys(traitNodes).length && { traitNodes }),
    ...(savedTraitNodes && { savedTraitNodes }),
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
const hpCurve = rankCurve(LEGACY_PLAYER_HP_CAP - PLAYER_MAX_HP, rank => !vigorShield(rank));
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
/** The original per-rank schedules; each arm's totals come from these. */
const baseCurves: Record<TraitId, [StatKey, number[]][]> = {
  vigor: [['maxHp', hpCurve], ['shieldPercent', shieldPercentCurve]],
  strength: [['meleeFlat', attackFlatCurve], ['meleePercent', attackPercentCurve]],
  dexterity: [['rangeFlat', attackFlatCurve], ['rangePercent', rangedPercentCurve], ['accuracyPercent', accuracyCurve]],
  intelligence: [['magicFlat', attackFlatCurve], ['magicPercent', attackPercentCurve]],
  scorn: [['afflictionFlat', afflictionCurve], ['afflictionDamagePercent', afflictionDamageCurve]],
  endurance: [['shieldFlat', guardCurve], ['startingEnergy', startingEnergyCurve], ['retainEnergy', reserveCurve], ['maxEnergy', capacityCurve], ['healingPercent', healingCurve]],
};

// --- ARM REWARD PATTERN ---
// Along each arm, from the junction out: three small circles, then one
// worth 5 of them, repeating, and the arm's tip is worth 10. Each arm
// keeps the exact totals it had under the base schedule; only how they are
// spread along the arm changes (see packArm).
const ARM_SMALL_WEIGHT = 1;
const ARM_STEP_WEIGHT = 5;
const ARM_STEP_EVERY = 4;
const ARM_TIP_WEIGHT = 10;

/** Weight of the circle at `position` (0 = next to the junction) on an arm of `length`. */
export const armRewardWeight = (position: number, length: number): number =>
  position === length - 1 ? ARM_TIP_WEIGHT
    : (position + 1) % ARM_STEP_EVERY === 0 ? ARM_STEP_WEIGHT : ARM_SMALL_WEIGHT;

/** A node's marginal bonus on the given curves. */
function nodeGainsFrom(curves: [StatKey, number[]][], node: number): NodeGain {
  const gain: NodeGain = {};
  if (!isTraitNode(node)) return gain;
  for (const [key, curve] of curves) {
    const delta = curve[node]! - curve[node - 1]!;
    if (delta) gain[key] = delta;
  }
  return gain;
}

type RewardUnit = { key: StatKey; share: number };

/**
 * Hands an arm's reward units out to its circles so each circle's share of
 * the trait tracks its pattern weight. Every circle first gets one unit (the
 * biggest units go to the heaviest circles), then each remaining unit, largest
 * first, goes to the circle furthest below its target. Units are whole stat
 * points, so totals stay exact even for small stats like +1 affliction stack.
 */
function packArm(units: RewardUnit[], weights: readonly number[]): RewardUnit[][] {
  const totalShare = units.reduce((sum, unit) => sum + unit.share, 0);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const targets = weights.map(weight => totalShare * weight / weightSum);
  const bins: RewardUnit[][] = weights.map(() => []);
  const got = weights.map(() => 0);
  const queue = [...units].sort((a, b) => b.share - a.share);
  // Heaviest circle first; nearer the tip first on equal weight.
  const heaviest = weights.map((_, i) => i).sort((a, b) => weights[b]! - weights[a]! || b - a);
  for (const i of heaviest) {
    const unit = queue.shift();
    if (!unit) break;
    bins[i]!.push(unit);
    got[i]! += unit.share;
  }
  for (const unit of queue) {
    let best = 0;
    for (let i = 1; i < bins.length; i++)
      if (targets[i]! - got[i]! > targets[best]! - got[best]!) best = i;
    bins[best]!.push(unit);
    got[best]! += unit.share;
  }
  return bins;
}

const rewardCurveCache = new Map<TraitId, [StatKey, number[]][]>();
/** The live curves: each arm's base totals re-spread by the arm reward pattern. */
function rewardCurves(trait: TraitId): [StatKey, number[]][] {
  const cached = rewardCurveCache.get(trait);
  if (cached) return cached;
  const base = baseCurves[trait];
  const delta = (curve: number[], id: number) => curve[id]! - curve[id - 1]!;
  // The junction (and any node outside the arms) keeps its base reward.
  const deltas = new Map<StatKey, number[]>(base.map(([key, curve]) =>
    [key, Array.from({ length: TRAIT_CAP + 1 }, (_, id) => (id ? delta(curve, id) : 0))]));
  for (const arm of Object.values(traitNodeArms(trait))) {
    const units: RewardUnit[] = base.flatMap(([key, curve]) => {
      const total = arm.reduce((sum, id) => sum + delta(curve, id), 0);
      const share = 1 / (curve[TRAIT_CAP]! - curve[0]!);
      return Array.from({ length: Math.max(0, total) }, () => ({ key, share }));
    });
    const bins = packArm(units, arm.map((_, i) => armRewardWeight(i, arm.length)));
    arm.forEach((id, i) => {
      for (const [key] of base) deltas.get(key)![id] = bins[i]!.filter(unit => unit.key === key).length;
    });
  }
  const curves = base.map(([key, curve]): [StatKey, number[]] => {
    const live = [curve[0]!];
    for (let id = 1; id <= TRAIT_CAP; id++) live.push(live[id - 1]! + deltas.get(key)![id]!);
    return [key, live];
  });
  rewardCurveCache.set(trait, curves);
  return curves;
}

/** Scale only HP from the established Vigor reward pattern; shield gains stay identical. */
const expandedVigorCurves = rewardCurves('vigor').map(([key, curve]): [StatKey, number[]] => [key,
  key === 'maxHp' ? curve.map(hp => Math.round(hp * (PLAYER_HP_CAP - PLAYER_MAX_HP) / (LEGACY_PLAYER_HP_CAP - PLAYER_MAX_HP))) : curve,
]);

/** The 333-HP curve stays available to already-issued runs. */
export const playerHpCap = (legacyVigor?: boolean) => legacyVigor ? LEGACY_PLAYER_HP_CAP : PLAYER_HP_CAP;

/** What one board node grants under the arm reward pattern. */
export function traitNodeGains(trait: TraitId, node: number, legacyVigor = false): NodeGain {
  return nodeGainsFrom(trait === 'vigor' && !legacyVigor ? expandedVigorCurves : rewardCurves(trait), node);
}

/** The pattern weight of a node (1, 5 or 10); the junction has none. */
export function traitNodeWeight(trait: TraitId, node: number): number | undefined {
  for (const arm of Object.values(traitNodeArms(trait))) {
    const position = arm.indexOf(node);
    if (position >= 0) return armRewardWeight(position, arm.length);
  }
  return undefined;
}

/** Keep hybrid prefixes, then allocate distinct nodes matching the old preferred stats. */
export function migratePathNodes(trait: TraitId, allocation: PathRanks): number[] {
  const selected = new Set(prefixes[allocation.hybrid]);
  const categories = nodeIds.map(node => {
    const curves = baseCurves[trait];
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

export function characterBonuses(traits: Partial<Traits> = {}, equipment?: Equipment, nodes?: TraitNodes, legacyVigor = false) {
  const stats = { ...baseStats };
  for (const trait of TRAITS) {
    const selected = nodes?.[trait];
    for (const [key, curve] of trait === 'vigor' && !legacyVigor ? expandedVigorCurves : rewardCurves(trait)) {
      stats[key] += selected
        ? selected.reduce((total, id) => total + curve[id]! - curve[id - 1]!, 0)
        : curve[traits[trait] ?? 0]!;
    }
  }
  if (equipment?.rings.includes('iron-ring')) stats.retainEnergy += IRON_RING_RESERVE;
  if (equipment?.amulet === 'travelers-amulet') stats.cardsPerTurn += TRAVELERS_AMULET_DRAW;
  const amulet = shopAmuletBonus(equipment?.amulet);
  if (amulet) {
    stats.cardsPerTurn += amulet.draw;
    stats.retainEnergy += amulet.reserve;
  }
  return stats;
}

/** Only newly reached Vigor ranks grant HP, so refunds cannot be cycled for healing. */
export const traitHealth = (
  hp: number, maxHp: number, oldTraits: Partial<Traits> | undefined,
  character: CharacterState, creditedVigor = oldTraits?.vigor ?? 0,
  baseHp?: number, oldNodes?: TraitNodes, creditedHpBonus?: number,
) => {
  const oldHp = characterBonuses(oldTraits, undefined, oldNodes, character.legacyVigor).maxHp;
  const base = baseHp ?? maxHp - oldHp + PLAYER_MAX_HP;
  const nextMax = Math.min(playerHpCap(character.legacyVigor), base +
    characterBonuses(character.traits, undefined, character.traitNodes, character.legacyVigor).maxHp - PLAYER_MAX_HP);
  const credited = Math.min(playerHpCap(character.legacyVigor), base + (creditedHpBonus ?? Math.max(oldHp, characterBonuses({ vigor: creditedVigor }, undefined, undefined, character.legacyVigor).maxHp)) - PLAYER_MAX_HP);
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
