// ===================================================================
// BOSS MOVE CUES (DATA)
// The sounds a boss's own moves make, by boss and move name, so a new
// boss gets a voice by adding a row here instead of code in the
// combat view. A move can sound at up to three moments:
//   charge  while a signature gathers, before anything lands
//   start   as the move begins (the wind-up or the swing)
//   impact  when it hits you, in place of the ordinary hit sound
// Moves without a row keep the shared sounds (blade, arrow, impact).
// ===================================================================

import type { HeroId } from '../../shared/game/heroes';
import type { Sound } from '../lib/gameAudio';

// --- TYPES ---
/** One sound and how loud to play it (0..1). */
export type Cue = { sound: Sound; gain: number };
export type MoveMoment = 'charge' | 'start' | 'impact';
type MoveCues = Partial<Record<MoveMoment, Cue>>;

// --- TABLE ---
const BOSS_MOVE_CUES: Partial<Record<HeroId, Record<string, MoveCues>>> = {
  sloth: { 'Basalt Layer': { start: { sound: 'armorUp', gain: 0.65 } }, 'Mountain Breaker': { impact: { sound: 'bluntImpact', gain: 0.9 } } },
  pride: { 'Royal Challenge': { start: { sound: 'buffMajor', gain: 0.75 } }, 'Sovereign’s Verdict': { charge: { sound: 'bossDescent', gain: 0.55 }, impact: { sound: 'bladeHit', gain: 0.88 } } },
  lust: { Beckon: { start: { sound: 'curse', gain: 0.65 } }, 'Velvet Thrall': { charge: { sound: 'hexTrigger', gain: 0.55 }, impact: { sound: 'magicArcaneHit', gain: 0.72 } } },
  gluttony: { 'Ravenous Lash': { start: { sound: 'move', gain: 0.60 } }, Devour: { charge: { sound: 'curse', gain: 0.68 }, impact: { sound: 'bluntImpact', gain: 0.92 } } },
  holyDragon: {
    'Halo of Judgment': { impact: { sound: 'uncUltimate', gain: 0.95 } },
  },
  grandGriffon: {
    'Heavenly Dive': {
      start: { sound: 'griffonDiveWhoosh', gain: 0.9 },
      impact: { sound: 'griffonDive', gain: 0.95 },
    },
  },
  tempestWyrm: {
    'Storm Spear': { start: { sound: 'tempestSpear', gain: 0.85 } },
    'Tempest Wings': { start: { sound: 'tempestWings', gain: 0.9 } },
    Thunderhead: { start: { sound: 'tempestThunder', gain: 0.85 } },
    'Storm Roar': { start: { sound: 'tempestRoar', gain: 0.95 } },
    'Sky Breaker': {
      charge: { sound: 'tempestCharge', gain: 0.85 },
      impact: { sound: 'tempestSkyBreaker', gain: 1 },
    },
  },
};

// --- LOOKUP ---
/** The sound a boss's move makes at one moment, if it has its own. */
export const bossMoveCue = (
  heroId: HeroId,
  moveName: string,
  moment: MoveMoment
): Cue | undefined => BOSS_MOVE_CUES[heroId]?.[moveName]?.[moment];
