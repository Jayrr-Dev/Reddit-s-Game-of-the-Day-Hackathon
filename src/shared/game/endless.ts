import { beginAreaBattle, createRun, isRunOver, runReducer, type RunAction, type RunState } from './run.ts';
import type { CardId } from './cards.ts';
import type { AreaSite } from './conquestAreas.ts';
import { buildEndlessWaves } from './endlessWaves.ts';
import { stopLocation } from './routeLocation.ts';
import { characterEdit } from './playerBuild.ts';
import { isRunAction } from './run.ts';
import { isRingIndex, type RingProgress } from './character.ts';
import { shopRingIds, type ShopRingId } from './ringShop.ts';
import type { StarterName } from './starters.ts';

export const ENDLESS_BATTLE_VERSION = 1;
export type EndlessProfile = { wins: number; xpStartWins?: number | undefined; bonusXp?: number | undefined;
  shopRings: ShopRingId[]; rings: RingProgress; edits: RunAction[] };

/** Read the profile baseline pinned at Wave 1, not any later changes to the account. */
export function restoreEndlessProfile(value: unknown): EndlessProfile | undefined {
  const counter = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  if (!value || typeof value !== 'object' || !('wins' in value) || !counter(value.wins) ||
      !('edits' in value) || !Array.isArray(value.edits) || value.edits.length > 1024 ||
      !value.edits.every(edit => isRunAction(edit) && characterEdit(edit))) return undefined;
  const rings = 'rings' in value && value.rings && typeof value.rings === 'object' ? value.rings : {};
  return { wins: value.wins, edits: value.edits,
    shopRings: shopRingIds('shopRings' in value ? value.shopRings : []),
    rings: { bossWins: 'bossWins' in rings && counter(rings.bossWins) ? rings.bossWins : 0,
      rareSlots: 'rareSlots' in rings && Array.isArray(rings.rareSlots) ? rings.rareSlots.filter(isRingIndex) : [] },
    xpStartWins: 'xpStartWins' in value && counter(value.xpStartWins) ? value.xpStartWins : undefined,
    bonusXp: 'bonusXp' in value && counter(value.bonusXp) ? value.bonusXp : undefined };
}

/** Legacy Endless logs keep their old stop-per-wave numbering. */
export function endlessWaveNumber(run: RunState): number {
  return run.area ? (run.area.waveBase ?? 0) + run.area.wave + 1 : run.stop;
}

/** Include finished reinforcements in the live score before the battle settles. */
export function endlessClearedWaves(run: RunState): number {
  return run.stats.wavesCleared + (run.phase.kind === 'combat' && run.area
    ? (run.area.waveBase ?? 0) + run.area.wave + Number(!!(run.area.wavePending || run.area.respite)) : 0);
}

/** Open one continuous arena; only the reinforcement queue is refilled. */
function startOnslaught(run: RunState): RunState {
  const map = stopLocation(1, 0, 'horde').name;
  const site: AreaSite = { name: map, map, kind: 'field', flavour: '' };
  const battle = buildEndlessWaves(run.dailyKey, 0);
  return beginAreaBattle(run, { site, stop: { kind: 'champion', heroIds: [] }, battles: [battle], battle: 0, wave: 0 });
}

/** Endless uses the day's seeded battles without campaign routing or a final stop. */
export function createEndless(day: string, deck?: readonly CardId[], battleVersion?: typeof ENDLESS_BATTLE_VERSION, profile?: EndlessProfile, starterClass?: StarterName): RunState {
  const starter = createRun(day + ':endless', profile?.rings, 0, profile?.wins ?? 0, profile?.shopRings ?? [],
    undefined, 1, undefined, false, undefined, profile?.xpStartWins, false, profile?.bonusXp);
  const fresh = profile?.edits.reduce(runReducer, starter) ?? starter;
  const run = deck ? { ...fresh, deck: [...deck], ...(starterClass && { rewardStarter: starterClass }) } : fresh;
  return battleVersion === ENDLESS_BATTLE_VERSION ? startOnslaught(run)
    : runReducer(run, { type: 'chooseStop', option: 0 });
}

/** The first seeded path is always a fight, including a champion every fifth wave. */
export function reduceEndless(run: RunState, action: RunAction): RunState {
  if (isRunOver(run) || action.type === 'chooseStop' || action.type === 'chooseRegion') return run;
  const next = runReducer(run, action);
  if (run.phase.kind === 'combat' && run.area && action.type === 'abandon') {
    return { ...next, stats: { ...next.stats, wavesCleared: endlessClearedWaves(run),
      heroesSlain: next.stats.heroesSlain + run.phase.combat.slain } };
  }
  return next !== run && next.phase.kind === 'route'
    ? runReducer(next, { type: 'chooseStop', option: 0 })
    : next;
}
