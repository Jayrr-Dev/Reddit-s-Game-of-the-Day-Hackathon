import { regionIndexOf, regionName } from './kingdom.ts';
import { STOPS_PER_REGION } from './rules.ts';

export type RegionChoice = 0 | 1;

// Real battlefield anchors for each route. New pairs open at the same difficulty.
const REGIONS = [
  [{ name: "King's Road", map: "King's Road" }, { name: 'Riverlands', map: 'River Bridge' }],
  [{ name: 'Monastery', map: 'Monastery' }, { name: 'Elven Reach', map: 'Elven Forest' }],
  [{ name: 'Castle Gates', map: 'Castle Gates' }, { name: 'The Undercroft', map: 'Dungeon' }],
  [{ name: 'Royal Court', map: 'Royal Court' }, { name: 'The Fallen City', map: 'Fallen City' }],
  [{ name: 'Throne Room', map: 'Throne Hall' }, { name: 'The Ash March', map: 'Volcanic Pass' }],
] as const;
const UPRISING = [{ name: 'Highland Uprising', map: 'Mountain Pass' }, { name: 'Dune Uprising', map: 'Dune Sea' }] as const;

export const regionChoices = (index: number) => REGIONS[index - 1] ?? UPRISING;
export const isRegionChoice = (value: unknown): value is RegionChoice => value === 0 || value === 1;

type RegionState = { stop: number; phase: { kind: string }; stats: { regionsConquered: number }; regionPath?: Partial<Record<number, RegionChoice>> };
export const chosenRegion = (run: Pick<RegionState, 'stop' | 'regionPath'>) =>
  run.regionPath?.[regionIndexOf(run.stop)];

export function regionOfRun(run: Pick<RegionState, 'stop' | 'regionPath'>) {
  const index = regionIndexOf(run.stop);
  const choice = chosenRegion(run);
  return choice === undefined ? regionName(index) : regionChoices(index)[choice].name;
}

export function canChooseRegion(run: RegionState) {
  const index = regionIndexOf(run.stop);
  return index > 0 && run.phase.kind === 'route' && (run.stop - 1) % STOPS_PER_REGION === 0 &&
    run.stats.regionsConquered >= index && chosenRegion(run) === undefined;
}

