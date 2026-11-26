import type { HeroId } from './heroes.ts';

// --- DEFEAT VOICES ---
// Explicit routing keeps creature and siege units out of the human voice pools.
export const deathVoiceCues = {
  low: ['deathHumanLowA', 'deathHumanLowB'],
  mid: ['deathHumanMidA', 'deathHumanMidB'],
  grit: ['deathHumanGritA', 'deathHumanGritB'],
  breath: ['deathHumanBreathA', 'deathHumanBreathB'],
  sol: ['deathBossSol'],
  rio: ['deathBossRio'],
} as const;

type DeathVoice = keyof typeof deathVoiceCues;
const deathVoiceByHero: Partial<Record<HeroId, DeathVoice>> = {
  swordPrelate: 'low',
  hornedSentinel: 'low',
  stormLancer: 'grit',
  holyKing: 'low',
  squire: 'mid',
  bard: 'mid',
  archer: 'mid',
  priest: 'low',
  shieldmaiden: 'grit',
  rogue: 'breath',
  paladin: 'low',
  archmage: 'low',
  holt: 'low',
  lysa: 'breath',
  maren: 'breath',
  brannoc: 'low',
  seris: 'grit',
  valen: 'mid',
  holyDragon: 'sol',
  grandGriffon: 'rio',
};

/** Looks up the intended voice family; unvoiced units stay silent. */
export const deathVoiceOf = (heroId: HeroId): DeathVoice | undefined => deathVoiceByHero[heroId];

type Combatant = { uid: number; hp: number; heroId: HeroId };

/** Reads the living-to-defeated edge, allowing the engine to remove defeated units. */
export const fallenWithDeathVoice = (before: readonly Combatant[], after: readonly Combatant[]) => {
  const remainingHPByUid = new Map(after.map(unit => [unit.uid, unit.hp]));
  return before.filter(unit => unit.hp > 0 && deathVoiceOf(unit.heroId) !== undefined &&
    (remainingHPByUid.get(unit.uid) ?? 0) <= 0);
};
