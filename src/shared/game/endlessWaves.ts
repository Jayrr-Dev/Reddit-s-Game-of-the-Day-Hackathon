import type { AreaBattle } from './conquestAreas.ts';
import { CHAMPION_IDS, ELITE_IDS, GRUNT_IDS, type HeroId } from './heroes.ts';
import { BATTLE_WAVES } from './battleTiers.ts';
import { hashSeed, pickOne } from './rng.ts';

const MOB_POOL: readonly HeroId[] = [...GRUNT_IDS, 'angelArcher', 'wingedArcher', 'angelAssassin', 'angelMage'];
const VETERAN_POOL: readonly HeroId[] = [...ELITE_IDS, 'stormLancer', 'swordPrelate', 'hornedSentinel', 'ivoryWerewolf'];

/** Refill five waves at a time; batches are only storage, never a combat reset. */
export function buildEndlessWaves(day: string, cleared: number): AreaBattle {
  const waves = Array.from({ length: BATTLE_WAVES.skirmish }, (_, index) => {
    const wave = cleared + index + 1;
    const size = Math.min(6, 1 + Math.floor((wave + 1) / 4));
    const checkpoint = wave % BATTLE_WAVES.skirmish === 0;
    const heroIds = Array.from({ length: size }, (_, slot) => {
      const pool = checkpoint && slot === 0 ? CHAMPION_IDS
        : wave >= 8 && (wave + slot) % 4 === 0 ? VETERAN_POOL : MOB_POOL;
      return pickOne(hashSeed(day + ':wave:' + wave + ':' + slot), pool)[0];
    });
    return { name: checkpoint ? 'Officer' : 'Reinforcements', heroIds, might: 0.65 + wave * 0.075 };
  });
  return { waves, finish: 'endless-boss', rooms: 0, secrets: 0 };
}
