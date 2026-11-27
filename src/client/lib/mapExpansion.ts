import { createContext, useContext } from 'react';
import { getWebViewMode } from '@devvit/web/client';
import { isHellArtifact, type HellArtifactId } from '../../shared/game/hellArtifacts';

export type MapHandoff = {
  selected?: { at: number; option: number };
  local?: boolean;
  world?: boolean;
  browseRegion?: number;
  artifact?: HellArtifactId | 'accepted';
};
export const MapExpansionScope = createContext<string | undefined>(undefined);
export const useMapExpansionScope = () => useContext(MapExpansionScope);
const handoffKey = (scope: string) => 'villain-arc:expanded-map:' + scope;
const HANDOFF_TTL_MS = 60_000;

/** The SDK is only initialized inside Reddit's interactive post. */
export function redditViewMode() {
  try { return getWebViewMode(); } catch { return undefined; }
}

/** A short-lived, run-scoped bookmark restores map navigation on entry reload. */
export function readMapHandoff(scope?: string): MapHandoff | undefined {
  if (!scope || redditViewMode() !== 'expanded') return undefined;
  try {
    const v = JSON.parse(localStorage.getItem(handoffKey(scope)) ?? 'null');
    if (!v || !Number.isFinite(v.expires) || v.expires < Date.now()) return undefined;
    return {
      ...(Number.isSafeInteger(v.selected?.at) && Number.isSafeInteger(v.selected?.option) && {
        selected: { at: v.selected.at, option: v.selected.option },
      }),
      ...(v.local === true && { local: true }),
      ...(v.world === true && { world: true }),
      ...(Number.isSafeInteger(v.browseRegion) && v.browseRegion >= 0 && v.browseRegion < 9 && { browseRegion: v.browseRegion }),
      ...((isHellArtifact(v.artifact) || v.artifact === 'accepted') && { artifact: v.artifact }),
    };
  } catch { return undefined; }
}

/** Save before calling Devvit, within the original click gesture. */
export function writeMapHandoff(scope: string, view: MapHandoff) {
  localStorage.setItem(handoffKey(scope), JSON.stringify({ ...view, expires: Date.now() + HANDOFF_TTL_MS }));
}

// Scope is an account/day/attempt tuple, never comparable across users.
export const mapExpansionScope = (account: string | undefined, day: string, attempt: number, id?: string) =>
  JSON.stringify([account ?? 'guest', day, attempt, id ?? null]);
