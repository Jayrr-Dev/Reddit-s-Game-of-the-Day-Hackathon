// ===================================================================
// UNLOCKS
// What a player has earned in runs, which opens up Illusion Training:
//   - a unit can be fought once the player has killed it in a run
//   - a scenario shows once every unit in it has been killed
//   - a card can go in a custom deck once it was in the run deck
//   - a map shows once the player has been on it in a run
// The server derives these from the run log it already replays to
// verify scores, so a client can never claim an unlock it didn't earn.
// Admins see everything: the client passes `null` for "all unlocked".
// ===================================================================

import { isCardId, STARTER_DECK, type CardId } from './cards.ts';
import { CUSTOM_DECK_LIMIT } from './sandboxDecks.ts';
import { HEROES, type HeroId } from './heroes.ts';
import { chosenRegion } from './regionRoutes.ts';
import { stopLocation } from './routeLocation.ts';
import { runReducer, type RunAction, type RunState } from './run.ts';
import type { CombatState } from './types.ts';

// --- TYPES ---
/** One player's unlocks, as saved in Redis. Every list is a set. */
export type Unlocks = {
  /** Heroes the player has killed at least once. */
  killedUnits: HeroId[];
  /** Heroes the player has fought (opens a boss's arena map). */
  facedUnits: HeroId[];
  /** Cards that were in the player's deck during a run. */
  deckCards: CardId[];
  /** Region map names the player has been on (see routeLocation.ts). */
  visitedMaps: string[];
};

/** The unlocks the viewer plays with; null means everything (admins). */
export type UnlockAccess = Unlocks | null;

// --- CONSTANTS ---
export const EMPTY_UNLOCKS: Unlocks = { killedUnits: [], facedUnits: [], deckCards: [], visitedMaps: [] };

// --- VALIDATION ---
/** True for a catalog hero id. */
export const isHeroId = (value: unknown): value is HeroId =>
  typeof value === 'string' && Object.hasOwn(HEROES, value);

/** True for an array whose every item passes the guard. */
const isListOf = <T>(value: unknown, guard: (item: unknown) => item is T): value is T[] =>
  Array.isArray(value) && value.every(guard);

/** True for a string (map names). */
const isString = (value: unknown): value is string => typeof value === 'string';

/** Type guard for a saved unlocks record. */
export const isUnlocks = (value: unknown): value is Unlocks =>
  typeof value === 'object' && value !== null &&
  'killedUnits' in value && isListOf(value.killedUnits, isHeroId) &&
  'facedUnits' in value && isListOf(value.facedUnits, isHeroId) &&
  'deckCards' in value && isListOf(value.deckCards, isCardId) &&
  'visitedMaps' in value && isListOf(value.visitedMaps, isString);

// --- MERGING ---
/** Every item of both lists, once each, in first-seen order. */
const union = <T>(a: readonly T[], b: readonly T[]): T[] => [...new Set([...a, ...b])];

/** Both records' unlocks together (unlocks are never lost). */
export const mergeUnlocks = (a: Unlocks, b: Unlocks): Unlocks => ({
  killedUnits: union(a.killedUnits, b.killedUnits),
  facedUnits: union(a.facedUnits, b.facedUnits),
  deckCards: union(a.deckCards, b.deckCards),
  visitedMaps: union(a.visitedMaps, b.visitedMaps),
});

/** True when `next` adds something `saved` doesn't have (skip a no-op write). */
export const addsUnlocks = (saved: Unlocks, next: Unlocks): boolean => {
  const merged = mergeUnlocks(saved, next);
  return merged.killedUnits.length !== saved.killedUnits.length ||
    merged.facedUnits.length !== saved.facedUnits.length ||
    merged.deckCards.length !== saved.deckCards.length ||
    merged.visitedMaps.length !== saved.visitedMaps.length;
};

// --- FROM A RUN ---
/** Hero ids of the units in a list (killed, standing). */
const heroIdsOf = (units: readonly { heroId: HeroId }[]): HeroId[] => units.map((unit) => unit.heroId);

/** The fight in progress, if the run is in one. */
const combatOf = (state: RunState): CombatState | undefined =>
  state.phase.kind === 'combat' ? state.phase.combat : undefined;

/**
 * Heroes killed by one step. A won fight is discarded by the run reducer,
 * so its last kills are read from the fight before the winning action:
 * a fight is won when no hero stands, so everyone still standing fell.
 */
const killsOfStep = (before: RunState, after: RunState): HeroId[] => {
  const during = combatOf(after);
  if (during) return heroIdsOf(during.fallen);
  const lostFight = after.phase.kind === 'fallen' ? after.phase.battlefield?.combat : undefined;
  if (lostFight) return heroIdsOf(lostFight.fallen);
  const wonFight = after.phase.kind === 'reward' || after.phase.kind === 'sealing' ? combatOf(before) : undefined;
  return wonFight ? [...heroIdsOf(wonFight.fallen), ...heroIdsOf(wonFight.heroes)] : [];
};

/** The map and heroes of a stop the step just entered, if it entered one. */
const stopOfStep = (before: RunState, action: RunAction): Pick<Unlocks, 'facedUnits' | 'visitedMaps'> => {
  if (action.type !== 'chooseStop' || before.phase.kind !== 'route') return { facedUnits: [], visitedMaps: [] };
  const stop = before.phase.options[action.option];
  if (!stop) return { facedUnits: [], visitedMaps: [] };
  return {
    facedUnits: [...stop.heroIds],
    visitedMaps: [stop.site?.map ?? stopLocation(before.stop, action.option, stop.kind, chosenRegion(before)).name],
  };
};

/** What one replayed step unlocks. */
const unlocksOfStep = (before: RunState, action: RunAction, after: RunState): Unlocks => {
  const entered = stopOfStep(before, action);
  const beforeUids = new Set(combatOf(before)?.heroes.map(hero => hero.uid));
  const shown = combatOf(after)?.heroes ?? [];
  const newBattle = before.phase.kind !== 'combat';
  return {
    ...entered,
    facedUnits: [...entered.facedUnits, ...heroIdsOf(newBattle ? shown : shown.filter(hero => !beforeUids.has(hero.uid)))],
    killedUnits: killsOfStep(before, after),
    deckCards: [...after.deck],
  };
};

/**
 * Replays a run log from `start` and returns the final state with
 * everything the run unlocked. Imperative on purpose: each step's
 * unlocks depend on the state before and after it.
 */
export const replayWithUnlocks = (start: RunState, actions: readonly RunAction[]) => {
  let state = start;
  // The deck counts from the first real step, so the default deck a
  // picked starter replaces is never unlocked by mistake.
  let unlocks = EMPTY_UNLOCKS;
  for (const action of actions) {
    const next = runReducer(state, action);
    if (next !== state) unlocks = mergeUnlocks(unlocks, unlocksOfStep(state, action, next));
    state = next;
  }
  return { state, unlocks };
};

// --- ACCESS CHECKS ---
/** True when the viewer may fight this unit in Illusion Training. */
export const isUnitUnlocked = (access: UnlockAccess, heroId: HeroId): boolean =>
  access === null || access.killedUnits.includes(heroId);

/** True when every unit in the lineup has been killed. */
export const isLineupUnlocked = (access: UnlockAccess, heroIds: readonly HeroId[]): boolean =>
  heroIds.every((heroId) => isUnitUnlocked(access, heroId));

/** True when the viewer may put this card in a custom deck. */
export const isCardUnlocked = (access: UnlockAccess, cardId: CardId): boolean =>
  access === null || access.deckCards.includes(cardId);

/** True when the viewer has been on this region map. */
export const isMapUnlocked = (access: UnlockAccess, mapName: string): boolean =>
  access === null || access.visitedMaps.includes(mapName);

/** True when the viewer has fought any of the heroes an arena belongs to. */
export const isArenaUnlocked = (access: UnlockAccess, arenaHeroIds: readonly string[]): boolean =>
  access === null || access.facedUnits.some((heroId) => arenaHeroIds.includes(heroId));

/** True when the viewer is limited (not an admin): test-only content hides. */
export const isLimited = (access: UnlockAccess): access is Unlocks => access !== null;

// --- PRACTICE DECK ---
/**
 * The deck a limited viewer practises with when no custom deck is
 * picked (the themed test decks are admin only): one of each unlocked
 * card, or the starter deck before any run.
 */
export const unlockedPracticeDeck = (unlocks: Unlocks): CardId[] =>
  unlocks.deckCards.length > 0 ? unlocks.deckCards.slice(0, CUSTOM_DECK_LIMIT) : [...STARTER_DECK];

/** The heroes random hordes may use: all for admins, else killed units. */
export const dummyHeroes = (access: UnlockAccess): readonly HeroId[] | undefined =>
  access === null ? undefined : access.killedUnits;
