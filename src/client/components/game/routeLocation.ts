import type { StopKind } from '../../../shared/game/kingdom';
import { stopLocation } from '../../../shared/game/routeLocation';
import { MAP_NAMES } from './combat/Backdrop';

/** A stop's map name and flavour, plus its backdrop index for the client. */
export function routeLocation(stop: number, option: number, kind: StopKind) {
  const { name, flavour } = stopLocation(stop, option, kind);
  return { name, flavour, terrain: MAP_NAMES.indexOf(name) };
}
