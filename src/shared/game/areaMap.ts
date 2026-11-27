import type { AreaBattle, AreaSite } from './conquestAreas.ts';

export type AreaTerrain = 'road' | 'village' | 'city' | 'citadel' | 'tunnels' | 'bridge' | 'woods' | 'peak';
export type AreaPoint = { x: number; y: number };
export type AreaMapNode = AreaPoint & {
  id: string; label: string; battle: number; kind: 'battle' | 'curio' | 'building'; room?: number;
};

const BUILDINGS = ['Wayside Inn', 'Blacksmith', 'Village Shrine'] as const;
const ROAD_CURIOS = ['Mile Marker', 'Wayside Shrine'] as const;

/** A site may be guarded like a city without sharing its physical layout. */
export function areaTerrain(site: AreaSite): AreaTerrain {
  if (site.kind === 'capital') return 'citadel';
  if (/village|hamlet/i.test(site.map)) return 'village';
  if (/bridge|aqueduct/i.test(site.map)) return 'bridge';
  if (site.kind === 'depths' || /dungeon|mine|cave|ruins/i.test(site.map)) return 'tunnels';
  if (/road/i.test(site.map)) return 'road';
  if (/forest|grove/i.test(site.map)) return 'woods';
  if (site.kind === 'dragon' || /pass|dune/i.test(site.map)) return 'peak';
  return site.kind === 'city' || site.map === 'Monastery' ? 'city' : 'road';
}

/** Extra visit slots do not change old, unindexed room actions during replay. */
export function areaVisitCount(site: AreaSite, battle: AreaBattle): number {
  const terrain = areaTerrain(site);
  return terrain === 'village' ? Math.max(BUILDINGS.length, battle.rooms)
    : terrain === 'road' ? Math.max(ROAD_CURIOS.length, battle.rooms) : battle.rooms;
}

/** Old saves implicitly visited the first rooms in order. */
export function areaVisitedRooms(explored: number, visited?: readonly number[]): readonly number[] {
  return visited ?? Array.from({ length: explored }, (_, i) => i);
}

const BATTLE_LABEL = { elite: 'Encounter', 'location-boss': 'City Boss', 'region-boss': 'Guardian', 'dragon-boss': 'Dragon', 'endless-boss': 'Champion' };

/** Build encounter and visit markers from the same battle plan the run uses. */
export function areaMapNodes(site: AreaSite, battles: readonly AreaBattle[]): AreaMapNode[] {
  const terrain = areaTerrain(site);
  return battles.flatMap((battle, index) => {
    const single = battles.length === 1;
    const y = single ? 77 : index === 0 ? 83 : 44;
    const x = terrain === 'tunnels' ? (index === 0 ? 29 : 72) : terrain === 'woods' ? 43 : 50;
    const node: AreaMapNode = { id: 'battle-' + index, label: BATTLE_LABEL[battle.finish], x, y, battle: index, kind: 'battle' };
    const count = areaVisitCount(site, battle);
    return [node, ...Array.from({ length: count }, (_, room): AreaMapNode => {
      const fixedX = terrain === 'road' || terrain === 'bridge';
      const visitX = fixedX ? x : count === 1 ? (x < 50 ? 69 : 31) : 16 + room * (68 / (count - 1));
      const visitY = fixedX ? y - (single ? 24 : 10) * (room + 1)
        : y - (single ? 35 : 24) - (room % 2 === 1 ? (single ? 14 : 7) : 0);
      return { id: 'room-' + index + '-' + room, battle: index, room, x: visitX, y: visitY,
        kind: terrain === 'village' ? 'building' : 'curio',
        label: (terrain === 'village' ? BUILDINGS[room] : terrain === 'road' ? ROAD_CURIOS[room] : undefined) ?? 'Curio ' + (room + 1) };
    })];
  });
}
