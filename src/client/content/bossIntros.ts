// ===================================================================
// BOSS INTROS (CONFIG)
// The one place that says which intro animation each boss plays when
// it first takes the field. BOSS_INTROS lists the reusable intros;
// BOSS_INTRO_BY_HERO picks one for each boss. Any boss can use any
// intro, and a boss not listed plays DEFAULT_BOSS_INTRO.
//
// To add an intro: add its id to BossIntroId, describe it in
// BOSS_INTROS, and give it keyframes in index.css under
// "BOSS ENTRANCE", keyed by [data-boss-intro='<id>'] on the boss's
// stage (see HeroOnField). Then assign it to bosses below.
//
// The title card, line and voice of each boss stay in bossEntrances.ts:
// they belong to the boss, while the motion here is shared.
// ===================================================================

import type { HeroId } from '../../shared/game/heroes';

// --- TYPES ---
export type BossIntroId = 'crashLanding' | 'riseFromBelow';

export type BossIntro = {
  /** The name Sam uses for it. */
  name: string;
  /** What the boss does on screen. */
  description: string;
  /** Plays the descent whoosh and the touchdown thud (BossEntrance). */
  hasFallSounds: boolean;
};

// --- INTRO LIST ---
export const BOSS_INTROS: Record<BossIntroId, BossIntro> = {
  crashLanding: {
    name: 'Crash Landing',
    description: 'Drops from the sky and slams down: shake, dust and a halo flare.',
    hasFallSounds: true,
  },
  riseFromBelow: {
    name: 'Rise From Below',
    description: 'Climbs up out of the ground and lands with the same shake and dust.',
    hasFallSounds: false,
  },
};

// --- BOSS -> INTRO ---
/** Played by any boss not listed in BOSS_INTRO_BY_HERO. */
const DEFAULT_BOSS_INTRO: BossIntroId = 'riseFromBelow';

const BOSS_INTRO_BY_HERO: Partial<Record<HeroId, BossIntroId>> = {
  sloth: 'riseFromBelow',
  pride: 'crashLanding',
  lust: 'riseFromBelow',
  gluttony: 'riseFromBelow',
  mageBorneAstra: 'riseFromBelow',
  grandangelCambiel: 'riseFromBelow',
  mageBorneAzula: 'riseFromBelow',
  twinAxeKnight: 'riseFromBelow',
  cervielSword: 'crashLanding',
  archangelZeruel: 'crashLanding',
  grandangelRaziel: 'crashLanding',
  grandangelGeonosis: 'crashLanding',
  zadkielOfDominations: 'crashLanding',
  fulgurDragonknight: 'crashLanding',
  grandangelCherubiel: 'crashLanding',
  lightLordMori: 'crashLanding',
  angelAssassin: 'crashLanding',
  archangelUriel: 'crashLanding',
  archangelMikhael: 'crashLanding',
  holyDragon: 'crashLanding',
  tempestWyrm: 'crashLanding',
  grandGriffon: 'crashLanding',
};

// --- HELPERS ---
/** The id of the intro a boss plays (its own, or the default). */
export const bossIntroIdOf = (heroId: HeroId): BossIntroId =>
  BOSS_INTRO_BY_HERO[heroId] ?? DEFAULT_BOSS_INTRO;

/** The intro a boss plays. */
export const bossIntroOf = (heroId: HeroId): BossIntro =>
  BOSS_INTROS[bossIntroIdOf(heroId)];
