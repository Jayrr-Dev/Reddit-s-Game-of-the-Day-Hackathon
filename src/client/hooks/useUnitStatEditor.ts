// ===================================================================
// USE UNIT STAT EDITOR
// Draft values for an admin's stat edit on one unit, and the save and
// reset calls. A saved override becomes active on this client at once,
// so the stat list and the next fight use it without a reload.
// ===================================================================

import { useState } from 'react';
import { getCatalogHero, getHero, type HeroId } from '../../shared/game/heroes';
import type { HeroDef } from '../../shared/game/types';
import {
  EDITABLE_UNIT_STAT_IDS,
  setUnitOverrides,
  type EditableUnitStat,
  type UnitStatOverride,
} from '../../shared/game/unitOverrides';
import { apiClient } from '../lib/apiClient';

// --- TYPES ---
type Drafts = Record<EditableUnitStat, string>;
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// --- HELPERS ---
/** A hero definition's stats as editable text, one field per stat. */
const draftsOf = (hero: HeroDef): Drafts => ({
  maxHp: String(hero.maxHp),
  speed: String(hero.speed),
  armor: String(hero.armor ?? 0),
});

/** The drafts that differ from the catalog, as an override. */
const overrideFrom = (heroId: HeroId, drafts: Drafts): UnitStatOverride => {
  const catalog = draftsOf(getCatalogHero(heroId));
  return Object.fromEntries(
    EDITABLE_UNIT_STAT_IDS.filter((stat) => drafts[stat] !== catalog[stat]).map((stat) => [stat, Number(drafts[stat])])
  );
};

// --- HOOK ---
/** Draft stats for one unit plus save / reset against the server. */
export const useUnitStatEditor = (heroId: HeroId, onSaved: () => void) => {
  const [drafts, setDrafts] = useState(() => draftsOf(getHero(heroId)));
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  /** Changes one stat's draft text. */
  const setDraft = (stat: EditableUnitStat, value: string) => {
    setDrafts((previous) => ({ ...previous, [stat]: value }));
    setStatus('idle');
  };

  /** Sends the override (null resets), then activates the server's set. */
  const send = async (override: UnitStatOverride | null) => {
    setStatus('saving');
    try {
      const result = await apiClient.saveUnitStats({ heroId, override });
      setUnitOverrides(result.unitOverrides);
      setDrafts(draftsOf(getHero(heroId)));
      setStatus('saved');
      setError(null);
      onSaved();
    } catch (caught: unknown) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : 'Save failed');
    }
  };

  return {
    drafts,
    status,
    error,
    setDraft,
    save: () => send(overrideFrom(heroId, drafts)),
    reset: () => send(null),
  } as const;
};
