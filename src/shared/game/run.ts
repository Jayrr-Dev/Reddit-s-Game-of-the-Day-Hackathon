import { isStarterName, validStarter, type StarterName } from './starters.ts';
import { planSkillPath, buySkill, isSkillPick, type SkillPick } from './skills.ts';
import { progressionFromWins, healingAmount, type RingProgress, allocateTrait, awardCharacterVictory, characterBonuses, createCharacter, discardItem, equipItem, isRingIndex, isTrait, isTraitRank, isTraitNode, isTraitPath, traitPathCap, type TraitPath, setTraitNode, setTraitPathRank, setTraitRank, traitHealth, syncCharacterCombat, type CharacterState, type TraitId, type EquipmentSlot } from './character.ts';
// ===================================================================
// RUN (THE CONQUEST)
// A whole day's run as one pure reducer: runReducer(state, action).
// The React client feeds player actions into it, and the server replays
// the same list of actions to verify the score, so the reducer must be
// deterministic and must ignore illegal actions instead of throwing.
//
// PHASES
//   route  -> pick one of the paths to the next stop
//   combat -> fight the horde (playCard / endTurn)
//   reward -> take one card or skip      (after a won fight)
//   grave  -> mourn (heal) or vow (+max HP)
//   altar  -> take one powerful card or skip
//   fallen -> the heroes stopped you; the run is over
// ===================================================================

import { STARTER_DECK, type CardId } from './cards.ts';
import { combatOutcome, endTurn, playCard, startCombat, SELF_TARGET_UID } from './combat.ts';
import { mightAt, routeOptions, stopSeed, type Stop } from './kingdom.ts';
import { isMovementId, move } from './movement.ts';
import { rollOffers } from './rewards.ts';
import { isUniqueInDeck } from './unique.ts';
import {
  CHAMPION_VICTORY_HEAL,
  GRAVE_HEAL_FRACTION,
  GRAVE_VOW_MAX_HP,
  PLAYER_MAX_HP,
  PLAYER_HP_CAP,
  SCORE_PER_HERO_SLAIN,
  SCORE_PER_REGION,
  SCORE_PER_WAVE,
} from './rules.ts';
import type { CombatState, MovementId, UsesSpent } from './types.ts';
import { deckWithout } from './uses.ts';

// --- TYPES ---
export type RunStats = {
  wavesCleared: number;
  heroesSlain: number;
  regionsConquered: number;
  turns: number;
};

export type RunPhase =
  | { kind: 'route'; options: Stop[] }
  | { kind: 'combat'; stop: Stop; combat: CombatState }
  | { kind: 'reward'; offers: CardId[]; source?: 'horde' | 'elite' | 'champion'; rerolled?: boolean; leveledUp?: boolean }
  | { kind: 'grave' }
  | { kind: 'altar'; offers: CardId[] }
  | { kind: 'fallen'; battlefield?: { stop: Stop; combat: CombatState } };

export type RunState = {
  attempt: number;
  rewardStarter?: StarterName;
  ringDrops?: number[];
  baseMaxHp?: number;
  storyRingUnlocked?: number | undefined;
  character: CharacterState;
  dailyKey: string;
  /** The 1-based stop the villain is choosing or playing. */
  stop: number;
  hp: number;
  maxHp: number;
  deck: CardId[];
  /** Uses spent on each Exhaust card in the deck (see uses.ts). */
  usesSpent: UsesSpent;
  stats: RunStats;
  phase: RunPhase;
};

export type GraveChoice = 'mourn' | 'vow';

/**
 * Plays a card. `targetUids` lists each pick of a Target N card in
 * order (the same hero may appear more than once); `targetUid` is the
 * first pick, and the only one for every other card.
 */
export type PlayCardAction = {
  type: 'playCard';
  handIndex: number;
  targetUid: number;
  targetUids?: number[];
  /** For an Imbue card: the hand slot of the card it imbues. */
  imbueIndex?: number;
};

/** Makes a movement on the battlefield (see MOVEMENTS in movement.ts). */
export type MoveAction = { type: 'move'; move: MovementId };

/** LEGACY: the two movement actions logged before MoveAction existed. */
type LegacyMoveAction = { type: 'charge' } | { type: 'backStep' };

/** The movement an action makes (legacy actions name it as their type). */
const moveIdOf = (action: MoveAction | LegacyMoveAction): MovementId =>
  action.type === 'move' ? action.move : action.type;

/** Every input a player can give. Logged and replayed by the server. */
export type RunAction =
  | { type: 'starterDeck'; name: StarterName; cards: CardId[]; favorStarter?: true }
  | { type: 'setTraitRank'; trait: TraitId; rank: number }
  | { type: 'setTraitNode'; trait: TraitId; node: number; owned: boolean }
  | { type: 'setTraitPathRank'; trait: TraitId; path: TraitPath; rank: number }
  | { type: 'skillPath'; pick: SkillPick }
  | { type: 'buySkill'; pick: SkillPick }
  | { type: 'allocateTrait'; trait: TraitId }
  | { type: 'equipItem'; slot: EquipmentSlot; itemId: string | null; ringIndex?: number }
  /** Destroys an owned ring or amulet (trashed from the Inventory). */
  | { type: 'discardItem'; itemId: string }
  | { type: 'chooseStop'; option: number }
  | PlayCardAction
  | { type: 'endTurn' }
  /** A movement on the battlefield, e.g. Charge (see movement.ts). */
  | MoveAction
  | LegacyMoveAction
  | { type: 'pickCard'; offerIndex: number | null }
  | { type: 'rerollReward' }
  | { type: 'graveChoice'; choice: GraveChoice }
  /** Gives up the march; the score so far stands. */
  | { type: 'abandon' };

// --- CONSTANTS ---
const EMPTY_STATS: RunStats = {
  wavesCleared: 0,
  heroesSlain: 0,
  regionsConquered: 0,
  turns: 0,
};

// --- CREATION ---

/** The start of the day's run: full HP, starter deck, first crossroads. */
export const createRun = (dailyKey: string, ringProgress?: RingProgress, attempt = 0, wins = 0): RunState => ({
  attempt,
  dailyKey,
  stop: 1,
  character: { ...createCharacter(ringProgress), ...progressionFromWins(wins) },
  hp: PLAYER_MAX_HP,
  maxHp: PLAYER_MAX_HP,
  deck: [...STARTER_DECK],
  usesSpent: {},
  stats: EMPTY_STATS,
  phase: { kind: 'route', options: routeOptions(dailyKey, 1) },
});

// --- TRANSITIONS ---

/** Moves on to the crossroads of the next stop. */
const advanceToNextStop = (state: RunState): RunState => {
  const stop = state.stop + 1;
  return {
    ...state,
    stop,
    storyRingUnlocked: undefined,
    phase: { kind: 'route', options: routeOptions(state.dailyKey, stop) },
  };
};

/** Enters the chosen stop: starts a fight, or opens the grave or altar. */
const enterStop = (state: RunState, stop: Stop): RunState => {
  if (stop.kind === 'grave') return { ...state, phase: { kind: 'grave' } };
  if (stop.kind === 'altar') {
    const offers = rollOffers(
      stopSeed(state.dailyKey, 'altar', state.stop),
      'altar',
      [],
      undefined,
      state.character.skillPicks,
      state.deck
    );
    return { ...state, phase: { kind: 'altar', offers } };
  }
  const combat = startCombat({
    traits: state.character.traits,
    ...(state.character.traitNodes && { traitNodes: state.character.traitNodes }),
    ...(state.character.skillPicks && { skillPicks: state.character.skillPicks }),
    equipment: state.character.equipment,
    hp: state.hp,
    maxHp: state.maxHp,
    deck: state.deck,
    heroIds: stop.heroIds,
    might: mightAt(state.stop),
    seed: stopSeed(state.dailyKey, 'combat', state.stop),
    usesSpent: state.usesSpent,
  });
  return { ...state, phase: { kind: 'combat', stop, combat } };
};

/** Which reward odds a won fight uses (elites and champions pay better). */
const rewardSourceOf = (stop: Stop): 'horde' | 'elite' | 'champion' =>
  stop.kind === 'elite' || stop.kind === 'champion' ? stop.kind : 'horde';

/** Adds the finished fight's numbers to the run's totals. */
const tallyFight = (
  stats: RunStats,
  combat: CombatState,
  won: boolean,
  stop: Stop
) => ({
  wavesCleared: stats.wavesCleared + (won ? 1 : 0),
  heroesSlain: stats.heroesSlain + combat.slain,
  regionsConquered:
    stats.regionsConquered + (won && stop.kind === 'champion' ? 1 : 0),
  turns: stats.turns + combat.turn,
});

/**
 * Checks a fight after each action. While it is ongoing the new combat
 * state is stored; once it ends the run moves to rewards or to defeat.
 */
const finishRun = (state: RunState, battlefield?: { stop: Stop; combat: CombatState }): RunState => {
  return { ...state, ringDrops: [], phase: { kind: 'fallen', ...(battlefield && { battlefield }) } };
};

const settleCombat = (
  state: RunState,
  stop: Stop,
  combat: CombatState
): RunState => {
  const outcome = combatOutcome(combat);
  if (outcome === 'ongoing')
    return { ...state, phase: { kind: 'combat', stop, combat } };

  const won = outcome === 'won';
  const stats = tallyFight(state.stats, combat, won, stop);
  if (!won) return finishRun({ ...state, hp: 0, stats }, { stop, combat });

  const character = awardCharacterVictory(state.character);
  const isChampion = stop.kind === 'champion';
  const bossWins = character.ringProgress.bossWins + (isChampion ? 1 : 0);
  const victoryHeal = stop.kind === 'champion' ? CHAMPION_VICTORY_HEAL : 0;
  const deck = deckWithout(state.deck, combat.exhausted);
  const offers = rollOffers(
    stopSeed(state.dailyKey, 'reward', state.stop),
    rewardSourceOf(stop), [], state.rewardStarter, state.character.skillPicks, deck
  );
  return {
    ...state,
    hp: Math.min(state.maxHp, combat.player.hp + healingAmount(victoryHeal, character)),
    character: { ...character, ringProgress: { ...character.ringProgress, bossWins } },
    storyRingUnlocked: isChampion && bossWins <= 5 ? bossWins : undefined,
    deck,
    usesSpent: combat.usesSpent,
    stats,
    phase: { kind: 'reward', offers, source: rewardSourceOf(stop), leveledUp: character.level > state.character.level },
  };
};

/**
 * Adds the picked offer (if any) to the deck and moves on. A second
 * copy of a Unique card is never added.
 */
const takeOffer = (
  state: RunState,
  offers: CardId[],
  offerIndex: number | null
): RunState => {
  const picked = offerIndex === null ? undefined : offers[offerIndex];
  const canAdd = picked !== undefined && !isUniqueInDeck(state.deck, picked);
  const deck = canAdd ? [...state.deck, picked] : state.deck;
  return advanceToNextStop({ ...state, deck });
};

/** Applies the grave choice: heal now, or grow stronger for later. */
const visitGrave = (state: RunState, choice: GraveChoice): RunState => {
  if (choice === 'mourn') {
    const healed = healingAmount(Math.round(state.maxHp * GRAVE_HEAL_FRACTION), state.character);
    return advanceToNextStop({
      ...state,
      hp: Math.min(state.maxHp, state.hp + healed),
    });
  }
  return advanceToNextStop({
    ...state,
    baseMaxHp: (state.baseMaxHp ?? state.maxHp - characterBonuses(state.character.traits, state.character.equipment, state.character.traitNodes).maxHp + PLAYER_MAX_HP)
      + Math.min(PLAYER_HP_CAP - state.maxHp, GRAVE_VOW_MAX_HP),
    maxHp: Math.min(PLAYER_HP_CAP, state.maxHp + GRAVE_VOW_MAX_HP),
    hp: state.hp + Math.min(PLAYER_HP_CAP - state.maxHp, GRAVE_VOW_MAX_HP),
  });
};

// --- REDUCER ---

/** Apply the same character edits in a story run and in Illusion Training. */
export const applyCharacterAction = (
  character: CharacterState,
  action: Extract<RunAction, { type: 'setTraitNode' | 'setTraitPathRank' | 'setTraitRank' | 'allocateTrait' | 'buySkill' | 'skillPath' | 'equipItem' | 'discardItem' }>
): CharacterState => {
  switch (action.type) {
    case 'setTraitNode': return setTraitNode(character, action.trait, action.node, action.owned);
    case 'setTraitPathRank': return setTraitPathRank(character, action.trait, action.path, action.rank);
    case 'setTraitRank': return setTraitRank(character, action.trait, action.rank);
    case 'skillPath': return planSkillPath(character, action.pick).character;
    case 'buySkill': return buySkill(character, action.pick);
    case 'allocateTrait': return allocateTrait(character, action.trait);
    case 'equipItem': return equipItem(character, action.slot, action.itemId, action.ringIndex);
    case 'discardItem': return discardItem(character, action.itemId);
  }
};

/** Applies one action. Actions that don't fit the current phase are ignored. */
export const runReducer = (state: RunState, action: RunAction): RunState => {
  const { phase } = state;
  switch (action.type) {
    case 'starterDeck':
      return state.stop === 1 && phase.kind === 'route' && validStarter(action.name, action.cards)
        ? { ...state, ...(action.favorStarter && {rewardStarter: action.name}), deck: [...action.cards] } : state;
    case 'skillPath':
    case 'buySkill': {
      if (phase.kind === 'fallen') return state;
      const character = applyCharacterAction(state.character, action);
      return character === state.character ? state : { ...state, character };
    }
    case 'setTraitNode':
    case 'setTraitPathRank':
    case 'setTraitRank':
    case 'allocateTrait':
    case 'equipItem':
    case 'discardItem': {
      if (phase.kind === 'fallen') return state;
      const character = applyCharacterAction(state.character, action);
      if (character === state.character) return state;
      const credited = state.character.highestVigor ?? state.character.traits.vigor;
      const baseHp = state.baseMaxHp ?? state.maxHp - characterBonuses(state.character.traits, state.character.equipment, state.character.traitNodes).maxHp + PLAYER_MAX_HP;
      const health = traitHealth(state.hp, state.maxHp, state.character.traits, character, credited, baseHp, state.character.traitNodes, state.character.highestVigorHp);
      return { ...state, character, baseMaxHp: baseHp, ...health,
        phase: phase.kind === 'combat' ? { ...phase, combat: syncCharacterCombat(phase.combat, character, credited, baseHp, state.character.highestVigorHp) } : phase };
    }
    case 'chooseStop': {
      const chosen =
        phase.kind === 'route' ? phase.options[action.option] : undefined;
      return chosen ? enterStop(state, { ...chosen, optionIndex: action.option }) : state;
    }
    case 'playCard':
      return phase.kind === 'combat'
        ? settleCombat(
            state,
            phase.stop,
            playCard(
              phase.combat,
              action.handIndex,
              action.targetUid,
              action.targetUids,
              action.imbueIndex
            )
          )
        : state;
    case 'endTurn':
      return phase.kind === 'combat'
        ? settleCombat(state, phase.stop, endTurn(phase.combat))
        : state;
    case 'move':
    case 'charge':
    case 'backStep':
      return phase.kind === 'combat'
        ? settleCombat(state, phase.stop, move(phase.combat, moveIdOf(action)))
        : state;
    case 'rerollReward': {
      if (phase.kind !== 'reward' || phase.rerolled) return state;
      const offers = rollOffers(stopSeed(state.dailyKey, 'reward-reroll', state.stop), phase.source ?? 'horde', phase.offers, state.rewardStarter, state.character.skillPicks, state.deck);
      return { ...state, phase: { ...phase, offers, rerolled: true } };
    }
    case 'pickCard':
      return phase.kind === 'reward' || phase.kind === 'altar'
        ? takeOffer(state, phase.offers, action.offerIndex)
        : state;
    case 'graveChoice':
      return phase.kind === 'grave' ? visitGrave(state, action.choice) : state;
    case 'abandon':
      return phase.kind === 'fallen'
        ? state
        : finishRun(state);
  }
};

// --- REPLAY AND SCORE ---

/** Rebuilds a run from its action log (how the server verifies scores). */
export const replayRun = (
  dailyKey: string,
  actions: readonly RunAction[],
  ringProgress?: RingProgress,
  attempt = 0, wins = 0
): RunState => actions.reduce(runReducer, createRun(dailyKey, ringProgress, attempt, wins));

/** True once the heroes have stopped the villain. */
export const isRunOver = (state: RunState): boolean =>
  state.phase.kind === 'fallen';

/** The leaderboard score: how deep into the kingdom the villain pushed. */
export const computeScore = (stats: RunStats): number =>
  stats.wavesCleared * SCORE_PER_WAVE +
  stats.heroesSlain * SCORE_PER_HERO_SLAIN +
  stats.regionsConquered * SCORE_PER_REGION;

// --- INPUT VALIDATION ---

/** True for a non-negative whole number (hand slots, offers, uids). */
const isIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Most picks one action may carry (no card needs more; caps junk input). */
const MAX_TARGET_PICKS = 10;

/** True for a missing pick list, or a short list of uids. */
const isPickList = (value: unknown): boolean =>
  value === undefined ||
  (Array.isArray(value) &&
    value.length <= MAX_TARGET_PICKS &&
    value.every(isIndex));

/** Type guard for one logged action arriving from the network. */
export const isRunAction = (value: unknown): value is RunAction => {
  if (typeof value !== 'object' || value === null || !('type' in value))
    return false;
  switch (value.type) {
    case 'starterDeck': return (!('favorStarter' in value) || value.favorStarter === true) && 'name' in value && isStarterName(value.name) && 'cards' in value && validStarter(value.name,value.cards);
    case 'setTraitNode':
      return 'trait' in value && isTrait(value.trait) && 'node' in value &&
        isTraitNode(value.node) && 'owned' in value && typeof value.owned === 'boolean';
    case 'setTraitPathRank': return 'trait' in value && isTrait(value.trait) && 'path' in value && isTraitPath(value.path) && 'rank' in value && isTraitRank(value.rank) && value.rank <= traitPathCap(value.trait, value.path);
    case 'setTraitRank': return 'trait' in value && isTrait(value.trait) && 'rank' in value && isTraitRank(value.rank);
    case 'skillPath':
    case 'buySkill': return 'pick' in value && isSkillPick(value.pick);
    case 'allocateTrait': return 'trait' in value && isTrait(value.trait);
    case 'equipItem': return 'slot' in value && (value.slot === 'ring' || value.slot === 'amulet') && (!('ringIndex' in value) || (value.slot === 'ring' && isRingIndex(value.ringIndex))) && 'itemId' in value && (typeof value.itemId === 'string' || value.itemId === null);
    case 'discardItem': return 'itemId' in value && typeof value.itemId === 'string';
    case 'chooseStop':
      return 'option' in value && isIndex(value.option);
    case 'playCard':
      return (
        'handIndex' in value &&
        'targetUid' in value &&
        isIndex(value.handIndex) &&
        (value.targetUid === SELF_TARGET_UID || isIndex(value.targetUid)) &&
        (value.targetUid === SELF_TARGET_UID
          ? (!('targetUids' in value) || value.targetUids === undefined ||
            (Array.isArray(value.targetUids) && value.targetUids.length === 1 && value.targetUids[0] === SELF_TARGET_UID))
          : isPickList('targetUids' in value ? value.targetUids : undefined)) &&
        (!('imbueIndex' in value) ||
          value.imbueIndex === undefined ||
          isIndex(value.imbueIndex))
      );
    case 'move':
      return 'move' in value && isMovementId(value.move);
    case 'endTurn':
    case 'charge':
    case 'backStep':
    case 'rerollReward':
    case 'abandon':
      return true;
    case 'pickCard':
      return (
        'offerIndex' in value &&
        (value.offerIndex === null || isIndex(value.offerIndex))
      );
    case 'graveChoice':
      return (
        'choice' in value &&
        (value.choice === 'mourn' || value.choice === 'vow')
      );
    default:
      return false;
  }
};

