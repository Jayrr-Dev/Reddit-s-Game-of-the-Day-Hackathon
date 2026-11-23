// ===================================================================
// COMBAT ENGINE
// One fight between the villain and a horde of heroes, as pure
// functions: (state, input) -> new state. Nothing here touches React,
// the network or the clock, which is what lets the server replay a run
// and lets the tests drive whole fights.
//
// TURN ORDER
//   Villain turn: play cards with energy, then End Turn.
//   End Turn: discard hand -> villain upkeep (hex) -> heroes clear shroud
//             -> each hero acts in order, then takes its own upkeep
//             -> new villain turn (clear shroud, refill energy, draw).
// ===================================================================

import {
  areaTargets,
  formUp,
  legalTargets,
  pullHero,
  pushHero,
  stepForward,
  targetRuleOf,
  type UnplacedHero,
} from './battlefield.ts';
import { getCard, type CardId } from './cards.ts';
import {
  addShroud,
  addStatus,
  attackDamage,
  clearShroud,
  createCombatant,
  endOfTurnUpkeep,
  heal,
  isDefeated,
  takeDamage,
} from './combatant.ts';
import { getHero, type HeroId } from './heroes.ts';
import { shuffle, type RngState } from './rng.ts';
import { CARDS_PER_TURN, ENERGY_PER_TURN, MAX_HAND_SIZE } from './rules.ts';
import type {
  CardEffect,
  CardTarget,
  CombatOutcome,
  CombatState,
  HeroEffect,
  HeroMove,
  HeroUnit,
} from './types.ts';

// --- SETUP ---
export type CombatSetup = {
  hp: number;
  maxHp: number;
  deck: readonly CardId[];
  heroIds: readonly HeroId[];
  /** Hero strength multiplier for this depth (1 = base stats). */
  might: number;
  seed: RngState;
};

/** Scales a hero number by might, rounding to a whole number. */
export const scaleByMight = (amount: number, might: number): number =>
  Math.round(amount * might);

/** Creates one hero; formUp() then gives it a place on the field. */
const createHeroUnit = (
  heroId: HeroId,
  uid: number,
  might: number
): UnplacedHero => {
  const maxHp = scaleByMight(getHero(heroId).maxHp, might);
  return { ...createCombatant(maxHp, maxHp), uid, heroId, moveIndex: 0, might };
};

/** Starts a fight: shuffles the deck and deals the first hand. */
export const startCombat = (setup: CombatSetup): CombatState => {
  const [drawPile, rng] = shuffle(setup.seed, setup.deck);
  const initial: CombatState = {
    player: createCombatant(setup.hp, setup.maxHp),
    heroes: formUp(
      setup.heroIds.map((id, index) =>
        createHeroUnit(id, index + 1, setup.might)
      )
    ),
    energy: 0,
    hand: [],
    drawPile,
    discardPile: [],
    fadedPile: [],
    turn: 0,
    slain: 0,
    rng,
  };
  return startPlayerTurn(initial);
};

// --- QUERIES ---

/** Whether the fight is still going, and who won if not. */
export const combatOutcome = (state: CombatState): CombatOutcome => {
  if (isDefeated(state.player)) return 'lost';
  return state.heroes.length === 0 ? 'won' : 'ongoing';
};

/** The move a hero will make on its next action. */
export const nextHeroMove = (unit: HeroUnit): HeroMove => {
  const { moves } = getHero(unit.heroId);
  const heroMove = moves[unit.moveIndex % moves.length];
  if (!heroMove) throw new Error(`Hero ${unit.heroId} has no moves`);
  return heroMove;
};

/** Heroes this card may be aimed at now (every hero for untargeted cards). */
export const targetsFor = (state: CombatState, cardId: CardId): HeroUnit[] =>
  legalTargets(state.heroes, targetRuleOf(cardId));

/**
 * True when the card in that hand slot can be played right now: it is
 * affordable and, if it needs a target, a legal one exists (a pull with
 * every back-row hero blocked cannot be played).
 */
export const canPlayCard = (state: CombatState, handIndex: number): boolean => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined || combatOutcome(state) !== 'ongoing') return false;
  const hasTarget =
    targetRuleOf(cardId) === 'none' || targetsFor(state, cardId).length > 0;
  return getCard(cardId).cost <= state.energy && hasTarget;
};

// --- DRAWING ---

/** Moves the discard pile into a freshly shuffled draw pile. */
const reshuffleDiscard = (state: CombatState): CombatState => {
  const [drawPile, rng] = shuffle(state.rng, state.discardPile);
  return { ...state, drawPile, discardPile: [], rng };
};

/** Draws one card; with a full hand the card is discarded instead. */
const drawOne = (state: CombatState): CombatState => {
  const ready = state.drawPile.length === 0 ? reshuffleDiscard(state) : state;
  const [top, ...rest] = ready.drawPile;
  if (top === undefined) return ready;
  return ready.hand.length >= MAX_HAND_SIZE
    ? { ...ready, drawPile: rest, discardPile: [...ready.discardPile, top] }
    : { ...ready, drawPile: rest, hand: [...ready.hand, top] };
};

/** Draws `count` cards, reshuffling the discard pile when needed. */
export const drawCards = (state: CombatState, count: number): CombatState =>
  Array.from({ length: count }).reduce<CombatState>(drawOne, state);

// --- HERO HELPERS ---

/** Applies `update` to the heroes whose uid is in `uids`. */
const updateHeroes = (
  state: CombatState,
  uids: readonly number[],
  update: (unit: HeroUnit) => HeroUnit
): CombatState => ({
  ...state,
  heroes: state.heroes.map((unit) =>
    uids.includes(unit.uid) ? update(unit) : unit
  ),
});

/**
 * Takes defeated heroes off the field and counts them as slain. If that
 * empties the front row, the back row steps forward.
 */
const removeFallen = (state: CombatState): CombatState => {
  const standing = state.heroes.filter((unit) => !isDefeated(unit));
  const fallen = state.heroes.length - standing.length;
  return fallen === 0
    ? state
    : { ...state, heroes: stepForward(standing), slain: state.slain + fallen };
};

/**
 * Resolves who an effect hits. `one` is the aimed hero (if still alive);
 * `all` is everyone for Reach cards and curses, the front row for melee.
 */
const resolveTargets = (
  state: CombatState,
  target: CardTarget,
  targetUid: number,
  isMelee = false
): number[] => {
  const living = state.heroes.filter((unit) => !isDefeated(unit));
  if (target === 'all')
    return areaTargets(living, isMelee).map((unit) => unit.uid);
  return living.some((unit) => unit.uid === targetUid) ? [targetUid] : [];
};

// --- CARD EFFECTS ---

/** Deals `hits` hits of villain attack damage to the targets. */
const villainAttack = (
  state: CombatState,
  effect: Extract<CardEffect, { kind: 'damage' }>,
  targetUid: number,
  isMelee: boolean
): CombatState => {
  const perHit = attackDamage(effect.amount, state.player);
  return Array.from({ length: effect.hits }).reduce<CombatState>(
    (current) =>
      updateHeroes(
        current,
        resolveTargets(current, effect.target, targetUid, isMelee),
        (unit) => takeDamage(unit, perHit)
      ),
    state
  );
};

/** Reap: damage equal to the target's hex times the multiplier. */
const reapHex = (
  state: CombatState,
  multiplier: number,
  targetUid: number
): CombatState =>
  updateHeroes(state, resolveTargets(state, 'one', targetUid), (unit) =>
    takeDamage(unit, unit.statuses.hex * multiplier)
  );

/** Resolves one card effect. `isMelee` is true for cards without Reach. */
const applyCardEffect = (
  state: CombatState,
  effect: CardEffect,
  targetUid: number,
  isMelee: boolean
): CombatState => {
  switch (effect.kind) {
    case 'damage':
      return villainAttack(state, effect, targetUid, isMelee);
    case 'hex':
    case 'dread':
      return updateHeroes(
        state,
        resolveTargets(state, effect.target, targetUid),
        (unit) => addStatus(unit, effect.kind, effect.amount)
      );
    case 'reap':
      return reapHex(state, effect.multiplier, targetUid);
    case 'shroud':
      return { ...state, player: addShroud(state.player, effect.amount) };
    case 'wrath':
      return {
        ...state,
        player: addStatus(state.player, 'wrath', effect.amount),
      };
    case 'draw':
      return drawCards(state, effect.amount);
    case 'energy':
      return { ...state, energy: state.energy + effect.amount };
    case 'heal':
      return { ...state, player: heal(state.player, effect.amount) };
    case 'pull':
      return { ...state, heroes: pullHero(state.heroes, targetUid) };
    case 'push':
      return { ...state, heroes: pushHero(state.heroes, targetUid) };
  }
};

/**
 * The hero a card actually hits: the requested one when it is a legal
 * target, otherwise the first legal hero. A replayed log can therefore
 * never aim at a ghost or past the front row.
 */
const aimCard = (
  state: CombatState,
  cardId: CardId,
  targetUid: number
): number => {
  const legal = targetsFor(state, cardId);
  return legal.some((unit) => unit.uid === targetUid)
    ? targetUid
    : (legal[0]?.uid ?? -1);
};

/**
 * Plays the card in `handIndex` at the hero with `targetUid`.
 * Illegal plays (no such card, not enough energy, fight over) return
 * the state unchanged, so bad input can never corrupt a run.
 */
export const playCard = (
  state: CombatState,
  handIndex: number,
  targetUid: number
): CombatState => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined || !canPlayCard(state, handIndex)) return state;

  const cardDef = getCard(cardId);
  const aimedUid = aimCard(state, cardId, targetUid);
  const paid: CombatState = {
    ...state,
    energy: state.energy - cardDef.cost,
    hand: state.hand.filter((_, index) => index !== handIndex),
  };
  const resolved = cardDef.effects.reduce<CombatState>(
    (current, effect) =>
      applyCardEffect(current, effect, aimedUid, !cardDef.reach),
    paid
  );
  const settled = cardDef.fades
    ? { ...resolved, fadedPile: [...resolved.fadedPile, cardId] }
    : { ...resolved, discardPile: [...resolved.discardPile, cardId] };
  return removeFallen(settled);
};

// --- HERO TURN ---

/** Returns the uids a hero's self/allies effect applies to. */
const heroTargets = (
  state: CombatState,
  actorUid: number,
  who: 'self' | 'allies'
) => (who === 'self' ? [actorUid] : state.heroes.map((unit) => unit.uid));

/** Resolves one effect of a hero's move. */
const applyHeroEffect = (
  state: CombatState,
  actor: HeroUnit,
  effect: HeroEffect
): CombatState => {
  const scaled = (amount: number) => scaleByMight(amount, actor.might);
  switch (effect.kind) {
    case 'attack': {
      const perHit = attackDamage(scaled(effect.amount), actor);
      return Array.from({ length: effect.hits }).reduce<CombatState>(
        (current) => ({
          ...current,
          player: takeDamage(current.player, perHit),
        }),
        state
      );
    }
    case 'hex':
      return {
        ...state,
        player: addStatus(state.player, 'hex', scaled(effect.amount)),
      };
    case 'dread':
      return {
        ...state,
        player: addStatus(state.player, 'dread', effect.amount),
      };
    case 'shroud':
      return updateHeroes(
        state,
        heroTargets(state, actor.uid, effect.who),
        (unit) => addShroud(unit, scaled(effect.amount))
      );
    case 'wrath':
      return updateHeroes(
        state,
        heroTargets(state, actor.uid, effect.who),
        (unit) => addStatus(unit, 'wrath', effect.amount)
      );
    case 'heal':
      return updateHeroes(
        state,
        heroTargets(state, actor.uid, effect.who),
        (unit) => heal(unit, scaled(effect.amount))
      );
  }
};

/**
 * One hero takes its turn: performs its move, then its own upkeep, then
 * advances to its next move. The actor is re-read after each effect so a
 * wrath gained mid-move applies to the attacks that follow it.
 */
const heroActs = (state: CombatState, uid: number): CombatState => {
  const actor = state.heroes.find((unit) => unit.uid === uid);
  if (!actor || isDefeated(state.player)) return state;

  const acted = nextHeroMove(actor).effects.reduce<CombatState>(
    (current, effect) => {
      const freshActor =
        current.heroes.find((unit) => unit.uid === uid) ?? actor;
      return isDefeated(current.player)
        ? current
        : applyHeroEffect(current, freshActor, effect);
    },
    state
  );

  const settled = updateHeroes(acted, [uid], (unit) => ({
    ...endOfTurnUpkeep(unit),
    moveIndex: unit.moveIndex + 1,
  }));
  return removeFallen(settled);
};

/** All heroes act in order, after their shroud from last round fades. */
const runHeroTurns = (state: CombatState): CombatState => {
  const ready = { ...state, heroes: state.heroes.map(clearShroud) };
  return ready.heroes
    .map((unit) => unit.uid)
    .reduce<CombatState>(heroActs, ready);
};

// --- VILLAIN TURN ---

/** Begins a villain turn: shroud fades, energy refills, new hand. */
const startPlayerTurn = (state: CombatState): CombatState =>
  drawCards(
    {
      ...state,
      player: clearShroud(state.player),
      energy: ENERGY_PER_TURN,
      turn: state.turn + 1,
    },
    CARDS_PER_TURN
  );

/** Ends the villain's turn and plays out the heroes' turn. */
export const endTurn = (state: CombatState): CombatState => {
  if (combatOutcome(state) !== 'ongoing') return state;

  // 1. DISCARD THE HAND, THEN THE VILLAIN'S OWN UPKEEP (HEX TICKS)
  const discarded: CombatState = {
    ...state,
    hand: [],
    discardPile: [...state.discardPile, ...state.hand],
    player: endOfTurnUpkeep(state.player),
  };
  if (combatOutcome(discarded) === 'lost') return discarded;

  // 2. THE HORDE ACTS
  const afterHeroes = runHeroTurns(discarded);
  if (combatOutcome(afterHeroes) !== 'ongoing') return afterHeroes;

  // 3. NEXT VILLAIN TURN
  return startPlayerTurn(afterHeroes);
};
