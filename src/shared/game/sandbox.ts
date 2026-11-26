// ===================================================================
// SANDBOX (TARGET DUMMIES)
// A practice fight for testing cards, not part of the daily run: a
// random horde (random heroes, so random sizes, spots and attacks),
// every card in the deck and standard combat energy costs.
// The practice character supplies HP. Clearing the field rolls a new horde.
// Pure functions like the rest of the engine; never scored or logged.
// ===================================================================

import { advanceHeroes, cellCountOf, isAnchored } from './battlefield.ts';
import { characterBonuses, syncCharacterCombat, type CharacterState, type Equipment, type TraitNodes, type Traits } from './character.ts';
import { drawCards, combatOutcome, endTurn, finishPlayerTurn, playCard, startCombat, startPlayerTurn } from './combat.ts';
import { CHAMPION_IDS, ELITE_IDS, getHero, GRUNT_IDS, HEROES, UNIT_TYPE_LABELS, UNIT_TYPES, unitTypeOf, type HeroId } from './heroes.ts';
import { move } from './movement.ts';
import { nextInt, pickWeighted, type RngState } from './rng.ts';
import { BATTLEFIELD_ROWS, PLAYER_MAX_HP } from './rules.ts';
import { PASSIVE_INFO, preferredPositionLabel } from './describe.ts';
import type { MoveAction, PlayCardAction } from './run.ts';
import type { CardId } from './cards.ts';
import { isCustomDeckList, sandboxDeckCards, type SandboxDeckId } from './sandboxDecks.ts';
import type { CombatState, HeroTier, HeroUnit, UnitType } from './types.ts';

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
type DummyPool = readonly { item: HeroId; weight: number }[];
const DUMMY_POOL: DummyPool = [
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
  /**
   * The hero the scenario is about, when it isn't the first in heroIds
   * (e.g. Angel Mage stands behind its escorts). Sets its unit type group.
   */
  leadHeroId?: HeroId;
};

/** One unit type's heading and the scenarios led by that kind of hero. */
export type ScenarioGroup = {
  unitType: UnitType;
  label: string;
  scenarios: readonly SandboxScenario[];
};

/**
 * The preset lineups. Each must fit the field (3 front + 3 back
 * columns); the sandbox tests check that every hero gets a spot.
 * Add a scenario by adding an entry here.
 */
export const SANDBOX_SCENARIOS: readonly SandboxScenario[] = [
  {
    id: 'greed',
    name: getHero('greed').name,
    blurb: 'A one-eyed pig mage who shields his hoard and strips away your buffs.',
    heroIds: ['greed'],
    startsInPlace: true,
  },
  {
    id: 'envy',
    name: getHero('envy').name,
    blurb: 'An emerald slime that poisons you and reforms to restore health.',
    heroIds: ['envy'],
    startsInPlace: true,
  },
  {
    id: 'sloth',
    name: getHero('sloth').name,
    blurb: 'A basalt golem that opens with heavy Guard. Read its slow, crushing wind-up.',
    heroIds: ['sloth'],
    startsInPlace: true,
  },
  {
    id: 'pride',
    name: getHero('pride').name,
    blurb: 'A fallen sovereign who builds attack power before a two-hit signature.',
    heroIds: ['pride'],
    startsInPlace: true,
  },
  {
    id: 'lust',
    name: getHero('lust').name,
    blurb: 'A veiled caster who marks you with Hex and shuts off buffs with Malaise.',
    heroIds: ['lust'],
    startsInPlace: true,
  },
  {
    id: 'gluttony',
    name: getHero('gluttony').name,
    blurb: 'A thorned maw that lashes twice and heals itself on its signature turn.',
    heroIds: ['gluttony'],
    startsInPlace: true,
  },
  {
    id: 'mageBorneAstra',
    name: getHero('mageBorneAstra').name,
    blurb: 'A silent oracle who shuts down buffs and counters with astral magic.',
    heroIds: ['mageBorneAstra'],
    startsInPlace: true,
  },
  {
    id: 'grandangelCerviel',
    name: getHero('cervielSword').name,
    blurb: 'Sword stands alone at the front. Staff and Bow answer one summons each, and Sword transforms on the first lethal blow.',
    heroIds: ['cervielSword'],
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
    heroIds: ['hornedSentinel', 'stormLancer', 'swordPrelate', 'wingedArcher', 'sevenEyedOracle'],
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
    leadHeroId: 'angelMage',
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
    id: 'tempestWyrm',
    name: 'Tempest Wyrm Vael',
    blurb: 'A storm giant filling the front: Shock spears, then Thunderhead.',
    heroIds: ['tempestWyrm'],
  },
  {
    id: 'angelAssassin',
    name: getHero('angelAssassin').name,
    blurb: 'Uses Cloak 2 to avoid being targeted, then reveals herself when she attacks.',
    heroIds: ['angelAssassin'],
    startsInPlace: true,
  },
  {
    id: 'twinAxeKnight',
    name: getHero('twinAxeKnight').name,
    blurb: 'A heavily armored front-line boss with two axes and a brutal crosscut.',
    heroIds: ['twinAxeKnight'],
    startsInPlace: true,
  },
  {
    id: 'archangelUriel',
    name: getHero('archangelUriel').name,
    blurb: 'The red-winged archangel alternates holy flame and shield wards.',
    heroIds: ['archangelUriel'],
    startsInPlace: true,
  },
  {
    id: 'zeruelArmored',
    name: getHero('zeruelArmored').name,
    blurb: 'The alternate armored Zeruel, fought alone.',
    heroIds: ['zeruelArmored'],
    startsInPlace: true,
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

/** The hero a scenario is about: its leadHeroId, else its first hero. */
const scenarioLeadHeroId = (scenario: SandboxScenario): HeroId | undefined =>
  scenario.leadHeroId ?? scenario.heroIds[0];

/** The unit type a scenario is filed under: its lead hero's (Humans if it has none). */
export const scenarioUnitType = (scenario: SandboxScenario): UnitType => {
  const lead = scenarioLeadHeroId(scenario);
  return lead ? unitTypeOf(lead) : 'human';
};

/**
 * A scenario's rank: its lead hero's tier (grunt if it has none), so the
 * picker can colour boss and elite names the same way the battlefield does.
 */
export const scenarioTier = (scenario: SandboxScenario): HeroTier => {
  const lead = scenarioLeadHeroId(scenario);
  return lead ? getHero(lead).tier : 'grunt';
};

/**
 * Scenarios split into unit type sections (Angels, Dragons, Beasts,
 * Humans, Demi-humans, Seven Sins), keeping list order inside each and dropping empty sections.
 */
export const groupScenariosByUnitType = (
  scenarios: readonly SandboxScenario[] = SANDBOX_SCENARIOS
): ScenarioGroup[] =>
  UNIT_TYPES
    .map((unitType) => ({
      unitType,
      label: UNIT_TYPE_LABELS[unitType],
      scenarios: scenarios.filter((scenario) => scenarioUnitType(scenario) === unitType),
    }))
    .filter((group) => group.scenarios.length > 0);

// --- UNITS ---
/**
 * A Units tab section: a unit type, or Stationary for anchored heroes
 * (the Ballista), which never leave their line.
 */
export type UnitSectionId = UnitType | 'stationary';

/** One section's heading and its heroes, weakest rank first. */
export type UnitGroup = {
  id: UnitSectionId;
  label: string;
  heroIds: readonly HeroId[];
};

/** Heading of the section for anchored heroes, listed last. */
const STATIONARY_LABEL = 'Stationary';

/** Rank order for the Units list: the horde first, bosses last. */
const TIER_ORDER: readonly HeroTier[] = ['grunt', 'elite', 'champion', 'boss'];

/** Display names for a hero's rank, shown under each unit. */
export const TIER_LABELS: Readonly<Record<HeroTier, string>> = {
  grunt: 'Grunt',
  elite: 'Elite',
  champion: 'Champion',
  boss: 'Boss',
};

/** Every hero id in catalog order (the catalog is the one source of units). */
export const ALL_HERO_IDS: readonly HeroId[] = Object.keys(HEROES).filter(
  (id): id is HeroId => id in HEROES
);

/** The Units tab section a hero is filed under: Stationary wins over its unit type. */
const unitSectionOf = (heroId: HeroId): UnitSectionId =>
  isAnchored({ heroId }) ? 'stationary' : unitTypeOf(heroId);

/**
 * Heroes split into unit type sections (same order as the Scenarios tab)
 * plus Stationary last, sorted by rank inside each (stable, so catalog
 * order breaks ties) and dropping empty sections.
 */
export const groupUnitsByUnitType = (heroIds: readonly HeroId[] = ALL_HERO_IDS): UnitGroup[] =>
  [...UNIT_TYPES, 'stationary' as const]
    .map((id) => ({
      id,
      label: id === 'stationary' ? STATIONARY_LABEL : UNIT_TYPE_LABELS[id],
      heroIds: heroIds
        .filter((heroId) => unitSectionOf(heroId) === id)
        .toSorted((a, b) => TIER_ORDER.indexOf(getHero(a).tier) - TIER_ORDER.indexOf(getHero(b).tier)),
    }))
    .filter((group) => group.heroIds.length > 0);

/**
 * A one-on-one fight against a single unit, as a scenario so it runs
 * through the same fight prompt and summon flow as the preset lineups.
 * It starts in its home line, like the scenarios do; the blurb names
 * that line so the Units tab shows where each unit prefers to fight.
 */
export const soloUnitScenario = (heroId: HeroId): SandboxScenario => {
  const hero = getHero(heroId);
  return {
    id: 'unit:' + heroId,
    name: hero.name,
    blurb: TIER_LABELS[hero.tier] + ' · ' + hero.maxHp + ' HP · ' + preferredPositionLabel(heroId),
    heroIds: [heroId],
    startsInPlace: true,
  };
};

/** One row of a unit's Stats tab; info is glossary markup under the value. */
export type UnitStat = { label: string; value: string; info?: string };

/** "1 column", "2 columns": how wide a hero stands on the field. */
const columnsLabel = (size: number): string => size + (size === 1 ? ' column' : ' columns');

/**
 * A unit's numbers and traits for the Units tab's Stats view, read from
 * the hero catalog: rank, kind, HP, line, width, speed, armor (when it
 * has any) and one row per built-in trait.
 */
export const describeUnitStats = (heroId: HeroId): UnitStat[] => {
  const hero = getHero(heroId);
  const traits = (hero.passives ?? []).map((passive) => ({
    label: 'Trait',
    value: PASSIVE_INFO[passive].label,
    info: PASSIVE_INFO[passive].description,
  }));
  return [
    { label: 'Rank', value: TIER_LABELS[hero.tier] },
    { label: 'Unit type', value: UNIT_TYPE_LABELS[unitTypeOf(heroId)] },
    { label: 'HP', value: String(hero.maxHp) },
    { label: 'Preferred line', value: preferredPositionLabel(heroId) },
    { label: 'Size', value: columnsLabel(hero.size) },
    { label: 'Speed', value: String(hero.speed), info: 'Higher acts **earlier** on the heroes\' turn' },
    ...(hero.armor ? [{ label: 'Armor', value: String(hero.armor) }] : []),
    { label: 'Moves', value: String(hero.moves.length + (hero.secondPhase?.moves.length ?? 0)) },
    ...traits,
  ];
};

// --- HORDE ---
/**
 * The random-horde pool, limited to `allowed` heroes when given (a
 * player can only face units they have unlocked; see unlocks.ts).
 */
const dummyPool = (allowed?: readonly HeroId[]): DummyPool =>
  allowed ? DUMMY_POOL.filter((entry) => allowed.includes(entry.item)) : DUMMY_POOL;

/** True when a random horde can be rolled from the allowed heroes. */
export const canRollDummies = (allowed?: readonly HeroId[]): boolean => dummyPool(allowed).length > 0;

/** Rolls 2 to 5 random heroes that fit the field together (from `allowed`, if given). */
export const rollDummies = (seed: RngState, allowed?: readonly HeroId[]): [HeroId[], RngState] => {
  const pool = dummyPool(allowed);
  const [extra, afterCount] = nextInt(seed, MAX_DUMMIES - MIN_DUMMIES + 1);
  const wanted = MIN_DUMMIES + extra;
  const heroIds: HeroId[] = [];
  let budget = HORDE_SIZE_BUDGET;
  let rng = afterCount;
  // Imperative on purpose: each pick shrinks the room for the next one.
  while (heroIds.length < wanted) {
    const fitting = pool.filter(
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
const nextHorde = (state: CombatState, firstUid: number, allowed?: readonly HeroId[]): CombatState => {
  const [heroIds, rng] = rollDummies(state.rng, allowed);
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
  traitNodes?: TraitNodes,
  allowed?: readonly HeroId[]
): CombatState => {
  const [heroIds, rng] = rollDummies(seed, allowed);
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
    ? { ...fresh, heroes: setZeruelFormation(walkHome(fresh.heroes)) }
    : fresh;
  return placed;
};

/**
 * Every hero walks in until no one can step nearer home (one step per
 * pass, as at the end of a heroes' turn). Bounded by the field's depth.
 */
const walkHome = (heroes: HeroUnit[]): HeroUnit[] =>
  BATTLEFIELD_ROWS.reduce((field) => advanceHeroes(field), heroes);

/** Archangel Zeruel keeps Alpha and Omega on the back flanks. */
const setZeruelFormation = (heroes: HeroUnit[]): HeroUnit[] => {
  if (!heroes.some(({ heroId }) => heroId === 'archangelZeruel')) return heroes;
  return heroes.map(unit => unit.heroId === 'zeruelRedSun' ? { ...unit, row: 'back', col: 0 }
    : unit.heroId === 'zeruelBlueSun' ? { ...unit, row: 'back', col: 2 } : unit);
};

/**
 * Applies one input; brings a new horde (from `allowed` heroes, if
 * given) when cleared. With no horde to roll, the cleared field stays.
 */
export const stepSandbox = (
  state: CombatState,
  action: SandboxAction,
  allowed?: readonly HeroId[]
): { combat: CombatState; victory: boolean } => {
  const acted = applyAction(state, action);
  if (acted === state) return { combat: state, victory: false };
  const isCleared = combatOutcome(acted) === 'won';
  // Every uid so far (summons included) is below nextUid.
  if (!isCleared || !canRollDummies(allowed)) return { combat: acted, victory: isCleared };
  // A status kill during the heroes' turn has already closed the player's turn.
  const finished = action.type === 'endTurn' ? acted : finishPlayerTurn(acted);
  return { combat: startPlayerTurn(nextHorde(finished, finished.nextUid - 1, allowed)), victory: true };
};

/** Replay the selected encounter and exact deck with the current training build. */
export const retryTrainingFight = (opening: CombatState, character: CharacterState): CombatState => {
  let combat = syncCharacterCombat(opening, character);
  const { startingEnergy, cardsPerTurn } = characterBonuses(character.traits, character.equipment, character.traitNodes);
  if (combat.hand.length > cardsPerTurn) {
    // Opening cards have no imbues yet. Put excess cards back in their original order.
    combat = { ...combat, hand: combat.hand.slice(0, cardsPerTurn), handImbues: combat.handImbues.slice(0, cardsPerTurn), handFatigue: [],
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
