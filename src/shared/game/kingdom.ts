// ===================================================================
// THE KINGDOM (ROUTE GENERATION)
// Decides what waits at each stop of the conquest. Every stop is seeded
// from the day plus the stop number, so all players see the same
// choices at stop 7 no matter what they picked at stops 1 to 6.
// ===================================================================

import { CHAMPION_IDS, ELITE_IDS, GRUNT_IDS, type HeroId } from './heroes.ts';
import {
  hashSeed,
  nextInt,
  pickOne,
  pickWeighted,
  type RngResult,
  type RngState,
} from './rng.ts';
import {
  MIGHT_PER_REGION,
  MIGHT_PER_STOP,
  REGION_NAMES,
  STOPS_PER_REGION,
} from './rules.ts';

// --- TYPES ---
/**
 * What a stop holds:
 * - horde:    a fight against 1 to 3 grunt heroes
 * - elite:    a harder fight with better card rewards
 * - grave:    her grave; rest to heal or swear vengeance for max HP
 * - altar:    the dark altar; take a powerful card
 * - champion: the region's guardian; beating it conquers the region
 */
export type StopKind = 'horde' | 'elite' | 'grave' | 'altar' | 'champion' | 'greed-bargain';

export type Stop = {
  optionIndex?: number;
  site?: import('./conquestAreas.ts').AreaSite;
  kind: StopKind;
  /** Heroes in this fight, in acting order (empty for grave and altar). */
  heroIds: HeroId[];
};

// --- SEEDS ---
/** The seed for one purpose at one stop, e.g. ("2026-11-23", "combat", 4). */
export const stopSeed = (
  dailyKey: string,
  purpose: string,
  stop: number
): RngState => hashSeed(`villain-arc:${dailyKey}:${purpose}:${stop}`);

// --- REGIONS ---
/** Zero-based region index for a 1-based stop number. */
export const regionIndexOf = (stop: number): number =>
  Math.floor((stop - 1) / STOPS_PER_REGION);

/** Region name; beyond the throne the kingdom rises up in endless uprisings. */
export const regionName = (regionIndex: number): string =>
  REGION_NAMES[regionIndex] ??
  `Uprising ${regionIndex - REGION_NAMES.length + 1}`;

/** True when this stop is the region's last, where its champion waits. */
export const isChampionStop = (stop: number): boolean =>
  stop % STOPS_PER_REGION === 0;

/** How strong heroes are at this stop (1 = base stats). */
export const mightAt = (stop: number): number => {
  const region = regionIndexOf(stop);
  const stepInRegion = (stop - 1) % STOPS_PER_REGION;
  return 1 + region * MIGHT_PER_REGION + stepInRegion * MIGHT_PER_STOP;
};

/** The champion guarding a region; after the throne they return, stronger. */
export const championOf = (regionIndex: number): HeroId => {
  const champion = CHAMPION_IDS[regionIndex % CHAMPION_IDS.length];
  if (!champion) throw new Error('No champions defined');
  return champion;
};

// --- HORDES ---

/** How many grunts fill a horde at this stop: 1 early, up to 3 later. */
const hordeSize = (state: RngState, stop: number): RngResult<number> => {
  if (stop <= 2) return [1, state];
  if (regionIndexOf(stop) === 0) return [2, state];
  const [extra, next] = nextInt(state, 2);
  return [2 + extra, next];
};

/** Rolls `count` grunts (repeats allowed: two Archers is a real horde). */
const rollGrunts = (state: RngState, count: number): RngResult<HeroId[]> => {
  const heroIds: HeroId[] = [];
  let current = state;
  for (let index = 0; index < count; index += 1) {
    const [heroId, next] = pickOne(current, GRUNT_IDS);
    heroIds.push(heroId);
    current = next;
  }
  return [heroIds, current];
};

/** Builds a stop of the given kind, rolling its heroes. */
const buildStop = (
  state: RngState,
  kind: StopKind,
  stop: number
): RngResult<Stop> => {
  if (kind === 'horde') {
    const [size, afterSize] = hordeSize(state, stop);
    const [heroIds, next] = rollGrunts(afterSize, size);
    return [{ kind, heroIds }, next];
  }
  if (kind === 'elite') {
    const [elite, afterElite] = pickOne(state, ELITE_IDS);
    const escortCount = regionIndexOf(stop) >= 1 ? 1 : 0;
    const [escort, next] = rollGrunts(afterElite, escortCount);
    return [{ kind, heroIds: [...escort, elite] }, next];
  }
  if (kind === 'champion') {
    return [{ kind, heroIds: [championOf(regionIndexOf(stop))] }, state];
  }
  return [{ kind, heroIds: [] }, state];
};

/** Weights for the second path at a stop. Early stops are all fights. */
const secondPathWeights = (
  stop: number
): { item: StopKind; weight: number }[] =>
  stop <= 1
    ? [{ item: 'horde', weight: 1 }]
    : [
        { item: 'horde', weight: 3 },
        { item: 'elite', weight: 2 },
        { item: 'grave', weight: 2 },
        { item: 'altar', weight: 1 },
      ];

// --- PUBLIC API ---

/**
 * The paths offered at a stop. Champion stops offer only the champion.
 * Otherwise path 1 is always a horde (so progress is always possible)
 * and path 2 is a weighted roll.
 */
export const routeOptions = (dailyKey: string, stop: number, allowGreed = false): Stop[] => {
  const seed = stopSeed(dailyKey, 'route', stop);
  if (isChampionStop(stop)) return [buildStop(seed, 'champion', stop)[0]];

  const [first, afterFirst] = buildStop(seed, 'horde', stop);
  const [secondKind, afterKind] = pickWeighted(
    afterFirst,
    secondPathWeights(stop)
  );
  if (allowGreed && stop >= 3 && nextInt(stopSeed(dailyKey, 'greed-bargain', stop), 100)[0] < 9)
    return [first, { kind: 'greed-bargain', heroIds: [] }];
  const [second] = buildStop(afterKind, secondKind, stop);
  return [first, second];
};
