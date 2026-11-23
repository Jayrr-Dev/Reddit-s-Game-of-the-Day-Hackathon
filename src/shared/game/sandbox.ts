// ===================================================================
// SANDBOX (TARGET DUMMIES)
// A practice fight for testing cards, not part of the daily run: a
// random horde (random heroes, so random sizes, spots and attacks),
// every card in the deck, energy that refills after each play and HP
// that can't run out. Clearing the field brings in a fresh horde.
// Pure functions like the rest of the engine; never scored or logged.
// ===================================================================

import { sizeOf } from './battlefield.ts';
import { ALL_CARD_IDS } from './cards.ts';
import { combatOutcome, endTurn, playCard, startCombat } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, GRUNT_IDS, type HeroId } from './heroes.ts';
import { nextInt, pickWeighted, type RngState } from './rng.ts';
import { ENERGY_PER_TURN } from './rules.ts';
import type { CombatState } from './types.ts';

// --- TYPES ---
/** What the sandbox accepts: the two combat inputs. */
export type SandboxAction =
  | { type: 'playCard'; handIndex: number; targetUid: number }
  | { type: 'endTurn' };

// --- CONSTANTS ---
/** So much HP the heroes can't win; you test, you don't lose. */
export const SANDBOX_HP = 999;
/**
 * Most battlefield columns a horde may fill (the field has 6). Keeping
 * one free guarantees every mix fits, e.g. a champion (3) + an elite
 * (2), or two elites + a grunt.
 */
const HORDE_SIZE_BUDGET = 5;
const MIN_DUMMIES = 2;
const MAX_DUMMIES = 5;
/** Grunts show up most, champions least, so layouts vary. */
const DUMMY_POOL: readonly { item: HeroId; weight: number }[] = [
  ...GRUNT_IDS.map((item) => ({ item, weight: 3 })),
  ...ELITE_IDS.map((item) => ({ item, weight: 2 })),
  ...CHAMPION_IDS.map((item) => ({ item, weight: 1 })),
];

// --- HORDE ---
/** Rolls 2 to 5 random heroes that fit the field together. */
export const rollDummies = (seed: RngState): [HeroId[], RngState] => {
  const [extra, afterCount] = nextInt(seed, MAX_DUMMIES - MIN_DUMMIES + 1);
  const wanted = MIN_DUMMIES + extra;
  const heroIds: HeroId[] = [];
  let budget = HORDE_SIZE_BUDGET;
  let rng = afterCount;
  // Imperative on purpose: each pick shrinks the room for the next one.
  while (heroIds.length < wanted) {
    const fitting = DUMMY_POOL.filter(
      (entry) => sizeOf({ heroId: entry.item }) <= budget
    );
    if (fitting.length === 0) break;
    const [heroId, next] = pickWeighted(rng, fitting);
    heroIds.push(heroId);
    budget -= sizeOf({ heroId });
    rng = next;
  }
  return [heroIds, rng];
};

/** The startCombat setup for a sandbox fight. */
const sandboxSetup = (heroIds: readonly HeroId[], seed: RngState) => ({
  hp: SANDBOX_HP,
  maxHp: SANDBOX_HP,
  deck: ALL_CARD_IDS,
  heroIds,
  might: 1,
  seed,
});

/** Fills energy back up so every card stays playable. */
const refillEnergy = (state: CombatState): CombatState => ({
  ...state,
  energy: Math.max(state.energy, ENERGY_PER_TURN),
});

/**
 * Swaps in a fresh horde, keeping your cards. New heroes get uids
 * above every earlier one so the view never mistakes them for the
 * heroes that just fell.
 */
const nextHorde = (state: CombatState, firstUid: number): CombatState => {
  const [heroIds, rng] = rollDummies(state.rng);
  const fresh = startCombat(sandboxSetup(heroIds, rng));
  const heroes = fresh.heroes.map((unit) => ({
    ...unit,
    uid: unit.uid + firstUid,
  }));
  return { ...state, heroes, rng };
};

// --- PUBLIC API ---
/** A new sandbox fight from `seed`. */
export const createSandbox = (seed: RngState): CombatState => {
  const [heroIds, rng] = rollDummies(seed);
  return refillEnergy(startCombat(sandboxSetup(heroIds, rng)));
};

/** Applies one input; refills energy and brings a new horde when cleared. */
export const sandboxReducer = (
  state: CombatState,
  action: SandboxAction
): CombatState => {
  const acted =
    action.type === 'playCard'
      ? playCard(state, action.handIndex, action.targetUid)
      : endTurn(state);
  if (acted === state) return state;
  const isCleared = combatOutcome(acted) === 'won';
  const highestUid = Math.max(0, ...state.heroes.map((unit) => unit.uid));
  const ready = isCleared ? nextHorde(acted, highestUid) : acted;
  return refillEnergy(ready);
};
