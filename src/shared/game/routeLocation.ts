// ===================================================================
// ROUTE LOCATION
// Which named map each stop of a run takes place on. Shared so the
// client draws the right backdrop and the server can record which maps
// a player has visited (map unlocks) from the same table.
// ===================================================================

import { regionIndexOf, type StopKind } from './kingdom.ts';
import { regionChoices, type RegionChoice } from './regionRoutes.ts';
import { STOPS_PER_REGION } from './rules.ts';

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
export const stopLocation = (stop: number, option: number, kind: StopKind, region?: RegionChoice) => {
  if (region !== undefined && (kind === 'horde' || kind === 'elite')) {
    const { map } = regionChoices(regionIndexOf(stop))[region];
    const paths: Readonly<Record<string, readonly [string, string][]>> = {
      "King's Road": [["King's Road", 'Fresh tracks lead beyond the old mile marker.'], ['Village Green', 'The road cuts through a shuttered village.']],
      'River Bridge': [['River Bridge', 'A toll bell swings over the ford.'], ['Old Aqueduct', 'Water whispers through the broken arches.']],
      Monastery: [['Monastery', 'A candle burns in the highest window.'], ['Birch Grove', 'Red thread marks a trail through the white trunks.']],
      'Elven Forest': [['Elven Forest', 'Old lamps catch the light beyond the trees.'], ['Deep Forest', 'The canopy shuts out the sky.']],
      'Castle Gates': [['Castle Gates', 'A watchman slides the last bolt into place.'], ['City Square', 'The market stalls stand open and empty.']],
      Dungeon: [['Dungeon', 'A draught stirs the torchlight below.'], ['Mines', 'The last cart was abandoned on the rails.'], ['Cave', 'A trail of soot leads underground.']],
      'Royal Court': [['Royal Court', 'The doors to the high hall stand open.'], ['City Square', 'A bell rings over the empty market.']],
      'Fallen City': [['Fallen City', 'Rain runs down the broken city walls.'], ['Ancient Ruins', 'The old stones are still warm.']],
      'Throne Hall': [['Throne Hall', 'Boot prints lead toward the dais.'], ['Castle Gates', 'The outer gate is no longer guarded.']],
      'Volcanic Pass': [['Volcanic Pass', 'A path threads through the black rock.'], ['Fallen City', 'Fine ash blankets the empty streets.']],
      'Mountain Pass': [['Mountain Pass', 'A lone lantern burns above the switchback.'], ['Wayside Road', 'The old road bends back toward the hills.']],
      'Dune Sea': [['Dune Sea', 'The wind fills the tracks as you watch.'], ['Ancient Ruins', 'A wall rises out of the sand.']],
    };
    const local = paths[map];
    const spot = local?.[((stop - 1) % STOPS_PER_REGION + option) % local.length];
    if (spot) return { name: spot[0], flavour: spot[1] };
  }
  const [name, flavour] = kind === 'grave' || kind === 'altar' || kind === 'champion'
    ? SPECIAL[kind] : ROADS[(stop - 1 + option) % ROADS.length] ?? ROADS[0];
  return { name, flavour };
};
