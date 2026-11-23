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
//             -> each hero acts, fastest first (see heroTurnOrder), then
//                takes its own upkeep
//             -> new villain turn (clear shroud, refill energy, draw).
// ===================================================================

import {
  advanceMelee,
  affectsSelf,
  areaTargets,
  cardAreaTargets,
  fallBack,
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
  guardAmount,
  hasMomentumFor,
  heal,
  isDefeated,
  takeDamage,
  typeBonus,
} from './combatant.ts';
import { getHero, type HeroId } from './heroes.ts';
import { shuffle, type RngState } from './rng.ts';
import {
  BACK_STEP_COST,
  CARDS_PER_TURN,
  CHARGE_COST,
  CLOSE_RANGE_DAMAGE_FACTOR,
  ENERGY_PER_TURN,
  MAX_HAND_SIZE,
} from './rules.ts';
import type {
  CardDef,
  CardEffect,
  CardTarget,
  CombatOutcome,
  CombatState,
  HeroAttackType,
  HeroEffect,
  HeroMove,
  HeroRow,
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

/** A hero's next move and its place in the hero's move cycle. */
export type PlannedMove = { move: HeroMove; index: number };

/** True when a move can be made from `row` (Melee needs the front row). */
const canMakeMoveFrom = (heroMove: HeroMove, row: HeroRow): boolean =>
  row === 'front' ||
  heroMove.effects.every(
    (effect) => effect.kind !== 'attack' || effect.type !== 'melee'
  );

/**
 * The move a hero will make next: the next one in its cycle that it can
 * make from where it stands (a knight in the back row skips its Melee
 * moves for a Guard or Magic one). Null when it has none: it only
 * advances this turn.
 */
export const plannedHeroMove = (unit: HeroUnit): PlannedMove | null => {
  const { moves } = getHero(unit.heroId);
  return (
    moves
      .map((_, step) => {
        const index = unit.moveIndex + step;
        return { move: moves[index % moves.length], index };
      })
      .find(
        (planned): planned is PlannedMove =>
          planned.move !== undefined && canMakeMoveFrom(planned.move, unit.row)
      ) ?? null
  );
};

/**
 * How one hero attack lands from where the hero stands: its type and
 * damage per hit. A Range attack made up close (from the front row)
 * lands as Melee, for CLOSE_RANGE_DAMAGE_FACTOR of the damage.
 */
export const heroAttackOf = (
  unit: HeroUnit,
  effect: Extract<HeroEffect, { kind: 'attack' }>
): { type: HeroAttackType; perHit: number } => {
  const perHit = attackDamage(scaleByMight(effect.amount, unit.might), unit);
  const isUpClose = unit.row === 'front';
  return effect.type === 'range' && isUpClose
    ? { type: 'melee', perHit: Math.floor(perHit * CLOSE_RANGE_DAMAGE_FACTOR) }
    : { type: effect.type, perHit };
};

/** Heroes this card may be aimed at now (every hero for untargeted cards). */
export const targetsFor = (state: CombatState, cardId: CardId): HeroUnit[] =>
  legalTargets(state.heroes, targetRuleOf(cardId));

/**
 * True when an untargeted card would be wasted: it only acts on heroes,
 * through area effects, and none of them reach anyone (a front-row
 * sweep like Cleave while the front row stands empty).
 */
const isAreaCardWasted = (state: CombatState, cardId: CardId): boolean =>
  !affectsSelf(cardId) &&
  getCard(cardId).effects.some(
    (effect) => 'target' in effect && effect.target === 'all'
  ) &&
  cardAreaTargets(state.heroes, cardId).length === 0;

/**
 * True when the card in that hand slot can be played right now: it is
 * affordable and has someone to act on. A targeted card needs a legal
 * target (a pull with every back-row hero blocked cannot be played,
 * nor a Melee strike with the front row empty); an area card needs
 * someone in its reach.
 */
export const canPlayCard = (state: CombatState, handIndex: number): boolean => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined || combatOutcome(state) !== 'ongoing') return false;
  const hasTarget =
    targetRuleOf(cardId) === 'none'
      ? !isAreaCardWasted(state, cardId)
      : targetsFor(state, cardId).length > 0;
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
 * Takes defeated heroes off the field and counts them as slain. An
 * emptied front row stays empty for now: melee heroes step up at the
 * end of the heroes' turn, ranged ones hold until the villain Charges.
 */
const removeFallen = (state: CombatState): CombatState => {
  const standing = state.heroes.filter((unit) => !isDefeated(unit));
  const fallen = state.heroes.length - standing.length;
  return fallen === 0
    ? state
    : { ...state, heroes: standing, slain: state.slain + fallen };
};

// --- CHARGE ---
/**
 * True when the villain can Charge: the fight is on, the front row is
 * empty, someone holds the back row, and there is energy to pay.
 */
export const canCharge = (state: CombatState): boolean =>
  combatOutcome(state) === 'ongoing' &&
  state.energy >= CHARGE_COST &&
  state.heroes.length > 0 &&
  state.heroes.every((unit) => unit.row === 'back');

/**
 * Charges the back row: pays CHARGE_COST, every hero steps up, and the
 * villain gains Momentum (the next Melee card hits 50% harder).
 */
export const charge = (state: CombatState): CombatState =>
  canCharge(state)
    ? {
        ...state,
        energy: state.energy - CHARGE_COST,
        heroes: stepForward(state.heroes),
        player: {
          ...state.player,
          statuses: { ...state.player.statuses, momentum: 1 },
        },
      }
    : state;

// --- BACK STEP ---
/**
 * True when the villain can Back Step: the fight is on, the back row is
 * empty (everyone is up close), and there is energy to pay.
 */
export const canBackStep = (state: CombatState): boolean =>
  combatOutcome(state) === 'ongoing' &&
  state.energy >= BACK_STEP_COST &&
  state.heroes.length > 0 &&
  state.heroes.every((unit) => unit.row === 'front');

/**
 * Backs off from the front row: pays BACK_STEP_COST and the whole field
 * falls back a row. Their intents change at once (Melee heroes can't
 * reach; Range heroes shoot at full damage) until melee heroes step up
 * again at the end of the heroes' turn.
 */
export const backStep = (state: CombatState): CombatState =>
  canBackStep(state)
    ? {
        ...state,
        energy: state.energy - BACK_STEP_COST,
        heroes: fallBack(state.heroes),
      }
    : state;

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

/** One villain hit on a hero: a Range card up close deals less. */
const villainHitOn = (
  unit: HeroUnit,
  perHit: number,
  cardDef: CardDef
): number =>
  cardDef.type === 'range' && unit.row === 'front'
    ? Math.floor(perHit * CLOSE_RANGE_DAMAGE_FACTOR)
    : perHit;

/** Deals `hits` hits of villain attack damage to the targets. */
const villainAttack = (
  state: CombatState,
  effect: Extract<CardEffect, { kind: 'damage' }>,
  targetUid: number,
  cardDef: CardDef
): CombatState => {
  const isMelee = !cardDef.reach;
  const perHit = attackDamage(effect.amount, state.player, cardDef.type);
  return Array.from({ length: effect.hits }).reduce<CombatState>(
    (current) =>
      updateHeroes(
        current,
        resolveTargets(current, effect.target, targetUid, isMelee),
        (unit) => takeDamage(unit, villainHitOn(unit, perHit, cardDef))
      ),
    state
  );
};

/**
 * Reap: damage equal to the target's hex times the multiplier, plus the
 * card type's buff (Surge for a Magic reap).
 */
const reapHex = (
  state: CombatState,
  multiplier: number,
  targetUid: number,
  cardDef: CardDef
): CombatState => {
  const bonus = typeBonus(state.player, cardDef.type);
  return updateHeroes(state, resolveTargets(state, 'one', targetUid), (unit) =>
    takeDamage(unit, unit.statuses.hex * multiplier + bonus)
  );
};

/** Resolves one effect of the card `cardDef` (its type picks the buff). */
const applyCardEffect = (
  state: CombatState,
  effect: CardEffect,
  targetUid: number,
  cardDef: CardDef
): CombatState => {
  switch (effect.kind) {
    case 'damage':
      return villainAttack(state, effect, targetUid, cardDef);
    case 'hex':
    case 'dread':
      return updateHeroes(
        state,
        resolveTargets(state, effect.target, targetUid),
        (unit) => addStatus(unit, effect.kind, effect.amount)
      );
    case 'reap':
      return reapHex(state, effect.multiplier, targetUid, cardDef);
    case 'shroud': {
      const amount = guardAmount(effect.amount, state.player);
      return { ...state, player: addShroud(state.player, amount) };
    }
    case 'buff':
      return {
        ...state,
        player: addStatus(state.player, effect.buff, effect.amount),
      };
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
  // Mid-card (between picks) a felled hero still stands at 0 HP.
  const legal = targetsFor(state, cardId).filter((unit) => !isDefeated(unit));
  return legal.some((unit) => unit.uid === targetUid)
    ? targetUid
    : (legal[0]?.uid ?? -1);
};

/** A Melee card uses up Momentum once it has resolved (all its hits). */
const spendMomentum = (state: CombatState, cardDef: CardDef): CombatState =>
  hasMomentumFor(state.player, cardDef.type)
    ? {
        ...state,
        player: {
          ...state.player,
          statuses: { ...state.player.statuses, momentum: 0 },
        },
      }
    : state;

/** Spends the card's energy and takes it out of the hand. */
const payForCard = (state: CombatState, handIndex: number): CombatState => {
  const cardId = state.hand[handIndex];
  const cost = cardId === undefined ? 0 : getCard(cardId).cost;
  return {
    ...state,
    energy: state.energy - cost,
    hand: state.hand.filter((_, index) => index !== handIndex),
  };
};

/** A multi-hit damage effect split into single hits (same numbers). */
const oneHitAtATime = (effect: CardEffect): CardEffect[] =>
  effect.kind === 'damage' && effect.hits > 1
    ? Array.from({ length: effect.hits }, () => ({ ...effect, hits: 1 }))
    : [effect];

/**
 * The hero asked for on each pick. A Target N card takes N picks (a
 * short list repeats its last pick); every other card takes one.
 */
const requestedPicks = (
  cardDef: CardDef,
  targetUid: number,
  targetUids: readonly number[] | undefined
): number[] => {
  const asked = targetUids && targetUids.length > 0 ? targetUids : [targetUid];
  return Array.from(
    { length: cardDef.targets },
    (_, pick) => asked[Math.min(pick, asked.length - 1)] ?? targetUid
  );
};

/**
 * Resolves a paid-for card and returns the state after every beat (each
 * hit of each pick). Splitting hits changes nothing: a card's hits all
 * use the damage worked out before the first one.
 */
const cardBeats = (
  paid: CombatState,
  cardId: CardId,
  picks: readonly number[]
): CombatState[] => {
  const cardDef = getCard(cardId);
  const beats = cardDef.effects.flatMap(oneHitAtATime);
  const states: CombatState[] = [];
  let current = paid;
  // Imperative on purpose: each pick aims at the field the last one left
  // (a hero felled by pick 1 can't be hit by pick 2; the aim moves on).
  for (const requested of picks) {
    const aimed = aimCard(current, cardId, requested);
    for (const effect of beats) {
      current = applyCardEffect(current, effect, aimed, cardDef);
      states.push(current);
    }
  }
  return states;
};

/**
 * Plays the card in `handIndex` at the hero with `targetUid` (or, for a
 * Target N card, at each hero in `targetUids` in turn; the same hero
 * may be picked more than once). Illegal plays (no such card, not
 * enough energy, fight over) return the state unchanged, so bad input
 * can never corrupt a run.
 */
export const playCard = (
  state: CombatState,
  handIndex: number,
  targetUid: number,
  targetUids?: readonly number[]
): CombatState => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined || !canPlayCard(state, handIndex)) return state;
  const cardDef = getCard(cardId);
  const paid = payForCard(state, handIndex);
  const picks = requestedPicks(cardDef, targetUid, targetUids);
  const resolved = spendMomentum(
    cardBeats(paid, cardId, picks).at(-1) ?? paid,
    cardDef
  );
  const settled = cardDef.fades
    ? { ...resolved, fadedPile: [...resolved.fadedPile, cardId] }
    : { ...resolved, discardPile: [...resolved.discardPile, cardId] };
  return removeFallen(settled);
};

/**
 * Plays a card beat by beat, so the view can show each hit (of each
 * pick) land on its own. The middle states are for display only (a
 * felled hero still stands at 0 HP); the last step is exactly
 * playCard()'s result, which is what the server replays. Empty when
 * the play is illegal.
 */
export const playCardSteps = (
  state: CombatState,
  handIndex: number,
  targetUid: number,
  targetUids?: readonly number[]
): CombatState[] => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined || !canPlayCard(state, handIndex)) return [];
  const picks = requestedPicks(getCard(cardId), targetUid, targetUids);
  const beats = cardBeats(payForCard(state, handIndex), cardId, picks);
  return [
    ...beats.slice(0, -1),
    playCard(state, handIndex, targetUid, targetUids),
  ];
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
      const { perHit } = heroAttackOf(actor, effect);
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
 * One hero takes its turn: performs its planned move (if it has one it
 * can make from where it stands), then its own upkeep, then moves on in
 * its cycle past that move. The actor is re-read after each effect so a
 * wrath gained mid-move applies to the attacks that follow it.
 */
const heroActs = (state: CombatState, uid: number): CombatState => {
  const actor = state.heroes.find((unit) => unit.uid === uid);
  if (!actor || isDefeated(state.player)) return state;
  const planned = plannedHeroMove(actor);

  const acted = (planned?.move.effects ?? []).reduce<CombatState>(
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
    moveIndex: planned ? planned.index + 1 : unit.moveIndex,
  }));
  return removeFallen(settled);
};

/**
 * The order heroes act in: fastest first; equal speeds go by uid (the
 * order they joined the fight), so the order is always the same and the
 * server's replay matches the player's screen.
 */
export const heroTurnOrder = (heroes: readonly HeroUnit[]): HeroUnit[] =>
  [...heroes].sort(
    (a, b) => getHero(b.heroId).speed - getHero(a.heroId).speed || a.uid - b.uid
  );

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

/**
 * One beat of the end of a turn: the state right after it, the hero who
 * just made a move (null for upkeep, a hero with no move, and the new
 * turn), and how that move's attacks landed (null if it had none).
 */
export type TurnStep = {
  actorUid: number | null;
  attackType: HeroAttackType | null;
  state: CombatState;
};

/** How a hero's planned move attacks from where it stands, if it does. */
const plannedAttackType = (unit: HeroUnit): HeroAttackType | null => {
  const attack = plannedHeroMove(unit)?.move.effects.find(
    (effect) => effect.kind === 'attack'
  );
  return attack?.kind === 'attack' ? heroAttackOf(unit, attack).type : null;
};

/**
 * Ends the villain's turn, beat by beat, so the view can play the
 * heroes' attacks one at a time. The last step is the final state.
 * Empty when the fight is already over.
 */
export const endTurnSteps = (state: CombatState): TurnStep[] => {
  if (combatOutcome(state) !== 'ongoing') return [];

  // 1. DISCARD THE HAND, THE VILLAIN'S UPKEEP (HEX TICKS), AND THE
  //    HEROES' SHROUD FROM LAST ROUND FADES
  const discarded: CombatState = {
    ...state,
    hand: [],
    discardPile: [...state.discardPile, ...state.hand],
    player: endOfTurnUpkeep(state.player),
    heroes: state.heroes.map(clearShroud),
  };
  const steps: TurnStep[] = [
    { actorUid: null, attackType: null, state: discarded },
  ];
  if (combatOutcome(discarded) === 'lost') return steps;

  // 2. THE HORDE ACTS, FASTEST FIRST (imperative: each step builds on
  //    the last, and fallen heroes or a fallen villain end it early)
  let current = discarded;
  for (const { uid } of heroTurnOrder(discarded.heroes)) {
    const actor = current.heroes.find((unit) => unit.uid === uid);
    const hasMove = actor !== undefined && plannedHeroMove(actor) !== null;
    const attackType = actor ? plannedAttackType(actor) : null;
    const next = heroActs(current, uid);
    if (next === current) continue;
    steps.push({ actorUid: hasMove ? uid : null, attackType, state: next });
    current = next;
    if (combatOutcome(current) !== 'ongoing') return steps;
  }

  // 3. MELEE HEROES IN THE BACK ROW STEP UP, THEN THE NEXT VILLAIN TURN
  const advanced = { ...current, heroes: advanceMelee(current.heroes) };
  steps.push({
    actorUid: null,
    attackType: null,
    state: startPlayerTurn(advanced),
  });
  return steps;
};

/** Ends the villain's turn and plays out the heroes' turn. */
export const endTurn = (state: CombatState): CombatState =>
  endTurnSteps(state).at(-1)?.state ?? state;
