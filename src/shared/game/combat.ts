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
  formUp,
  legalTargets,
  pullHero,
  pushHero,
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
  CARDS_PER_TURN,
  LONG_RANGE_DAMAGE_FACTOR,
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
    lastMovement: null,
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
 * A Range hit at its proper range. Rounded (not floored) so even small
 * hits feel the bonus: 2 -> 3, 6 -> 8.
 */
const longRangeHit = (perHit: number): number =>
  Math.round(perHit * LONG_RANGE_DAMAGE_FACTOR);

/**
 * How one hero attack lands from where the hero stands: its type and
 * damage per hit. A Range attack from the back row is at its proper
 * range (LONG_RANGE_DAMAGE_FACTOR); made up close (from the front row)
 * it lands as a plain Melee hit.
 */
export const heroAttackOf = (
  unit: HeroUnit,
  effect: Extract<HeroEffect, { kind: 'attack' }>
): { type: HeroAttackType; perHit: number } => {
  const perHit = attackDamage(scaleByMight(effect.amount, unit.might), unit);
  if (effect.type !== 'range') return { type: effect.type, perHit };
  return unit.row === 'front'
    ? { type: 'melee', perHit }
    : { type: 'range', perHit: longRangeHit(perHit) };
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

/**
 * Resolves who an effect hits. `one` is the aimed hero (if still alive);
 * `all` is everyone for Reach cards and curses, the front row for melee.
 * With `isFollowThrough`, a `one` hit also lands on the aimed hero after
 * it fell to an earlier hit of the same card (see villainAttack).
 */
const resolveTargets = (
  state: CombatState,
  target: CardTarget,
  targetUid: number,
  isMelee = false,
  isFollowThrough = false
): number[] => {
  const living = state.heroes.filter((unit) => !isDefeated(unit));
  if (target === 'all')
    return areaTargets(living, isMelee).map((unit) => unit.uid);
  const pool = isFollowThrough ? state.heroes : living;
  return pool.some((unit) => unit.uid === targetUid) ? [targetUid] : [];
};

// --- CARD EFFECTS ---

/** True when a card hits `unit` at its proper range (Range at the back row). */
export const isLongRangeShot = (unit: HeroUnit, cardDef: CardDef): boolean =>
  cardDef.type === 'range' && unit.row === 'back';

/**
 * The damage multiplier a card gets from the hero it is aimed at (1
 * when the target adds nothing). Today only a long-range shot does.
 */
export const targetDamageFactor = (unit: HeroUnit, cardDef: CardDef): number =>
  isLongRangeShot(unit, cardDef) ? LONG_RANGE_DAMAGE_FACTOR : 1;

/** One villain hit on a hero: a Range card at a back-row hero hits harder. */
export const cardHitOn = (
  unit: HeroUnit,
  perHit: number,
  cardDef: CardDef
): number => (isLongRangeShot(unit, cardDef) ? longRangeHit(perHit) : perHit);

/**
 * Deals `hits` hits of villain attack damage to the targets. FOLLOW
 * THROUGH: a volley at one hero keeps landing after the hero falls,
 * until the card is done. HP stays at 0, so this changes no outcome;
 * it only adds overkill to damageTaken, so every hit of the volley still
 * shows its number. Fallen heroes leave when the card resolves.
 */
const villainAttack = (
  state: CombatState,
  effect: Extract<CardEffect, { kind: 'damage' }>,
  targetUid: number,
  cardDef: CardDef
): CombatState => {
  const isMelee = !cardDef.reach;
  const perHit = attackDamage(effect.amount, state.player, cardDef.type);
  const isFollowThrough = effect.target === 'one';
  return Array.from({ length: effect.hits }).reduce<CombatState>(
    (current) =>
      updateHeroes(
        current,
        resolveTargets(
          current,
          effect.target,
          targetUid,
          isMelee,
          isFollowThrough
        ),
        (unit) => takeDamage(unit, cardHitOn(unit, perHit, cardDef))
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
 * True when playing the card in `handIndex` with exactly these picks
 * (no padding: a Target N card still short of picks counts only the
 * ones made) would drop the hero `uid` to 0 HP. It runs the real card
 * resolution, so Guard, buffs, range and every hit count just as they
 * will when the card fires. Used to warn that an aim is lethal.
 */
export const wouldFell = (
  state: CombatState,
  handIndex: number,
  picks: readonly number[],
  uid: number
): boolean => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined || !canPlayCard(state, handIndex)) return false;
  const beats = cardBeats(payForCard(state, handIndex), cardId, picks);
  const target = beats.at(-1)?.heroes.find((unit) => unit.uid === uid);
  return target !== undefined && target.hp <= 0;
};

/**
 * Plays a card beat by beat, so the view can show each hit (of each
 * pick) land on its own: one state per beat, then exactly playCard()'s
 * result, which is what the server replays. The beats are for display
 * only (a felled hero still stands at 0 HP, so its overkill can show).
 * Empty when the play is illegal.
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
  return [...beats, playCard(state, handIndex, targetUid, targetUids)];
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
