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
  holyKing: {
    epithet: 'The Hallowed Crown',
    line: 'You have come for my throne. Do not mistake the people beneath it for the crown.',
  },
  greed: {
    epithet: 'The Gilded Hoarder',
    line: 'I would not put a price on that fury. I wonder what it cost you.',
  },
  envy: {
    epithet: 'The Borrowed Face',
    line: 'I wanted to know what Xatan saw in you. I can feel it now.',
  },
  mageBorneAstra: {
    epithet: 'Oracle of the Silent Choir',
    line: 'I heard the Seer. I stayed to see if the stars were wrong.',
  },
  cervielSword: {
    epithet: 'One Will in Three Forms',
    line: 'Three of me, and still they asked who would guard the children.',
  },
  grandangelCambiel: {
    epithet: 'The Gilded Shade',
    line: 'I would strip off every piece of gold if it bought them time.',
  },
  archangelZeruel: {
    epithet: 'Bearer of the Violet Halos',
    line: 'The two at my back are under my wing. Take one more step.',
  },
  grandangelRaziel: {
    epithet: 'Keeper of the Unspoken',
    line: 'The stake has been cold for years. You still smell of smoke.',
  },
  grandangelGeonosis: {
    epithet: 'Harbinger of Whitefall',
    line: 'A ruined city makes no sound. I will not hear that silence twice.',
  },
  zadkielOfDominations: {
    epithet: 'Voice of the Divine Edict',
    line: 'They called it heresy. Is your verdict meant to be any kinder?',
  },
  fulgurDragonknight: {
    epithet: 'The Storm Made Flesh',
    line: 'The road behind you is empty. This one still has people on it.',
  },
  grandangelCherubiel: {
    epithet: 'Warden of the Broken Halo',
    line: 'Look at this halo. You can break a thing and still fail to make it kneel.',
  },
  mageBorneAzula: {
    epithet: 'The Sevenfold Oracle',
    line: 'In every future where I turn away, someone else has to stand here.',
  },
  lightLordMori: {
    epithet: 'Keeper of the Last Light',
    line: 'My knights put their faith in me. I will not spend their lives to save my own.',
  },
  angelAssassin: { epithet: 'Blade Behind the Veil', line: 'If I can end this unseen, no one else has to draw a blade.' },
  twinAxeKnight: { epithet: 'The Gilded Headsman', line: 'The crown can lose its throne. My soldiers cannot lose another home.' },
  archangelUriel: { epithet: 'Warden of the Crimson Gate', line: 'I will not ask you to forgive them. I am asking you to let these people pass.' },
  zeruelArmored: { epithet: 'The Ivory Eclipse', line: 'The throne was never what you came for. You go no higher.' },
  sloth: { epithet: 'The Unmoving', line: 'I felt you coming through the stone. The old one never shook me awake.' },
  pride: { epithet: 'The Fallen Sovereign', line: 'Seven hundred years. I thought no one could take his seat. Now I feel why it is yours.' },
  lust: { epithet: 'The Veiled Apparition', line: 'I feel what you want. If they all die, will she be any less gone?' },
  gluttony: { epithet: 'The Hollow Hunger', line: 'I can taste it from here. Even I know when a hunger is too big to feed.' },
  holyDragon: { epithet: 'Wyrm of the Last Light', line: 'I kept this flame when your kingdom was ash.', durationMs: 9200, landingMs: 2200, voice: { cue: 'bossUncVoice', durationMs: 4330 } },
  tempestWyrm: { epithet: 'Spear of the Breaking Sky', line: 'They will have the wind at their backs until the last of them is across.', landingMs: 2200 },
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
