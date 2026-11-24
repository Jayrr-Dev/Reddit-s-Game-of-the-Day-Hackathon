// ===================================================================
// BOSS ENTRANCES (DATA)
// How each boss makes its entrance when it first takes the field: the
// epithet on its title card, and whether it descends from the sky or
// rises up from below. A boss without an entry gets DEFAULT_ENTRANCE,
// so every boss has one. Timings are shared by the overlay
// (BossEntrance), the boss's own arrival (HeroOnField) and index.css
// ("BOSS ENTRANCE"), which must match them.
// ===================================================================

import type { HeroId } from '../../shared/game/heroes';

// --- TYPES ---
export type BossArrival = 'descend' | 'rise';

export type BossEntrance = {
  /** A line under the name on the title card. */
  epithet: string;
  arrival: BossArrival;
};

// --- TIMING ---
/** The whole entrance, title card included (ms). */
export const BOSS_ENTRANCE_MS = 2600;
/** When the boss lands (ms): shake, dust, halo flare and HP bar fill. */
export const BOSS_LANDING_MS = 1300;

// --- TABLE ---
const DEFAULT_ENTRANCE: BossEntrance = {
  epithet: 'Champion of the Realm',
  arrival: 'rise',
};

const BOSS_ENTRANCES: Partial<Record<HeroId, BossEntrance>> = {
  holyDragon: { epithet: 'Wyrm of the Last Light', arrival: 'descend' },
  grandGriffon: { epithet: 'Talon of the High Sky', arrival: 'descend' },
};

// --- HELPERS ---
/** The entrance a boss makes (its own, or the default). */
export const bossEntranceOf = (heroId: HeroId): BossEntrance =>
  BOSS_ENTRANCES[heroId] ?? DEFAULT_ENTRANCE;
