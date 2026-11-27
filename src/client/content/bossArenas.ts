// --- BOSS ARENAS ---
// Encounter IDs are stable across scenario names, and unlisted encounters
// keep the regional map. Every boss plays the shared boss theme (mapAudio).
import scene0 from '../assets/terrain/boss/zeruel-twin-eclipse-citadel.webp';
import scene1 from '../assets/terrain/boss/fulgur-thunderbreak-roost.webp';
import scene2 from '../assets/terrain/boss/cerviel-threefold-sanctum.webp';
import scene3 from '../assets/terrain/boss/mori-penitent-court.webp';
import scene4 from '../assets/terrain/boss/azula-astral-archive.webp';
import scene5 from '../assets/terrain/boss/cherubiel-constellation-vault.webp';
import scene6 from '../assets/terrain/boss/zadkiel-dominion-hall.webp';
import scene7 from '../assets/terrain/boss/astra-silent-cloister.webp';
import scene8 from '../assets/terrain/boss/cambiel-gilded-eclipse.webp';
import scene9 from '../assets/terrain/boss/geonosis-glacier-chapel.webp';
import scene10 from '../assets/terrain/boss/raziel-veiled-scriptorium.webp';
import scene11 from '../assets/terrain/boss/holy-dragon-sunspire-aerie.webp';
import scene12 from '../assets/terrain/boss/vael-thunder-gorge-cloud-floor.webp';
import scene13 from '../assets/terrain/boss/holy-king-crown-basilica.webp';
import taxiarchArena from '../assets/terrain/boss/mikhael-ruined-citadel.webp';

import slothArena from '../assets/terrain/cave.webp';
import prideArena from '../assets/terrain/royal-court.webp';
import lustArena from '../assets/terrain/monastery.webp';
import gluttonyArena from '../assets/terrain/dungeon.webp';

export type BossArenaAmbience = 'stone' | 'highland' | 'civic';
export type BossArena = {
  name: string;
  image: string;
  ambience: BossArenaAmbience;
  vanishingX: number;
  horizon: number;
  motion?: 'taxiarch';
};

export const BOSS_ARENAS: Readonly<Partial<Record<string, BossArena>>> = {
  sloth: { name: 'Basalt Hollows', image: slothArena, ambience: 'stone', vanishingX: 50, horizon: 38 },
  pride: { name: 'Hall of Mirrors', image: prideArena, ambience: 'stone', vanishingX: 50, horizon: 38 },
  lust: { name: 'The Veiled Sanctuary', image: lustArena, ambience: 'stone', vanishingX: 50, horizon: 38 },
  gluttony: { name: 'The Hollow Maw', image: gluttonyArena, ambience: 'stone', vanishingX: 50, horizon: 38 },
  archangelMikhael: { name: 'The Last Citadel', image: taxiarchArena, ambience: 'stone', vanishingX: 50, horizon: 51, motion: 'taxiarch' },
  archangelZeruel: { name: 'Twin Eclipse Citadel', image: scene0, ambience: 'stone', vanishingX: 50, horizon: 38 },
  fulgurDragonknight: { name: 'Thunderbreak Roost', image: scene1, ambience: 'highland', vanishingX: 50, horizon: 33 },
  cervielSword: { name: 'Threefold Sanctum', image: scene2, ambience: 'stone', vanishingX: 50, horizon: 37 },
  lightLordMori: { name: 'Penitent Court', image: scene3, ambience: 'stone', vanishingX: 50, horizon: 41 },
  mageBorneAzula: { name: 'Astral Archive', image: scene4, ambience: 'stone', vanishingX: 50, horizon: 41 },
  grandangelCherubiel: { name: 'Constellation Vault', image: scene5, ambience: 'highland', vanishingX: 50, horizon: 39 },
  zadkielOfDominations: { name: 'Dominion Hall', image: scene6, ambience: 'civic', vanishingX: 50, horizon: 39 },
  mageBorneAstra: { name: 'Silent Cloister', image: scene7, ambience: 'stone', vanishingX: 50, horizon: 40 },
  grandangelCambiel: { name: 'Gilded Eclipse', image: scene8, ambience: 'highland', vanishingX: 50, horizon: 36 },
  grandangelGeonosis: { name: 'Glacier Chapel', image: scene9, ambience: 'highland', vanishingX: 50, horizon: 40 },
  grandangelRaziel: { name: 'Veiled Scriptorium', image: scene10, ambience: 'stone', vanishingX: 50, horizon: 41 },
  holyDragon: { name: 'Sunspire Aerie', image: scene11, ambience: 'highland', vanishingX: 50, horizon: 40 },
  tempestWyrm: { name: 'Thunder Gorge', image: scene12, ambience: 'highland', vanishingX: 50, horizon: 43 },
  holyKing: { name: 'Crown Basilica', image: scene13, ambience: 'stone', vanishingX: 50, horizon: 40 },
};

/** One item per arena even when several forms share the same stage. */
export const TRAINING_BOSS_ARENAS = [...new Map(
  Object.values(BOSS_ARENAS).filter((arena): arena is BossArena => arena !== undefined)
    .map(arena => [arena.name, arena] as const)
).values()];

/** Keeps an encounter's arena after its boss falls, until the wave changes. */
export const bossArenaOf = (active: readonly string[], fallen: readonly string[] = []): BossArena | undefined => {
  const arenaId = [...active, ...fallen].find(id => Object.hasOwn(BOSS_ARENAS, id));
  return arenaId === undefined ? undefined : BOSS_ARENAS[arenaId];
};
