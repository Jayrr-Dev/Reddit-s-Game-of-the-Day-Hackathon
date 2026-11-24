// ===================================================================
// SANDBOX (TARGET DUMMIES)
// A practice fight for testing cards, not part of the daily run: a
// random horde (random heroes, so random sizes, spots and attacks),
// every card in the deck, energy that refills after each play and HP
// that can't run out. Clearing the field brings in a fresh horde.
// Pure functions like the rest of the engine; never scored or logged.
// ===================================================================

import { advanceHeroes, cellCountOf } from './battlefield.ts';
import { combatOutcome, endTurn, playCard, startCombat } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, GRUNT_IDS, type HeroId } from './heroes.ts';
import { move } from './movement.ts';
import { nextInt, pickWeighted, type RngState } from './rng.ts';
import { BATTLEFIELD_ROWS, ENERGY_PER_TURN } from './rules.ts';
import type { MoveAction, PlayCardAction } from './run.ts';
import { sandboxDeckCards, type SandboxDeckId } from './sandboxDecks.ts';
import type { CombatState, HeroUnit } from './types.ts';

// --- TYPES ---
/** What the sandbox accepts: the combat inputs. */
export type SandboxAction = PlayCardAction | { type: 'endTurn' } | MoveAction;

// --- CONSTANTS ---
/** So much HP the heroes can't win; you test, you don't lose. */
export const SANDBOX_HP = 999;
/**
 * Most battlefield cells a horde may fill (MAX_HERO_CELLS is 6). Keeping
 * one free guarantees every mix fits, e.g. a champion (3) + an elite
 * (2), or two elites + a grunt. A boss (6 cells) never rolls; it has
 * its own scenario.
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

// --- SCENARIOS ---
/** A preset lineup to practise against, picked from the pause menu. */
export type SandboxScenario = {
  id: string;
  name: string;
  /** One line on what it tests. */
  blurb: string;
  /** Heroes in the fight; the battlefield rules place them. */
  heroIds: readonly HeroId[];
  /**
   * True to start with everyone already in their home line (no march
   * in), to show a set formation from the first turn.
   */
  startsInPlace?: boolean;
};

/**
 * The preset lineups. Each must fit the field (3 front + 3 back
 * columns); the sandbox tests check that every hero gets a spot.
 * Add a scenario by adding an entry here.
 */
export const SANDBOX_SCENARIOS: readonly SandboxScenario[] = [
  {
    id: 'holyDragon',
    name: 'Holy Dragon Unc',
    blurb: 'A boss in a T that calls Biblical Angels to its flanks.',
    heroIds: ['holyDragon'],
  },
  {
    id: 'grandGriffon',
    name: 'Grand Griffon Rio',
    blurb: 'A boss down the centre that soars out of reach, then dives.',
    heroIds: ['grandGriffon', 'squire', 'archer'],
  },
  {
    id: 'mixedRows',
    name: 'Full field',
    blurb: 'Every slot taken: fighters in front, ranged and support behind.',
    heroIds: ['squire', 'shieldmaiden', 'squire', 'archer', 'priest', 'bard'],
  },
  {
    id: 'archers',
    name: 'Archer volley',
    blurb: 'All archers: lots of Range hits, front and back.',
    heroIds: ['archer', 'archer', 'archer', 'archer', 'archer'],
  },
  {
    id: 'tankWall',
    name: 'Tank wall',
    blurb: 'Shields up front, healers behind: test Guard breaking.',
    heroIds: ['shieldmaiden', 'shieldmaiden', 'squire', 'priest', 'priest'],
  },
  {
    id: 'elites',
    name: 'Elites',
    blurb: 'A Paladin and an Archmage, each two slots wide.',
    heroIds: ['paladin', 'squire', 'archmage', 'rogue'],
  },
  {
    id: 'champion',
    name: 'Champion',
    blurb: 'Valen the Radiant with a priest and a bard.',
    heroIds: ['valen', 'priest', 'bard'],
  },
  {
    id: 'ballista',
    name: 'Ballista',
    blurb:
      'Shieldmaidens in front, Archers in the middle, two Ballistas at the back.',
    heroIds: [
      'shieldmaiden',
      'shieldmaiden',
      'archer',
      'archer',
      'ballista',
      'ballista',
    ],
    startsInPlace: true,
  },
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
      (entry) => cellCountOf({ heroId: entry.item }) <= budget
    );
    if (fitting.length === 0) break;
    const [heroId, next] = pickWeighted(rng, fitting);
    heroIds.push(heroId);
    budget -= cellCountOf({ heroId });
    rng = next;
  }
  return [heroIds, rng];
};

/** The startCombat setup for a sandbox fight. */
const sandboxSetup = (
  heroIds: readonly HeroId[],
  seed: RngState,
  deckId: SandboxDeckId = 'all'
) => ({
  hp: SANDBOX_HP,
  maxHp: SANDBOX_HP,
  deck: sandboxDeckCards(deckId),
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
  // The last fight's fallen stay gone: a revive only raises this horde.
  return {
    ...state,
    heroes,
    rng,
    nextUid: fresh.nextUid + firstUid,
    fallen: [],
  };
};

/** Runs one sandbox input through the engine. */
const applyAction = (state: CombatState, action: SandboxAction) => {
  switch (action.type) {
    case 'playCard':
      return playCard(
        state,
        action.handIndex,
        action.targetUid,
        action.targetUids,
        action.imbueIndex
      );
    case 'endTurn':
      return endTurn(state);
    case 'move':
      return move(state, action.move);
  }
};

// --- PUBLIC API ---
/** A new sandbox fight from `seed`, with a test deck (default: every card). */
export const createSandbox = (
  seed: RngState,
  deckId: SandboxDeckId = 'all'
): CombatState => {
  const [heroIds, rng] = rollDummies(seed);
  return refillEnergy(startCombat(sandboxSetup(heroIds, rng, deckId)));
};

/**
 * A sandbox fight against chosen heroes (e.g. a scenario's lineup),
 * placed by the normal battlefield rules. Clearing it rolls a random
 * horde as usual.
 */
export const createSandboxWith = (
  seed: RngState,
  heroIds: readonly HeroId[],
  startsInPlace = false,
  deckId: SandboxDeckId = 'all'
): CombatState => {
  const fresh = startCombat(sandboxSetup(heroIds, seed, deckId));
  const placed = startsInPlace
    ? { ...fresh, heroes: walkHome(fresh.heroes) }
    : fresh;
  return refillEnergy(placed);
};

/**
 * Every hero walks in until no one can step nearer home (one step per
 * pass, as at the end of a heroes' turn). Bounded by the field's depth.
 */
const walkHome = (heroes: HeroUnit[]): HeroUnit[] =>
  BATTLEFIELD_ROWS.reduce((field) => advanceHeroes(field), heroes);

/** Applies one input; refills energy and brings a new horde when cleared. */
export const sandboxReducer = (
  state: CombatState,
  action: SandboxAction
): CombatState => {
  const acted = applyAction(state, action);
  if (acted === state) return state;
  const isCleared = combatOutcome(acted) === 'won';
  // Every uid so far (summons included) is below nextUid.
  const ready = isCleared ? nextHorde(acted, acted.nextUid - 1) : acted;
  return refillEnergy(ready);
};
