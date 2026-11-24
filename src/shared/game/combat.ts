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
  canPull,
  canPush,
  affectsSelf,
  areaTargets,
  cardAreaTargets,
  formUp,
  legalTargets,
  pullHero,
  pushHero,
  targetRuleOf,
  type UnplacedHero,
  cellsOf,
  isCellOpen,
  summonSeats,
} from './battlefield.ts';
import { getCard, type CardId } from './cards.ts';
import {
  addShroud,
  addStatus,
  attackDamage,
  damageFactorOf,
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
  Combatant,
  HeroAttackType,
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
    lastMovement: null,
    nextUid: setup.heroIds.length + 1,
    fallen: [],
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

/** True when a summon has room for at least one of its heroes. */
const hasRoomToSummon = (
  heroes: readonly HeroUnit[],
  unit: HeroUnit,
  effect: Extract<HeroEffect, { kind: 'summon' }>
): boolean =>
  summonSeats(heroes, unit, getHero(effect.heroId).size, effect.count).length >
  0;

/**
 * True when a hero can make a move where it stands: Melee needs the
 * front row, and a summon needs room in the hero's row.
 */
const canMakeMove = (
  heroMove: HeroMove,
  unit: HeroUnit,
  heroes: readonly HeroUnit[]
): boolean =>
  heroMove.effects.every((effect) => {
    if (effect.kind === 'summon') return hasRoomToSummon(heroes, unit, effect);
    return (
      unit.row === 'front' ||
      effect.kind !== 'attack' ||
      effect.type !== 'melee'
    );
  });

/**
 * The move a hero will make next: the next one in its cycle that it can
 * make from where it stands (a knight in the back row skips its Melee
 * moves for a Guard or Magic one; a summoner with a full row skips its
 * summon). `heroes` is the field it stands on. Null when it has none:
 * it only advances this turn.
 */
export const plannedHeroMove = (
  unit: HeroUnit,
  heroes: readonly HeroUnit[]
): PlannedMove | null => {
  const { moves } = getHero(unit.heroId);
  return (
    moves
      .map((_, step) => {
        const index = unit.moveIndex + step;
        return { move: moves[index % moves.length], index };
      })
      .find(
        (planned): planned is PlannedMove =>
          planned.move !== undefined && canMakeMove(planned.move, unit, heroes)
      ) ?? null
  );
};

/** How many moves a hero makes each heroes' turn (bosses make more). */
export const actionsOf = (unit: Pick<HeroUnit, 'heroId'>): number =>
  getHero(unit.heroId).actions ?? 1;

/**
 * Every move a hero will make this turn, in order: its next
 * `actionsOf` moves that it can make from where it stands. Empty when
 * it has none (it only advances).
 */
export const plannedHeroMoves = (
  unit: HeroUnit,
  heroes: readonly HeroUnit[]
): PlannedMove[] => {
  const planned: PlannedMove[] = [];
  let cursor = unit;
  // Imperative on purpose: each pick starts after the one before it.
  for (let action = 0; action < actionsOf(unit); action += 1) {
    const next = plannedHeroMove(cursor, heroes);
    if (!next) break;
    planned.push(next);
    cursor = { ...cursor, moveIndex: next.index + 1 };
  }
  return planned;
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

/** Drops summoned heroes whose summoner is gone (they fall with it). */
const withoutOrphans = (heroes: HeroUnit[]): HeroUnit[] => {
  const uids = new Set(heroes.map((unit) => unit.uid));
  const kept = heroes.filter(
    (unit) => unit.summonerUid === undefined || uids.has(unit.summonerUid)
  );
  // A summon's own summons fall too: repeat until nothing else drops.
  return kept.length === heroes.length ? kept : withoutOrphans(kept);
};

/**
 * Takes defeated heroes (and the heroes they summoned) off the field
 * and counts them as slain. An emptied front row stays empty for now:
 * melee heroes step up at the end of the heroes' turn, ranged ones hold
 * until the villain Charges.
 */
const removeFallen = (state: CombatState): CombatState => {
  const standing = withoutOrphans(
    state.heroes.filter((unit) => !isDefeated(unit))
  );
  const fallen = state.heroes.filter((unit) => !standing.includes(unit));
  return fallen.length === 0
    ? state
    : {
        ...state,
        heroes: standing,
        slain: state.slain + fallen.length,
        fallen: [...state.fallen, ...fallen],
      };
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

/**
 * Every multiplier on one play's damage at one hero, combined: the
 * villain's own (Charge's Momentum, Dread) times the target's (a long
 * Range shot). Rounded to 2 places for showing; 1 means none.
 */
export const playDamageFactor = (
  attacker: Combatant,
  unit: HeroUnit,
  cardDef: CardDef
): number => {
  const factor =
    damageFactorOf(attacker, cardDef.type) * targetDamageFactor(unit, cardDef);
  return Math.round(factor * 100) / 100;
};

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
 * True when playing this card at that hero would try to pull or push
 * it and fail (a boss can't be moved), so the view can show it shrug
 * the knockback off. The rest of the card still lands.
 */
export const movementFailsOn = (
  state: CombatState,
  cardId: CardId,
  uid: number
): boolean => {
  const unit = state.heroes.find((hero) => hero.uid === uid);
  if (!unit) return false;
  return getCard(cardId).effects.some(
    (effect) =>
      (effect.kind === 'pull' && !canPull(state.heroes, unit)) ||
      (effect.kind === 'push' && !canPush(state.heroes, unit))
  );
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
 * Every hero a card would be played at when the player lets the game
 * choose (tapping a held card again), one per pick. Heroes the card
 * would kill come first, toughest first, so a kill is worth the most;
 * then the rest, weakest first. Ties keep board order. Picks the
 * player already made (`chosen`) stay first; the rest are filled with
 * heroes not yet picked, wrapping round if there are too few. Empty
 * when nothing can be hit.
 */
export const autoTargets = (
  state: CombatState,
  handIndex: number,
  chosen: readonly number[] = []
): number[] => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined) return [];
  const legal = targetsFor(state, cardId);
  if (legal.length === 0) return [];
  const isLethal = (unit: HeroUnit) =>
    wouldFell(state, handIndex, [unit.uid], unit.uid);
  // RANKING: sort is stable, so equal HP keeps board order.
  const ranked = [
    ...legal.filter(isLethal).sort((a, b) => b.hp - a.hp),
    ...legal.filter((unit) => !isLethal(unit)).sort((a, b) => a.hp - b.hp),
  ];
  const fresh = ranked.filter((unit) => !chosen.includes(unit.uid));
  const pool = fresh.length > 0 ? fresh : ranked;
  const missing = Math.max(0, getCard(cardId).targets - chosen.length);
  const fill = Array.from(
    { length: missing },
    (_, pick) => pool[pick % pool.length]?.uid ?? -1
  );
  return [...chosen, ...fill];
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

/**
 * Brings summoned heroes onto the field beside the summoner, as strong
 * as it is (same might), bound to it. Each gets a fresh uid.
 */
const summonHeroes = (
  state: CombatState,
  summoner: HeroUnit,
  effect: Extract<HeroEffect, { kind: 'summon' }>
): CombatState => {
  const { size } = getHero(effect.heroId);
  const seats = summonSeats(state.heroes, summoner, size, effect.count);
  const summoned = seats.map(({ row, col }, index): HeroUnit => ({
    ...createHeroUnit(effect.heroId, state.nextUid + index, summoner.might),
    row,
    col,
    summonerUid: summoner.uid,
    joinedMidFight: true,
  }));
  return {
    ...state,
    heroes: [...state.heroes, ...summoned],
    nextUid: state.nextUid + summoned.length,
  };
};

/**
 * Brings every fallen ally back at full HP, each into the spot it fell
 * in when that spot is free (the rest stay fallen). Each comes back
 * with a fresh uid, still bound to its summoner if that one stands.
 * Imperative: each return changes the room left for the next.
 */
const reviveFallen = (state: CombatState): CombatState => {
  let heroes = state.heroes;
  let nextUid = state.nextUid;
  const stillFallen: HeroUnit[] = [];
  for (const ghost of state.fallen) {
    if (!cellsOf(ghost).every((cell) => isCellOpen(heroes, cell))) {
      stillFallen.push(ghost);
      continue;
    }
    const { summonerUid } = ghost;
    const isBound =
      summonerUid !== undefined &&
      heroes.some((unit) => unit.uid === summonerUid);
    const revived: HeroUnit = {
      ...createHeroUnit(ghost.heroId, nextUid, ghost.might),
      row: ghost.row,
      col: ghost.col,
      joinedMidFight: true,
      ...(isBound ? { summonerUid } : {}),
    };
    heroes = [...heroes, revived];
    nextUid += 1;
  }
  return { ...state, heroes, nextUid, fallen: stillFallen };
};

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
    case 'summon':
      return summonHeroes(state, actor, effect);
    case 'revive':
      return reviveFallen(state);
  }
};

/**
 * One hero takes one action: performs its planned move (if it has one
 * it can make from where it stands) and moves on in its cycle past it;
 * after its last action of the turn (`isLast`) its own upkeep runs too.
 * The actor is re-read after each effect so a wrath gained mid-move
 * applies to the attacks that follow it.
 */
const heroActs = (
  state: CombatState,
  uid: number,
  isLast = true
): CombatState => {
  const actor = state.heroes.find((unit) => unit.uid === uid);
  if (!actor || isDefeated(state.player)) return state;
  const planned = plannedHeroMove(actor, state.heroes);

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
    ...(isLast ? endOfTurnUpkeep(unit) : unit),
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
  /** The move just made (null when `actorUid` is). */
  move: HeroMove | null;
  state: CombatState;
};

/** How a hero's planned move attacks from where it stands, if it does. */
const plannedAttackType = (
  unit: HeroUnit,
  heroes: readonly HeroUnit[]
): HeroAttackType | null => {
  const attack = plannedHeroMove(unit, heroes)?.move.effects.find(
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
    { actorUid: null, attackType: null, move: null, state: discarded },
  ];
  if (combatOutcome(discarded) === 'lost') return steps;

  // 2. THE HORDE ACTS, FASTEST FIRST, EACH HERO ALL ITS ACTIONS IN A
  //    ROW (imperative: each step builds on the last, and fallen heroes
  //    or a fallen villain end it early)
  let current = discarded;
  for (const { uid, heroId } of heroTurnOrder(discarded.heroes)) {
    const actions = actionsOf({ heroId });
    for (let action = 1; action <= actions; action += 1) {
      const actor = current.heroes.find((unit) => unit.uid === uid);
      if (!actor) break;
      const planned = plannedHeroMove(actor, current.heroes);
      const hasMove = planned !== null;
      // Out of moves early: this is its last action (upkeep runs now).
      const isLast = action === actions || !hasMove;
      const attackType = plannedAttackType(actor, current.heroes);
      const next = heroActs(current, uid, isLast);
      if (next !== current) {
        steps.push({
          actorUid: hasMove ? uid : null,
          attackType,
          move: planned?.move ?? null,
          state: next,
        });
        current = next;
        if (combatOutcome(current) !== 'ongoing') return steps;
      }
      if (isLast) break;
    }
  }

  // 3. MELEE HEROES IN THE BACK ROW STEP UP, THEN THE NEXT VILLAIN TURN
  const advanced = { ...current, heroes: advanceMelee(current.heroes) };
  steps.push({
    actorUid: null,
    attackType: null,
    move: null,
    state: startPlayerTurn(advanced),
  });
  return steps;
};

/** Ends the villain's turn and plays out the heroes' turn. */
export const endTurn = (state: CombatState): CombatState =>
  endTurnSteps(state).at(-1)?.state ?? state;
