// ===================================================================
// FIELD WEATHER (DATA)
// Weather a hero brings to the battlefield while it stands on it (the
// scene itself, drawn by FieldWeather). Only the fights listed here
// have any; every other fight keeps a clear field.
// ===================================================================

import type { HeroId } from '../../shared/game/heroes';
import type { HeroUnit } from '../../shared/game/types';

// --- TYPES ---
export type Weather = 'mist';

// --- TABLE ---
const HERO_WEATHER: Partial<Record<HeroId, Weather>> = {
  // Vael's thunderhead spills over the whole field.
  tempestWyrm: 'mist',
};

// --- LOOKUP ---
/** The weather over a field: the first that any living hero brings. */
export const weatherOf = (
  heroes: readonly Pick<HeroUnit, 'heroId' | 'hp'>[]
): Weather | undefined =>
  heroes
    .filter((unit) => unit.hp > 0)
    .map((unit) => HERO_WEATHER[unit.heroId])
    .find((weather) => weather !== undefined);
