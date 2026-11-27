import { isChampionStop, regionIndexOf, routeOptions, stopSeed, type Stop } from './kingdom.ts';
import { regionChoices, type RegionChoice } from './regionRoutes.ts';
import { stopLocation } from './routeLocation.ts';
import { nextInt, pickOne } from './rng.ts';
import { CONQUEST_SCENARIOS } from './conquestScenarios.ts';
import { CHAMPION_IDS, type HeroId } from './heroes.ts';
import { STOPS_PER_REGION } from './rules.ts';

export const CONQUEST_VERSION = 1;
export const MAX_WAVE_SIZE = 6;
export const REST_FRACTION = 0.25;

/** Campaign wave packs scale more gently than the old endless-run hordes. */
export const conquestMightAt = (stop: number) =>
  1 + regionIndexOf(stop) * 0.13 + ((stop - 1) % STOPS_PER_REGION) * 0.025;

export const GRANDANGEL_BOSSES = [
  'grandangelCambiel', 'grandangelGeonosis', 'grandangelRaziel',
  'cervielSword', 'zadkielOfDominations', 'grandangelCherubiel',
] as const satisfies readonly HeroId[];

export const ARCHANGEL_BOSSES = [
  'archangelUriel', 'archangelZeruel', 'archangelMikhael',
] as const satisfies readonly HeroId[];

export const LOCATION_BOSSES = ['grandGriffon', 'holyKing', 'twinAxeKnight', 'holyDragon', 'mageBorneAstra', 'mageBorneAzula'] as const satisfies readonly HeroId[];
export const AREA_BOSSES = ['tempestWyrm', 'fulgurDragonknight'] as const satisfies readonly HeroId[];

export const CAMPAIGN_LENGTH = GRANDANGEL_BOSSES.length + ARCHANGEL_BOSSES.length;
export const isLastRegion = (stop: number) => regionIndexOf(stop) === CAMPAIGN_LENGTH - 1;

export type AreaSite = { name: string; map: string; flavour: string; kind: 'field' | 'depths' | 'city' | 'capital' | 'dragon'; dragon?: HeroId; cityBoss?: HeroId };
type Wave = { name: string; heroIds: readonly HeroId[]; might?: number };
export type AreaBattle = { waves: readonly Wave[]; finish: 'elite' | 'location-boss' | 'region-boss' | 'dragon-boss'; rooms: number; secrets: number };

/** The two routes at each tier each lead to their own capital city. */
const CAPITAL_NAMES = [
  ['Crowncross', 'Crowncross'],
  ['Crownwatch', 'Floodspire'],
  ['Vesperhold', 'Briar Crown'],
  ['Ironseat', 'Hollow Crown'],
  ['The Argent Seat', 'Cinderwall'],
  ['High Crown', 'Ashkeep'],
  ['Dawnspire', 'Sunfall'],
  ['Eclipse Court', 'Moonspire'],
  ['Heaven\'s Gate', 'The Last Citadel'],
] as const;
const CAPITAL_MAPS = ['City Square', 'Castle Gates', 'Royal Court', 'Throne Hall', 'Fallen City'] as const;
const CITY_MAPS = new Set<string>(['City Square', 'Fallen City', 'Castle Gates', 'Royal Court', 'Throne Hall']);
const DEPTH_MAPS = new Set<string>(['Dungeon', 'Mines', 'Cave', 'Ancient Ruins']);

type AreaLayout = readonly { rooms: number; secrets: number }[];
const LAYOUTS = {
  field: [{ rooms: 1, secrets: 0 }],
  depths: [{ rooms: 2, secrets: 1 }, { rooms: 2, secrets: 1 }],
  city: [{ rooms: 2, secrets: 0 }, { rooms: 3, secrets: 1 }],
  capital: [{ rooms: 2, secrets: 1 }, { rooms: 2, secrets: 0 }],
  dragon: [{ rooms: 2, secrets: 1 }],
} as const satisfies Record<AreaSite['kind'], AreaLayout>;

/** Reveals the fixed size of a site, not the contents of its secrets. */
export function areaCounts(site: AreaSite) {
  const layout = LAYOUTS[site.kind];
  return { battles: layout.length, rooms: layout.reduce((count, battle) => count + battle.rooms, 0) };
}

/** A city's guardian is different from the region boss in the capital. */
function regionBossWave(index: number): Wave {
  const boss = [...GRANDANGEL_BOSSES, ...ARCHANGEL_BOSSES][index] ?? ARCHANGEL_BOSSES.at(-1)!;
  return {
    name: index < GRANDANGEL_BOSSES.length ? 'Region Boss' : 'Final Boss',
    heroIds: boss === 'archangelZeruel' ? [boss, 'zeruelRedSun', 'zeruelBlueSun'] : [boss],
    might: index < GRANDANGEL_BOSSES.length ? 0.42 + index * 0.11 : 1,
  };
}

const DRAGON_SITES = [
  { name: 'Eye of the Tempest', map: 'Mountain Pass', dragon: 'tempestWyrm' },
  { name: 'The Thunder Eyrie', map: 'Volcanic Pass', dragon: 'fulgurDragonknight' },
] as const;

/** Rare side routes never replace the capital or its region boss. */
function dragonSite(key: string, stop: number): AreaSite | undefined {
  const region = regionIndexOf(stop);
  if (region < 3 || (stop - 1) % STOPS_PER_REGION !== 2) return undefined;
  const [roll, next] = nextInt(stopSeed(key, 'dragon-site', stop), 100);
  if (roll >= 35) return undefined;
  return { ...pickOne(next, DRAGON_SITES)[0], kind: 'dragon', flavour: 'An optional battle against a dragon. The road to the capital remains open.' };
}

const BOSS_LOCATIONS = [
  { name: 'Basilica Ward', map: 'City Square', cityBoss: 'holyKing' },
  { name: 'Griffon’s Watch', map: 'Deep Forest', cityBoss: 'grandGriffon' },
  { name: 'The Sable Vault', map: 'Dungeon', cityBoss: 'mageBorneAzula' },
  { name: 'Khan’s Bastion', map: 'Fallen City', cityBoss: 'twinAxeKnight' },
  { name: 'The Astral Sanctum', map: 'Ancient Ruins', cityBoss: 'mageBorneAstra' },
  { name: 'Sunward City', map: 'City Square', cityBoss: 'holyDragon' },
] as const satisfies readonly { name: string; map: string; cityBoss: typeof LOCATION_BOSSES[number] }[];

/** New routes converge at the capital. Legacy runs retain the old route roll. */
export function conquestStops(key: string, stop: number, region?: RegionChoice): Stop[] {
  const index = regionIndexOf(stop);
  if (isChampionStop(stop)) {
    const name = CAPITAL_NAMES[index]?.[region ?? 0] ?? 'The Last Citadel';
    const map = CAPITAL_MAPS[(index + (region ?? 0) * 2) % CAPITAL_MAPS.length]!;
    return [{ kind: 'champion', heroIds: [...regionBossWave(index).heroIds],
      site: { name, map, flavour: 'Every road in this region ends at these gates.', kind: 'capital' } }];
  }
  const dragon = dragonSite(key, stop);
  return routeOptions(key, stop).map((_, option) => {
    if (option === 1 && dragon) return { kind: 'horde', heroIds: [], site: dragon };
    const location = stopLocation(stop, option, 'horde', region);
    const extraMaps = ['River Bridge', 'Castle Gates', 'City Square', 'Fallen City', 'Royal Court'];
    const lateMap = index >= 6 ? regionChoices(index, true)[region ?? 0].map : undefined;
    const bossSite = stop % STOPS_PER_REGION === 4 && option === 1 ? BOSS_LOCATIONS[index] : undefined;
    if (bossSite) return { kind: 'horde', heroIds: [], site: { ...bossSite, kind: 'city',
      flavour: 'A named guardian holds this location.' } };
    const map = lateMap
      ? (option === 0 ? lateMap : extraMaps[(stop - 1) % extraMaps.length]!) : location.name;
    const kind = CITY_MAPS.has(map) ? 'city' : DEPTH_MAPS.has(map) ? 'depths' : 'field';
    return { kind: 'horde', heroIds: [], site: {
      name: map, map, kind, flavour: lateMap ? 'The capital lies beyond this road.' : location.flavour,
    } };
  });
}

/** Builds a site's ordered sequence once; all its battles use the same map. */
export function buildAreaBattles(site: AreaSite, dailyKey: string, stop: number, option: number): AreaBattle[] {
  const index = regionIndexOf(stop);
  const seed = stopSeed(dailyKey, 'area:' + option + ':' + site.name, stop);
  const opening = site.kind === 'capital' ? CONQUEST_SCENARIOS.cityGarrison
    : site.kind === 'city' ? CONQUEST_SCENARIOS.gateWatch
    : site.kind === 'depths' ? CONQUEST_SCENARIOS.cryptWardens
    : stop <= 2 ? CONQUEST_SCENARIOS.roadPatrol
    : pickOne(seed, [CONQUEST_SCENARIOS.tollWatch, CONQUEST_SCENARIOS.sideStreetAmbush, CONQUEST_SCENARIOS.woodlineSkirmish])[0];
  return LAYOUTS[site.kind].map((layout, battle) => {
    if (site.dragon) return { ...layout, finish: 'dragon-boss', waves: [{ name: 'Area Boss', heroIds: [site.dragon], might: 0.7 + index * 0.06 }] };
    const cityBoss = site.kind === 'city' && battle === 1;
    const regionBoss = site.kind === 'capital' && battle === 1;
    const elite = CHAMPION_IDS[(index + battle + (site.kind === 'depths' ? 2 : 0) + option) % CHAMPION_IDS.length]!;
    const finale: Wave = regionBoss ? regionBossWave(index)
      : cityBoss && site.cityBoss ? { name: 'City Boss', heroIds: [site.cityBoss], might: site.cityBoss === 'grandGriffon' ? 0.55 : 0.8 + index * 0.04 }
      : { name: 'Officer', heroIds: [elite], might: (stop <= 2 ? 0.52 : 0.82) + index * 0.12 };
    const reinforcement = site.kind === 'capital' ? (index >= 2 ? CONQUEST_SCENARIOS.capitalVanguard : CONQUEST_SCENARIOS.cityGarrison)
      : site.kind === 'depths' ? CONQUEST_SCENARIOS.undercroftGuard : CONQUEST_SCENARIOS.bridgeRetinue;
    const waves: Wave[] = [battle === 0 ? opening : reinforcement];
    if (regionBoss && index >= 3) waves.push(index === 4 ? CONQUEST_SCENARIOS.siegeLine : index % 2 ? CONQUEST_SCENARIOS.assassinPatrol : CONQUEST_SCENARIOS.veteranEscort);
    if (index >= 2 && battle === 0 && site.kind !== 'field') waves.push(CONQUEST_SCENARIOS.veteranEscort);
    waves.push(finale);
    return { ...layout, waves, finish: regionBoss ? 'region-boss' : cityBoss && site.cityBoss ? 'location-boss' : 'elite' };
  });
}

export type RoomEvent = { title: string; detail: string; heal?: number; reward?: 'horde' | 'elite'; secret?: true; greed?: true };

const ROOM_EVENTS: readonly RoomEvent[] = [
  { title: 'Abandoned Infirmary', detail: 'A sealed flask survived the looting.', heal: 0.12 },
  { title: 'Quartermaster’s Cache', detail: 'Someone left a card inside a false-bottom crate.', reward: 'horde' },
  { title: 'Cold Hearth', detail: 'The last occupants left in a hurry. Nothing remains but ash.' },
  { title: 'Forgotten Shrine', detail: 'The candles are still warm. There is enough balm for your wounds.', heal: 0.08 },
  { title: 'Marked Door', detail: 'Six names have been scratched away. A seventh was never written.' },
];

const SECRETS: readonly RoomEvent[] = [
  { title: 'Hidden Reliquary', detail: 'A loose stone conceals a sealed card.', reward: 'elite', secret: true },
  { title: 'The Buried Spring', detail: 'The water beneath the floor is still warm.', heal: 0.25, secret: true },
];

/** The daily seed fixes room outcomes; revisiting or reloading cannot reroll them. */
export function areaRoomEvent(dailyKey: string, stop: number, site: AreaSite, battle: number, layout: AreaBattle, room: number, allowGreed: boolean): RoomEvent {
  const seed = stopSeed(dailyKey, 'room:' + site.name + ':' + battle, stop);
  const [secretStart] = nextInt(seed, layout.rooms);
  const roomSeed = stopSeed(dailyKey, 'room-event:' + site.name + ':' + battle + ':' + room, stop);
  if ((room - secretStart + layout.rooms) % layout.rooms < layout.secrets) return pickOne(roomSeed, SECRETS)[0];
  if (allowGreed && stop >= 3 && nextInt(roomSeed, 100)[0] < 9) {
    return { title: 'A door into gold', detail: 'Greed waits on the other side.', greed: true };
  }
  return ROOM_EVENTS[nextInt(roomSeed, ROOM_EVENTS.length)[0]]!;
}
