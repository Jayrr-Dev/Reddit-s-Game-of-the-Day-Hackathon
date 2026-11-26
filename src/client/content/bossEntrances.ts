// ===================================================================
// BOSS ENTRANCES (DATA)
// How each boss makes its entrance when it first takes the field: the
// epithet on its title card, its line and voice. Which intro animation
// it plays is set in bossIntros.ts. A boss without an entry gets
// DEFAULT_ENTRANCE, so every boss has one. Timings are shared by the overlay
// (BossEntrance), the boss's own arrival (HeroOnField) and index.css
// ("BOSS ENTRANCE"), which must match them.
// ===================================================================

import type { HeroId } from '../../shared/game/heroes';

// --- TYPES ---
export type BossEntrance = {
  /** A line under the name on the title card. */
  epithet: string;
  line: string;
  durationMs?: number;
  landingMs?: number;
  voice?: {
    cue: 'bossUncVoice' | 'bossRioVoice';
    /** End of the spoken line, not including any non-verbal reaction. */
    durationMs: number;
    captions?: readonly { text: string; startMs: number; endMs: number }[];
  };
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
};

const BOSS_ENTRANCES: Partial<Record<HeroId, BossEntrance>> = {
  mageBorneAstra: {
    epithet: 'Oracle of the Silent Choir',
    line: 'Hush. The stars are listening.',
  },
  cervielSword: {
    epithet: 'One Will in Three Forms',
    line: 'One purpose. Three forms. No escape.',
  },
  grandangelCambiel: {
    epithet: 'The Gilded Shade',
    line: 'Even gold casts a shadow.',
  },
  archangelZeruel: {
    epithet: 'Bearer of the Violet Halos',
    line: 'I did not descend to bargain.',
  },
  grandangelRaziel: {
    epithet: 'Keeper of the Unspoken',
    line: 'What you hide has always been known to me.',
  },
  grandangelGeonosis: {
    epithet: 'Harbinger of Whitefall',
    line: 'The silence comes first. Then the frost.',
  },
  zadkielOfDominations: {
    epithet: 'Voice of the Divine Edict',
    line: 'In this court, the last word is mine.',
  },
  fulgurDragonknight: {
    epithet: 'The Storm Made Flesh',
    line: 'The sky has already chosen where you fall.',
  },
  grandangelCherubiel: {
    epithet: 'Warden of the Broken Halo',
    line: 'My halo was broken. My judgment was not.',
  },
  mageBorneAzula: {
    epithet: 'The Sevenfold Oracle',
    line: 'Seven eyes. Every possible future ends here.',
  },
  lightLordMori: {
    epithet: 'Keeper of the Last Light',
    line: 'Kneel. The last light does not forgive.',
  },
  angelAssassin: { epithet: 'Blade Behind the Veil', line: 'One shadow is all I need.' },
  twinAxeKnight: { epithet: 'The Gilded Headsman', line: 'I bring a verdict with both hands.' },
  archangelUriel: { epithet: 'Warden of the Crimson Gate', line: 'Stand before the flame and be weighed.' },
  zeruelArmored: { epithet: 'The Ivory Eclipse', line: 'The two suns bear witness.' },
  sloth: { epithet: 'The Unmoving', line: 'All your fury, and the mountain has not moved.' },
  pride: { epithet: 'The Fallen Sovereign', line: 'Look up. You stand before a sovereign.' },
  lust: { epithet: 'The Veiled Apparition', line: 'Tell me what you want. Leave out the lies.' },
  gluttony: { epithet: 'The Hollow Hunger', line: 'Bring me what you have left.' },
  holyDragon: { epithet: 'Wyrm of the Last Light', line: 'I kept this flame when your kingdom was ash.', durationMs: 9200, landingMs: 2200, voice: { cue: 'bossUncVoice', durationMs: 4330 } },
  tempestWyrm: { epithet: 'Spear of the Breaking Sky', line: 'The storm bows to no one. Least of all to you.', landingMs: 2200 },
  grandGriffon: {
    epithet: 'Talon of the High Sky',
    line: 'Demon, we meet again. You came for vengeance. So did I. For my master!',
    durationMs: 12800,
    voice: {
      cue: 'bossRioVoice',
      durationMs: 7850,
      captions: [
        { text: 'Demon, we meet again.', startMs: 0, endMs: 2400 },
        { text: 'You came for vengeance.', startMs: 3000, endMs: 4600 },
        { text: 'So did I.', startMs: 5050, endMs: 6100 },
        { text: 'FOR MY MASTER!', startMs: 6500, endMs: 7800 },
      ],
    },
  },
};

// --- HELPERS ---
/** The entrance a boss makes (its own, or the default). */
export const bossEntranceOf = (heroId: HeroId): BossEntrance =>
  BOSS_ENTRANCES[heroId] ?? DEFAULT_ENTRANCE;
