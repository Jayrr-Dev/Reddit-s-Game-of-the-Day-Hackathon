// --- BOSS ARENAS ---
// Encounter IDs are stable across scenario names, and unlisted encounters
// keep the regional map and existing boss music.
import scene0 from '../assets/terrain/boss/zeruel-twin-eclipse-citadel.webp';
import score0 from '../assets/audio/boss/boss-zeruel-twin-eclipse.ogg';
import scene1 from '../assets/terrain/boss/fulgur-thunderbreak-roost.webp';
import score1 from '../assets/audio/boss/boss-fulgur-storm-roost.ogg';
import scene2 from '../assets/terrain/boss/cerviel-threefold-sanctum.webp';
import score2 from '../assets/audio/boss/boss-cerviel-threefold-sanctum.ogg';
import scene3 from '../assets/terrain/boss/mori-penitent-court.webp';
import score3 from '../assets/audio/boss/boss-mori-gilded-rampart.ogg';
import scene4 from '../assets/terrain/boss/azula-astral-archive.webp';
import score4 from '../assets/audio/boss/boss-azula-azure-crucible.ogg';
import scene5 from '../assets/terrain/boss/cherubiel-constellation-vault.webp';
import score5 from '../assets/audio/boss/boss-cherubiel-wheels-of-fire.ogg';
import scene6 from '../assets/terrain/boss/zadkiel-dominion-hall.webp';
import score6 from '../assets/audio/boss/boss-zadkiel-ivory-tribunal.ogg';
import scene7 from '../assets/terrain/boss/astra-silent-cloister.webp';
import score7 from '../assets/audio/boss/boss-astra-orbitarium.ogg';
import scene8 from '../assets/terrain/boss/cambiel-gilded-eclipse.webp';
import score8 from '../assets/audio/boss/boss-cambiel-gloam-vault.ogg';
import scene9 from '../assets/terrain/boss/geonosis-glacier-chapel.webp';
import score9 from '../assets/audio/boss/boss-geonosis-whitefall.ogg';
import scene10 from '../assets/terrain/boss/raziel-veiled-scriptorium.webp';
import score10 from '../assets/audio/boss/boss-raziel-eightfold-revelation.ogg';
import scene11 from '../assets/terrain/boss/holy-dragon-sunspire-aerie.webp';
import score11 from '../assets/audio/boss/boss-holy-dragon-sanctuary-wings.ogg';
import scene12 from '../assets/terrain/boss/vael-thunder-gorge.webp';
import score12 from '../assets/audio/boss/boss-tempest-wyrm-thunderhead.ogg';
import scene13 from '../assets/terrain/boss/holy-king-crown-basilica.webp';
import score13 from '../assets/audio/boss/boss-holy-king-last-crown.ogg';

export type BossArenaAmbience = 'stone' | 'highland' | 'civic';
export type BossArena = {
  name: string;
  image: string;
  scoreUrl: string;
  ambience: BossArenaAmbience;
  vanishingX: number;
  horizon: number;
};

export const BOSS_ARENAS: Readonly<Partial<Record<string, BossArena>>> = {
  zeruelArmored: { name: 'Twin Eclipse Citadel', image: scene0, scoreUrl: score0, ambience: 'stone', vanishingX: 50, horizon: 38 },
  archangelZeruel: { name: 'Twin Eclipse Citadel', image: scene0, scoreUrl: score0, ambience: 'stone', vanishingX: 50, horizon: 38 },
  fulgurDragonknight: { name: 'Thunderbreak Roost', image: scene1, scoreUrl: score1, ambience: 'highland', vanishingX: 50, horizon: 33 },
  cervielSword: { name: 'Threefold Sanctum', image: scene2, scoreUrl: score2, ambience: 'stone', vanishingX: 50, horizon: 37 },
  lightLordMori: { name: 'Penitent Court', image: scene3, scoreUrl: score3, ambience: 'stone', vanishingX: 50, horizon: 41 },
  mageBorneAzula: { name: 'Astral Archive', image: scene4, scoreUrl: score4, ambience: 'stone', vanishingX: 50, horizon: 41 },
  grandangelCherubiel: { name: 'Constellation Vault', image: scene5, scoreUrl: score5, ambience: 'highland', vanishingX: 50, horizon: 39 },
  zadkielOfDominations: { name: 'Dominion Hall', image: scene6, scoreUrl: score6, ambience: 'civic', vanishingX: 50, horizon: 39 },
  mageBorneAstra: { name: 'Silent Cloister', image: scene7, scoreUrl: score7, ambience: 'stone', vanishingX: 50, horizon: 40 },
  grandangelCambiel: { name: 'Gilded Eclipse', image: scene8, scoreUrl: score8, ambience: 'highland', vanishingX: 50, horizon: 36 },
  grandangelGeonosis: { name: 'Glacier Chapel', image: scene9, scoreUrl: score9, ambience: 'highland', vanishingX: 50, horizon: 40 },
  grandangelRaziel: { name: 'Veiled Scriptorium', image: scene10, scoreUrl: score10, ambience: 'stone', vanishingX: 50, horizon: 41 },
  holyDragon: { name: 'Sunspire Aerie', image: scene11, scoreUrl: score11, ambience: 'highland', vanishingX: 50, horizon: 40 },
  tempestWyrm: { name: 'Thunder Gorge', image: scene12, scoreUrl: score12, ambience: 'highland', vanishingX: 50, horizon: 43 },
  holyKing: { name: 'Crown Basilica', image: scene13, scoreUrl: score13, ambience: 'stone', vanishingX: 50, horizon: 40 },
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
