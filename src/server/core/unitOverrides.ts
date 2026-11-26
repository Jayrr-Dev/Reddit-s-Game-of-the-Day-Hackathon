// ===================================================================
// UNIT OVERRIDES (SERVER)
// Loads and saves the admin's unit stat overrides in Redis, and makes
// them active for the shared game rules so the server's run replay uses
// the same stats the players saw.
// ===================================================================

import { redis } from '@devvit/web/server';
import {
  isUnitStatOverrides,
  setUnitOverrides,
  withUnitOverride,
  type UnitStatOverride,
  type UnitStatOverrides,
} from '../../shared/game/unitOverrides';
import { redisKeys } from './redisKeys';

// --- LOAD ---
/** Reads the saved overrides; anything malformed counts as none. */
export const loadUnitOverrides = async (): Promise<UnitStatOverrides> => {
  const raw = await redis.get(redisKeys.unitOverrides());
  const data: unknown = raw ? JSON.parse(raw) : {};
  return isUnitStatOverrides(data) ? data : {};
};

/** Loads the saved overrides and makes them active for getHero. */
export const activateUnitOverrides = async (): Promise<UnitStatOverrides> => {
  const overrides = await loadUnitOverrides();
  setUnitOverrides(overrides);
  return overrides;
};

// --- SAVE ---
/** Saves one unit's override (null resets it) and returns the new set. */
export const saveUnitOverride = async (
  heroId: string,
  override: UnitStatOverride | null
): Promise<UnitStatOverrides> => {
  const next = withUnitOverride(await loadUnitOverrides(), heroId, override);
  await redis.set(redisKeys.unitOverrides(), JSON.stringify(next));
  setUnitOverrides(next);
  return next;
};
