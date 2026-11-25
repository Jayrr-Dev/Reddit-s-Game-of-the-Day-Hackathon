import type { StopKind } from '../../../shared/game/kingdom';
import { MAP_NAMES } from './combat/Backdrop';

const roads = [
  ['Village Green', 'Someone has left the well bucket swinging.'],
  ["King’s Road", 'Fresh hoofprints cross the old mile marker.'],
  ['River Bridge', 'A toll bell hangs from a fraying rope.'],
  ['Birch Grove', 'Red thread marks a trail through the white trunks.'],
  ['Old Aqueduct', 'Water whispers through the broken arches.'],
  ['Mountain Pass', 'A lone lantern burns above the switchback.'],
  ['City Square', 'The market stalls stand open and empty.'],
  ['Castle Gates', 'A watchman draws the last bolt across the gate.'],
] as const;
const special = {
  grave: ['Birch Grove', 'Someone still brings fresh flowers to her grave.'],
  altar: ['Ancient Ruins', 'Rain beads on the altar. Its candles stay lit.'],
  champion: ['Throne Hall', 'One set of footprints leads up to the throne.'],
} as const;

export function routeLocation(stop: number, option: number, kind: StopKind) {
  const [name, flavour] = kind === 'grave' || kind === 'altar' || kind === 'champion'
    ? special[kind] : roads[(stop - 1 + option) % roads.length]!;
  return { name, flavour, terrain: MAP_NAMES.indexOf(name) };
}
