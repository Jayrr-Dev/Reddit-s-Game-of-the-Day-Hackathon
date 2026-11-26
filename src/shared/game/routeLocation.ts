// ===================================================================
// ROUTE LOCATION
// Which named map each stop of a run takes place on. Shared so the
// client draws the right backdrop and the server can record which maps
// a player has visited (map unlocks) from the same table.
// ===================================================================

import type { StopKind } from './kingdom.ts';

// --- LOCATIONS ---
/** Road stops cycle through these maps, one step per stop and option. */
const ROADS = [
  ['Village Green', 'Someone has left the well bucket swinging.'],
  ["King’s Road", 'Fresh hoofprints cross the old mile marker.'],
  ['River Bridge', 'A toll bell hangs from a fraying rope.'],
  ['Birch Grove', 'Red thread marks a trail through the white trunks.'],
  ['Old Aqueduct', 'Water whispers through the broken arches.'],
  ['Mountain Pass', 'A lone lantern burns above the switchback.'],
  ['City Square', 'The market stalls stand open and empty.'],
  ['Castle Gates', 'A watchman draws the last bolt across the gate.'],
] as const;

/** Special stops always use their own map. */
const SPECIAL = {
  grave: ['Birch Grove', 'Someone still brings fresh flowers to her grave.'],
  altar: ['Ancient Ruins', 'Rain beads on the altar. Its candles stay lit.'],
  champion: ['Throne Hall', 'One set of footprints leads up to the throne.'],
} as const;

// --- LOOKUP ---
/** The map name and flavour line for one stop's chosen option. */
export const stopLocation = (stop: number, option: number, kind: StopKind) => {
  const [name, flavour] = kind === 'grave' || kind === 'altar' || kind === 'champion'
    ? SPECIAL[kind] : ROADS[(stop - 1 + option) % ROADS.length] ?? ROADS[0];
  return { name, flavour };
};
