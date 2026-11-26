// ===================================================================
// SANDBOX (TARGET DUMMIES)
// A practice fight for testing cards, not part of the daily run: a
// random horde (random heroes, so random sizes, spots and attacks),
// every card in the deck and standard combat energy costs.
// The practice character supplies HP. Clearing the field rolls a new horde.
// Pure functions like the rest of the engine; never scored or logged.
// ===================================================================

import { advanceHeroes, cellCountOf, cellsOf } from './battlefield.ts';
import { characterBonuses, syncCharacterCombat, type CharacterState, type Equipment, type TraitNodes, type Traits } from './character.ts';
import { drawCards, combatOutcome, endTurn, finishPlayerTurn, playCard, startCombat, startPlayerTurn } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS, type HeroId } from './heroes.ts';
import { move } from './movement.ts';
import { nextInt, pickWeighted, type RngState } from './rng.ts';
import { BATTLEFIELD_COLUMNS, BATTLEFIELD_ROWS, PLAYER_MAX_HP } from './rules.ts';
import type { MoveAction, PlayCardAction } from './run.ts';
import type { CardId } from './cards.ts';
import { isCustomDeckList, sandboxDeckCards, type SandboxDeckId } from './sandboxDecks.ts';
import type { CombatState, HeroUnit } from './types.ts';

// --- TYPES ---
/** What the sandbox accepts: the combat inputs. */
export type SandboxAction = PlayCardAction | { type: 'endTurn' } | MoveAction;

// --- CONSTANTS ---
/** Practice uses the same base health and Vigor bonuses as a ranked run. */
export const SANDBOX_HP = PLAYER_MAX_HP;
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
    id: 'mageBorneAstra',
    name: getHero('mageBorneAstra').name,
    blurb: 'A silent oracle who shuts down buffs and counters with astral magic.',
    heroIds: ['mageBorneAstra'],
    startsInPlace: true,
  },
  {
    id: 'grandangelCerviel',
    name: getHero('grandangelCerviel').name,
    blurb: 'Three bodies fight at once: staff wards from the back, sword guards the front, and bow fires from the flank.',
    heroIds: ['grandangelCerviel', 'cervielSword', 'cervielBow'],
    startsInPlace: true,
  },
  {
    id: 'grandangelCambiel',
    name: getHero('grandangelCambiel').name,
    blurb: 'A gilded shade who fights from the front and builds Hex.',
    heroIds: ['grandangelCambiel'],
    startsInPlace: true,
  },
  {
    id: 'archangelZeruel',
    name: getHero('archangelZeruel').name,
    blurb: 'Twin halo strikes and violet magic, flanked by Alpha (red) and Omega (blue).',
    heroIds: ['archangelZeruel', 'zeruelRedSun', 'zeruelBlueSun'],
    startsInPlace: true,
  },
  {
    id: 'grandangelRaziel',
    name: getHero('grandangelRaziel').name,
    blurb: 'An eight-armed angel who dispels buffs and builds to an eight-hit spell.',
    heroIds: ['grandangelRaziel'],
    startsInPlace: true,
  },
  {
    id: 'grandangelGeonosis',
    name: getHero('grandangelGeonosis').name,
    blurb: 'A hooded angel who wards himself and unleashes ice magic.',
    heroIds: ['grandangelGeonosis'],
    startsInPlace: true,
  },
  {
    id: 'zadkielOfDominations',
    name: getHero('zadkielOfDominations').name,
    blurb: 'A six-winged ruler who wards himself, then weakens and dispels his foe.',
    heroIds: ['zadkielOfDominations'],
    startsInPlace: true,
  },
  {
    id: 'fulgurDragonknight',
    name: getHero('fulgurDragonknight').name,
    blurb: 'An enormous dragon who drives you back, then detonates built-up Shock.',
    heroIds: ['fulgurDragonknight'],
    startsInPlace: true,
  },
  {
    id: 'grandangelCherubiel',
    name: getHero('grandangelCherubiel').name,
    blurb: 'A many-eyed angel who builds Shock behind a shield, then detonates it.',
    heroIds: ['grandangelCherubiel'],
    startsInPlace: true,
  },
  {
    id: 'mageBorneAzula',
    name: getHero('mageBorneAzula').name,
    blurb: 'A seven-eyed mage who wards herself, applies Hex, and strips away buffs.',
    heroIds: ['mageBorneAzula'],
    startsInPlace: true,
  },
  {
    id: 'lightLordMori',
    name: getHero('lightLordMori').name,
    blurb: 'A light wielding boss shields two Elite Knights who hold the entire front line.',
    heroIds: ['lightLordMori', 'paladin', 'hornedSentinel'],
    startsInPlace: true,
  },
  {
    id: 'apollyonSeraph',
    name: getHero('apollyonSeraph').name,
    blurb: 'A seraph leads from the front, with two Biblical Angels behind it.',
    heroIds: ['apollyonSeraph', 'angelArcher', 'angelArcher'],
    startsInPlace: true,
  },
  {
    id: 'ivoryHost',
    name: 'Ivory Host',
    blurb: 'Five new enemies: forced movement, Shock combos, and Buff disruption.',
    heroIds: ['hornedSentinel', 'stormLancer', 'swordPrelate', 'purpleCupid', 'sevenEyedOracle'],
    startsInPlace: true,
  },
  {
    id: 'holyKing',
    name: 'Holy King',
    blurb: 'A solo boss who alternates Protection, forced movement, and sword attacks.',
    heroIds: ['holyKing'],
    startsInPlace: true,
  },
  {
    id: 'wolfPack',
    name: 'Wolf Pack',
    blurb: 'An Ivory Werewolf stacks Bleed while a Wolf-Centaur pulls you in.',
    heroIds: ['ivoryWerewolf', 'wolfCentaur'],
    startsInPlace: true,
  },
  {
    id: 'angelMage',
    name: 'Angel Mage',
    blurb: 'A winged time mage shields a prelate and sentinel, then casts Frost.',
    heroIds: ['hornedSentinel', 'swordPrelate', 'angelMage'],
    startsInPlace: true,
  },
  {
    id: 'holyDragon',
    name: getHero('holyDragon').name,
    blurb: 'A boss in a T that calls Biblical Angels to its flanks.',
    heroIds: ['holyDragon'],
  },
  {
    id: 'grandGriffon',
    name: 'Grand Griffon Rio',
    blurb: 'A solo boss in the centre that soars out of reach, then dives.',
    heroIds: ['grandGriffon'],
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
  deckId: SandboxDeckId | readonly CardId[] = 'all',
  traits?: Traits,
  equipment?: Equipment,
  traitNodes?: TraitNodes
) => {
  if (typeof deckId !== 'string' && !isCustomDeckList(deckId)) throw new RangeError('Invalid custom training deck');
  const maxHp = characterBonuses(traits, equipment, traitNodes).maxHp;
  return {
    hp: maxHp,
    maxHp,
    ...(traits && { traits }),
    ...(equipment && { equipment }),
    ...(traitNodes && { traitNodes }),
    deck: typeof deckId === 'string' ? sandboxDeckCards(deckId) : [...deckId],
    heroIds,
    might: 1,
    seed,
  };
};

/**
 * Swaps in a fresh horde, keeping your cards. New heroes get uids
 * above every earlier one so the view never mistakes them for the
 * heroes that just fell.
 */
const nextHorde = (state: CombatState, firstUid: number): CombatState => {
  const [heroIds, rng] = rollDummies(state.rng);
  const fresh = startCombat({ ...sandboxSetup(heroIds, rng), formation: 'furthest' });
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
    waveArrival: true,
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
  deckId: SandboxDeckId | readonly CardId[] = 'all',
  traits?: Traits,
  equipment?: Equipment,
  traitNodes?: TraitNodes
): CombatState => {
  const [heroIds, rng] = rollDummies(seed);
  return startCombat(sandboxSetup(heroIds, rng, deckId, traits, equipment, traitNodes));
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
  deckId: SandboxDeckId | readonly CardId[] = 'all',
  traits?: Traits,
  equipment?: Equipment,
  traitNodes?: TraitNodes
): CombatState => {
  const fresh = startCombat(sandboxSetup(heroIds, seed, deckId, traits, equipment, traitNodes));
  const placed = startsInPlace
    ? { ...fresh, heroes: spreadCervielForms(walkHome(fresh.heroes)) }
    : fresh;
  return placed;
};

/**
 * Every hero walks in until no one can step nearer home (one step per
 * pass, as at the end of a heroes' turn). Bounded by the field's depth.
 */
const walkHome = (heroes: HeroUnit[]): HeroUnit[] =>
  BATTLEFIELD_ROWS.reduce((field) => advanceHeroes(field), heroes);

/** Keep Cerviel's three weapon silhouettes apart in the starting formation. */
const spreadCervielForms = (heroes: HeroUnit[]): HeroUnit[] => {
  if (!heroes.some(({ heroId }) => heroId === 'grandangelCerviel')) return heroes;
  const right = Number(BATTLEFIELD_COLUMNS) - 1;
  return heroes.map(unit => {
    if (unit.heroId !== 'cervielSword' || unit.row !== 'front') return unit;
    const occupied = heroes.some(other => other.uid !== unit.uid &&
      cellsOf(other).some(cell => cell.row === 'front' && cell.col >= right));
    return occupied ? unit : { ...unit, col: right };
  });
};

/** Applies one input; brings a new horde when cleared. */
export const stepSandbox = (
  state: CombatState,
  action: SandboxAction
): { combat: CombatState; victory: boolean } => {
  const acted = applyAction(state, action);
  if (acted === state) return { combat: state, victory: false };
  const isCleared = combatOutcome(acted) === 'won';
  // Every uid so far (summons included) is below nextUid.
  if (!isCleared) return { combat: acted, victory: false };
  // A status kill during the heroes' turn has already closed the player's turn.
  const finished = action.type === 'endTurn' ? acted : finishPlayerTurn(acted);
  return { combat: startPlayerTurn(nextHorde(finished, finished.nextUid - 1)), victory: true };
};

/** Replay the selected encounter and exact deck with the current training build. */
export const retryTrainingFight = (opening: CombatState, character: CharacterState): CombatState => {
  let combat = syncCharacterCombat(opening, character);
  const { startingEnergy, cardsPerTurn } = characterBonuses(character.traits, character.equipment, character.traitNodes);
  if (combat.hand.length > cardsPerTurn) {
    // Opening cards have no imbues yet. Put excess cards back in their original order.
    combat = { ...combat, hand: combat.hand.slice(0, cardsPerTurn), handImbues: combat.handImbues.slice(0, cardsPerTurn),
      drawPile: [...combat.hand.slice(cardsPerTurn), ...combat.drawPile] };
  } else if (combat.hand.length < cardsPerTurn && combat.drawPile.length) {
    combat = drawCards(combat, Math.min(cardsPerTurn - combat.hand.length, combat.drawPile.length));
  }
  combat = { ...combat, energy: startingEnergy };
  return { ...combat, player: { ...combat.player, hp: combat.player.maxHp } };
};

/** Applies an input for callers that only need the resulting fight. */
export const sandboxReducer = (state: CombatState, action: SandboxAction): CombatState =>
  stepSandbox(state, action).combat;
