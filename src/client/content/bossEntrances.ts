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
  line: string;
  arrival: BossArrival;
  durationMs?: number;
  landingMs?: number;
};

// --- TIMING ---
/** The whole entrance, title card included (ms). */
export const BOSS_ENTRANCE_MS = 7600;
/** When the boss lands (ms): shake, dust, halo flare and HP bar fill. */
export const BOSS_LANDING_MS = 1300;

// --- TABLE ---
const DEFAULT_ENTRANCE: BossEntrance = {
  epithet: 'Champion of the Realm',
  line: 'Lay down your arms. This road ends here.',
  arrival: 'rise',
};

const BOSS_ENTRANCES: Partial<Record<HeroId, BossEntrance>> = {
  holyDragon: { epithet: 'Wyrm of the Last Light', line: 'I kept this flame when your kingdom was ash.', arrival: 'descend', durationMs: 8400, landingMs: 2200 },
  grandGriffon: { epithet: 'Talon of the High Sky', line: 'Look up. You have crossed my shadow.', arrival: 'descend' },
};

// --- HELPERS ---
/** The entrance a boss makes (its own, or the default). */
export const bossEntranceOf = (heroId: HeroId): BossEntrance =>
  BOSS_ENTRANCES[heroId] ?? DEFAULT_ENTRANCE;
