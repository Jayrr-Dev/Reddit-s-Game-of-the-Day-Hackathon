// ===================================================================
// USE SANDBOX
// The practice character is saved locally. Start a fight only after setup.
// ===================================================================

import { stockTrainingInventory } from '../../shared/game/trainingJewelry';
import { useCallback, useEffect, useReducer } from 'react';
import {
  LEVEL_CAP, createCharacter,
  restoreCharacter, syncCharacterCombat, type CharacterState,
} from '../../shared/game/character';
import { applyCharacterAction, type RunAction } from '../../shared/game/run';
import type { HeroId } from '../../shared/game/heroes';
import {
  createSandbox,
  createSandboxWith,
  stepSandbox, retryTrainingFight,
} from '../../shared/game/sandbox';
import type { CardId } from '../../shared/game/cards';
import { activeTrainingCards, restoreTrainingDecks, saveTrainingDeck, type TrainingDeckSelection, type SandboxDeckId } from '../../shared/game/sandboxDecks';
import type { CombatState } from '../../shared/game/types';

// --- TYPES ---
/**
 * The fight, a count of reshuffles (used as the view's key), and the
 * test deck every new fight is dealt from.
 */
type SandboxState = TrainingDeckSelection & {
  character: CharacterState;
  combat: CombatState | null;
  opening: CombatState | null;
  retries: number;
  round: number;
  deck: CardId[];
};

type SandboxEvent =
  | { type: 'act'; action: RunAction }
  | { type: 'custom'; id: string; seed: number }
  | { type: 'saveDeck'; id: string; name: string; cards: readonly CardId[]; editing: boolean; seed: number }
  | { type: 'retry' }
  | { type: 'respec' }
  | { type: 'reshuffle'; seed: number }
  | {
      type: 'summon';
      seed: number;
      heroIds: readonly HeroId[];
      startsInPlace: boolean;
    }
  | { type: 'deck'; seed: number; deckId: SandboxDeckId };

// --- HELPERS ---
/** A fresh seed; practice fights don't need to be reproducible. */
const freshSeed = (): number => Math.floor(Math.random() * 2 ** 32);

// --- REDUCER ---
/** Routes combat inputs to the engine; other run actions are ignored. */
const reduce = (state: SandboxState, event: SandboxEvent): SandboxState => {
  const { character, round } = state;
  const source = state.activeCustomId ? state.deck : state.deckId;
  if (event.type === 'retry') {
    if (!state.combat || !state.opening || state.combat.player.hp > 0) return state;
    const combat = retryTrainingFight(state.opening, character);
    return { ...state, combat, retries: state.retries + 1 };
  }
  if (event.type === 'reshuffle' || event.type === 'summon') {
    const combat = event.type === 'reshuffle' ? createSandbox(event.seed, source, character.traits, character.equipment, character.traitNodes)
      : createSandboxWith(event.seed, event.heroIds, event.startsInPlace, source, character.traits, character.equipment, character.traitNodes);
    return { ...state, combat, opening: combat, round: state.combat ? round + 1 : round };
  }
  if (event.type === 'deck' || event.type === 'custom' || event.type === 'saveDeck') {
    let selection: TrainingDeckSelection;
    if (event.type === 'deck') selection = { ...state, activeCustomId: null, deckId: event.deckId };
    else if (event.type === 'custom') {
      if (!state.customDecks.some(saved => saved.id === event.id)) return state;
      selection = { ...state, activeCustomId: event.id };
    } else {
      selection = saveTrainingDeck(state, event.id, event.name, event.cards, event.editing);
      if (selection === state) return state;
    }
    const chosen = activeTrainingCards(selection);
    if (!state.combat) return { ...state, ...selection, deck: chosen };
    const heroes = state.combat.heroes.map(unit => unit.heroId);
    const combat = createSandboxWith(event.seed, heroes, false, selection.activeCustomId ? chosen : selection.deckId, character.traits, character.equipment, character.traitNodes);
    return { ...state, ...selection, deck: chosen, combat, opening: combat, round: round + 1 };
  }
  const credited = character.highestVigor ?? character.traits.vigor;
  if (event.type === 'respec') {
    const { savedTraitNodes: _lifted, ...unlocked } = character; // A respec also lifts the Save traits lock.
    const next = { ...unlocked, highestVigor: credited, traits: createCharacter().traits, traitNodes: {} };
    return { ...state, character: next, combat: state.combat && syncCharacterCombat(state.combat, next, credited, undefined, character.highestVigorHp) };
  }
  const { action } = event;
  if (action.type === 'buySkill' || action.type === 'skillPath' || action.type === 'saveTraits') {
    const next = applyCharacterAction(character, action);
    return next === character ? state : { ...state, character: next };
  }
  if (action.type === 'setTraitNode' || action.type === 'setTraitPathRank' || action.type === 'setTraitRank' ||
      action.type === 'allocateTrait' || action.type === 'equipItem') {
    const next = applyCharacterAction(character, action);
    return next === character ? state : {
      ...state, character: next,
      combat: state.combat && syncCharacterCombat(state.combat, next, credited, undefined, character.highestVigorHp),
    };
  }
  const isCombatInput =
    action.type === 'playCard' ||
    action.type === 'endTurn' ||
    action.type === 'move';
  if (!isCombatInput || !state.combat) return state;
  const { combat } = stepSandbox(state.combat, action);
  return combat === state.combat ? state : { ...state, combat };
};

// --- PRACTICE SAVE ---
const DECK_SAVE_KEY = 'villain-arc:practice:decks';
const PRACTICE_SAVE_KEY = 'villain-arc:practice:character';

/** Restores the practice character without touching a ranked run. */
const startPractice = (): SandboxState => {
  let character: CharacterState;
  try {
    character = restoreCharacter(JSON.parse(localStorage.getItem(PRACTICE_SAVE_KEY) ?? 'null'), true);
  } catch {
    character = restoreCharacter(null, true);
  }
  character = { ...character, inventory: stockTrainingInventory(character), level: LEVEL_CAP, xp: 0 };
  let selection = restoreTrainingDecks(null);
  try { selection = restoreTrainingDecks(JSON.parse(localStorage.getItem(DECK_SAVE_KEY) ?? 'null')); }
  catch { /* Practice also works without browser storage. */ }
  const deck = activeTrainingCards(selection);
  return { ...selection, character, deck, combat: null, opening: null, round: 0, retries: 0 };
};

// --- HOOK ---
/** Returns the practice fight and functions to act or reroll the dummies. */
export const useSandbox = () => {
  const [state, send] = useReducer(reduce, null, startPractice);
  useEffect(() => {
    try {
      localStorage.setItem(PRACTICE_SAVE_KEY, JSON.stringify(state.character));
    } catch {
      // Practice still runs in webviews where storage is unavailable.
    }
  }, [state.character]);

  /** Sends one combat input to the sandbox engine. */
  const act = useCallback(
    (action: RunAction) => send({ type: 'act', action }),
    []
  );

  /** Rolls a brand-new set of dummies and a fresh hand. */
  const reshuffle = useCallback(
    () => send({ type: 'reshuffle', seed: freshSeed() }),
    []
  );

  /**
   * Starts a fight against chosen heroes (e.g. a test creature), marched
   * in as usual or (startsInPlace) already in their home lines.
   */
  const summon = useCallback(
    (heroIds: readonly HeroId[], startsInPlace = false) =>
      send({ type: 'summon', seed: freshSeed(), heroIds, startsInPlace }),
    []
  );

  /** Deals a new fight from a themed test deck, against the same dummies. */
  const pickDeck = useCallback(
    (deckId: SandboxDeckId) =>
      send({ type: 'deck', seed: freshSeed(), deckId }),
    []
  );

  const { customDecks, activeCustomId, deckId } = state;
  useEffect(() => {
    try { localStorage.setItem(DECK_SAVE_KEY, JSON.stringify({ customDecks, activeCustomId, deckId })); }
    catch { /* Keep the editor usable when storage is disabled. */ }
  }, [customDecks, activeCustomId, deckId]);
  const pickCustomDeck = useCallback((id: string) => send({ type: 'custom', id, seed: freshSeed() }), []);
  const saveCustomDeck = useCallback((name: string, cards: readonly CardId[], id?: string) =>
    send({ type: 'saveDeck', name, cards: [...cards], id: id ?? crypto.randomUUID(), editing: id !== undefined, seed: freshSeed() }), []);
  const retry = useCallback(() => send({type: 'retry'}), []);
  const respec = useCallback(() => send({ type: 'respec' }), []);
  return { ...state, retry, respec, act, reshuffle, summon, pickDeck, pickCustomDeck, saveCustomDeck } as const;
};

