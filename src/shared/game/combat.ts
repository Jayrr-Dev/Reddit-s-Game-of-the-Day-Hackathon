// ===================================================================
// COMBAT ENGINE
// One fight between the villain and a horde of heroes, as pure
// functions: (state, input) -> new state. Nothing here touches React,
// the network or the clock, which is what lets the server replay a run
// and lets the tests drive whole fights.
//
// TURN ORDER
//   Villain turn: play cards with energy, then End Turn.
//   End Turn: discard hand -> villain Burn, upkeep (poison) -> heroes clear
//             guard
//             -> each hero, fastest first (see heroTurnOrder): its Hex
//                burns (see hexBurn), it acts (Burn and Frost run after
//                each action), then takes its own upkeep
//             -> new villain turn (clear guard, the villain's Hex
//                burns, refill energy, draw).
// ===================================================================

import {
  advanceHeroes,
  fallBack,
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
  cellCountOf,
  cellsOf,
  freeHeroCells,
  isAloft,
  isCellOpen,
  heroesPiercedPast,
  rowDepth,
  summonSeats,
} from './battlefield.ts';
import { getCard, type CardId } from './cards.ts';
import {
  addGuard,
  addStatus,
  afflictionAmount,
  castProtection,
  dropProtection,
  enfeebleTimes,
  enfeebleCheck,
  cleanseOne,
  attackDamage,
  damageFactorOf,
  expireGuard,
  createCombatant,
  afterAction,
  endOfTurnUpkeep,
  hexBurn,
  guardAmount,
  hasMomentumFor,
  heal,
  isDefeated,
  dodge,
  missShot,
  takeHit,
  typeBonus,
} from './combatant.ts';
import { isLongRangeOn } from './features.ts';
import { getHero, type HeroId } from './heroes.ts';
// A cycle (movement.ts reads combatOutcome) is safe: both sides only
// call each other inside functions, never while loading.
import { moveFree } from './movement.ts';
import {
  addToHand,
  cardHasKeyword,
  discardHand,
  foldImbuedDamage,
  imbueEffectOf,
  imbuedEffects,
  imbueSlot,
  imbueSlotsFor,
  imbuesAt,
  removeFromHand,
  stowPlayedImbues,
} from './imbue.ts';
import { nextFloat, shuffle, type RngState } from './rng.ts';
import {
  CARDS_PER_TURN,
  ELEMENT_ON_HIT,
  LONG_RANGE_DAMAGE_FACTOR,
  ENERGY_PER_TURN,
  MAX_HAND_SIZE,
  INSTINCT_DODGE_CHANCES,
  OUT_OF_RANGE_HIT_CHANCE,
  ULTRA_INSTINCT_STACKS,
  OUT_OF_RANGE_ROW,
  OUT_OF_RANGE_TYPES,
  PIERCE_DAMAGE_FACTOR,
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
  Imbue,
  ImbuableEffect,
  CardKeyword,
  MovementId,
  PassiveId,
  StatusId,
  TimedBuff,
  UsesSpent,
} from './types.ts';
import { spendUse } from './uses.ts';

// --- SETUP ---
export type CombatSetup = {
  hp: number;
  maxHp: number;
  deck: readonly CardId[];
  heroIds: readonly HeroId[];
  /** Hero strength multiplier for this depth (1 = base stats). */
  might: number;
  seed: RngState;
  /** Uses already spent on the run's Exhaust cards (default none). */
  usesSpent?: UsesSpent;
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
  const { maxHp: baseHp, armor = 0 } = getHero(heroId);
  const maxHp = scaleByMight(baseHp, might);
  const unit = createCombatant(maxHp, maxHp);
  const statuses = { ...unit.statuses, armor };
  return { ...unit, statuses, uid, heroId, moveIndex: 0, might };
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
    removedPile: [],
    exhausted: [],
    usesSpent: setup.usesSpent ?? {},
    handImbues: [],
    stowedImbues: [],
    timedBuffs: [],
    turn: 0,
    slain: 0,
    rng,
    lastMovement: null,
    freeMove: null,
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

/** True for a move that flies the hero up: it ends the hero's turn. */
export const isSoaring = (heroMove: HeroMove): boolean =>
  heroMove.effects.some((effect) => effect.kind === 'soar');

/** Moves a hero with Vigor makes each heroes' turn. */
const VIGOR_ACTIONS = 2;

/** A hero's built-in traits (none for most). */
export const passivesOf = (
  unit: Pick<HeroUnit, 'heroId'>
): readonly PassiveId[] =>
  (getHero(unit.heroId).passives ?? []).filter(
    (passive) => passive !== 'longRange' || isLongRangeOn()
  );

/** How many moves a hero makes each heroes' turn: 2 with Vigor, else 1. */
export const actionsOf = (unit: Pick<HeroUnit, 'heroId'>): number =>
  passivesOf(unit).includes('vigor') ? VIGOR_ACTIONS : 1;

/**
 * Every move a hero will make this turn, in order: its next
 * `actionsOf` moves that it can make from where it stands, cut short
 * by a move that flies it up (see isSoaring). Empty when it has none
 * (it only advances).
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
    if (isSoaring(next.move)) break;
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
 * damage per hit. A Range attack from past the front row is at its
 * proper range (LONG_RANGE_DAMAGE_FACTOR); made up close (the front row)
 * it loses that bonus but is still a Range hit (its VFX, Shock and
 * anything else that reads the type all see Range).
 */
export const heroAttackOf = (
  unit: HeroUnit,
  effect: Extract<HeroEffect, { kind: 'attack' }>
): { type: HeroAttackType; perHit: number } => {
  const perHit = attackDamage(scaleByMight(effect.amount, unit.might), unit);
  if (effect.type !== 'range') return { type: effect.type, perHit };
  const isLongRange = rowDepth(unit.row) > 0;
  return { type: 'range', perHit: isLongRange ? longRangeHit(perHit) : perHit };
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
  const hasTarget = imbueEffectOf(cardId)
    ? imbueSlotsFor(state, handIndex).length > 0
    : targetRuleOf(cardId) === 'none'
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
    : addToHand({ ...ready, drawPile: rest }, top);
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
 * Cleanses each of these heroes in turn (1 random affliction each),
 * threading the fight's rng through so the picks replay the same.
 */
const cleanseHeroes = (
  state: CombatState,
  uids: readonly number[]
): CombatState =>
  uids.reduce((current, uid) => {
    const unit = current.heroes.find((hero) => hero.uid === uid);
    if (!unit) return current;
    const [cleansed, rng] = cleanseOne(unit, current.rng);
    return updateHeroes({ ...current, rng }, [uid], () => cleansed);
  }, state);

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

/**
 * True when a card hits `unit` at its proper range (Range at a hero
 * past the front row).
 */
export const isLongRangeShot = (unit: HeroUnit, cardDef: CardDef): boolean =>
  cardDef.type === 'range' && rowDepth(unit.row) > 0;

// --- OUT OF RANGE ---
/**
 * True when a shot of `type` that starts or ends in `row` may miss: a
 * Range or Magic shot touching the Horizon (OUT_OF_RANGE_ROW), unless
 * the shooter has Longrange. It applies both ways: to the villain's
 * cards aimed into the Horizon and to heroes shooting from it.
 */
export const isOutOfRangeShot = (
  type: CardDef['type'] | HeroAttackType,
  row: HeroUnit['row'],
  hasLongRange: boolean
): boolean =>
  !hasLongRange && OUT_OF_RANGE_TYPES.has(type) && row === OUT_OF_RANGE_ROW;

/**
 * Rolls one Out of Range shot on the fight's seeded rng (so the server's
 * replay rolls the same): true when it lands.
 */
const rollShot = (state: CombatState): [boolean, CombatState] => {
  const [roll, rng] = nextFloat(state.rng);
  return [roll < OUT_OF_RANGE_HIT_CHANCE, { ...state, rng }];
};

/**
 * One villain shot at each hero in `uids`, in order. A shot that is Out
 * of Range rolls first; a miss lays nothing (no damage, no element) and
 * counts on the hero (missedShots) so the view can pop "Miss".
 * Imperative: each roll moves the rng on for the next.
 */
const shootHeroes = (
  state: CombatState,
  uids: readonly number[],
  land: (unit: HeroUnit) => HeroUnit,
  cardDef: CardDef,
  hasLongRange: boolean
): CombatState => {
  let current = state;
  for (const uid of uids) {
    const unit = current.heroes.find((hero) => hero.uid === uid);
    if (!unit) continue;
    if (!isOutOfRangeShot(cardDef.type, unit.row, hasLongRange)) {
      current = updateHeroes(current, [uid], land);
      continue;
    }
    const [lands, rolled] = rollShot(current);
    current = updateHeroes(rolled, [uid], lands ? land : missShot);
  }
  return current;
};

/**
 * The damage multiplier a card gets from the hero it is aimed at (1
 * when the target adds nothing). Today only a long-range shot does.
 */
export const targetDamageFactor = (unit: HeroUnit, cardDef: CardDef): number =>
  isLongRangeShot(unit, cardDef) ? LONG_RANGE_DAMAGE_FACTOR : 1;

/**
 * Every multiplier on one play's damage at one hero, combined: the
 * villain's own (Charge's Momentum, Weaken) times the target's (a long
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
  cardDef: CardDef,
  play: PlayContext
): CombatState => {
  const isMelee = !cardDef.reach;
  const perHit = attackDamage(effect.amount, state.player, cardDef.type);
  const isFollowThrough = effect.target === 'one';
  const pierceHit = Math.floor(perHit * PIERCE_DAMAGE_FACTOR);
  return Array.from({ length: effect.hits }).reduce<CombatState>((current) => {
    const struck = shootHeroes(
      current,
      resolveTargets(
        current,
        effect.target,
        targetUid,
        isMelee,
        isFollowThrough
      ),
      (unit) =>
        elementalHit(
          unit,
          cardHitOn(unit, perHit, cardDef),
          cardDef,
          play.isPiercing
        ),
      cardDef,
      play.isLongRange
    );
    return play.isPiercing && effect.target === 'one'
      ? pierceBehind(struck, targetUid, pierceHit, cardDef, play.isLongRange)
      : struck;
  }, state);
};

/**
 * A Piercing hit's second half: the same hit (scaled by
 * PIERCE_DAMAGE_FACTOR) on every living hero in the target's column
 * (see heroesPiercedPast), each rolled for Out of Range on its own.
 * Nobody in line, nothing happens.
 */
const pierceBehind = (
  state: CombatState,
  targetUid: number,
  amount: number,
  cardDef: CardDef,
  hasLongRange: boolean
): CombatState => {
  const target = state.heroes.find((unit) => unit.uid === targetUid);
  if (!target) return state;
  const living = state.heroes.filter((unit) => !isDefeated(unit));
  const inLineUids = heroesPiercedPast(living, target).map((unit) => unit.uid);
  return shootHeroes(
    state,
    inLineUids,
    // Everyone in the column takes a Piercing hit (no Armor, no Protection).
    (unit) =>
      elementalHit(unit, cardHitOn(unit, amount, cardDef), cardDef, true),
    cardDef,
    hasLongRange
  );
};

/**
 * One card hit on a hero, plus whatever the card's element lays on
 * every hit (ELEMENT_ON_HIT: Ice adds Frost).
 */
const elementalHit = (
  unit: HeroUnit,
  amount: number,
  cardDef: CardDef,
  isPiercing: boolean
): HeroUnit => {
  const hit = takeHit(unit, amount, cardDef.type, isPiercing);
  const onHit = cardDef.element ? ELEMENT_ON_HIT[cardDef.element] : null;
  return onHit ? addStatus(hit, onHit.status, onHit.amount) : hit;
};

/**
 * Reap: damage equal to the target's hex times the multiplier, plus the
 * card type's buff (Surge for a Magic reap).
 */
const reapHex = (
  state: CombatState,
  multiplier: number,
  targetUid: number,
  cardDef: CardDef,
  hasLongRange: boolean
): CombatState => {
  const bonus = typeBonus(state.player, cardDef.type);
  return shootHeroes(
    state,
    resolveTargets(state, 'one', targetUid),
    (unit) =>
      takeHit(unit, unit.statuses.hex * multiplier + bonus, cardDef.type),
    cardDef,
    hasLongRange
  );
};

/**
 * How this play differs from the printed card: imbue slot, Piercing,
 * Longrange (printed or imbued).
 */
type PlayContext = { slot: number; isPiercing: boolean; isLongRange: boolean };

/**
 * Resolves one effect of the card `cardDef` (its type picks the buff).
 * `play.slot` is the hand slot an Imbue effect goes on.
 */
const applyCardEffect = (
  state: CombatState,
  effect: CardEffect,
  targetUid: number,
  cardDef: CardDef,
  play: PlayContext
): CombatState => {
  switch (effect.kind) {
    case 'damage':
      return villainAttack(state, effect, targetUid, cardDef, play);
    case 'hex':
    case 'poison':
    case 'burn':
    case 'frost':
    case 'bleed':
    case 'shock':
    case 'vex':
    case 'weaken':
      return updateHeroes(
        state,
        resolveTargets(state, effect.target, targetUid),
        (unit) =>
          addStatus(
            unit,
            effect.kind,
            afflictionAmount(effect.amount, state.player, effect.kind, unit)
          )
      );
    case 'enfeeble':
      return updateHeroes(
        state,
        resolveTargets(state, effect.target, targetUid),
        (unit) => enfeebleTimes(unit, effect.times ?? 1)
      );
    case 'reap':
      return reapHex(
        state,
        effect.multiplier,
        targetUid,
        cardDef,
        play.isLongRange
      );
    case 'guard': {
      const amount = guardAmount(effect.amount, state.player);
      return { ...state, player: addGuard(state.player, amount) };
    }
    case 'protect':
      return { ...state, player: castProtection(state.player) };
    case 'brace':
    case 'rush':
    case 'armor':
      return {
        ...state,
        player: addStatus(state.player, effect.kind, effect.amount),
      };
    case 'buff':
      return grantBuff(state, effect);
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
    case 'cleanse': {
      const [player, rng] = cleanseOne(state.player, state.rng);
      return { ...state, player, rng };
    }
    case 'pull':
      return {
        ...state,
        heroes: pullHero(state.heroes, targetUid, effect.rows),
      };
    case 'push':
      return {
        ...state,
        heroes: pushHero(state.heroes, targetUid, effect.rows),
      };
    case 'imbue':
      return imbueSlot(state, play.slot, { gift: effect.gift });
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

/**
 * Spends the card's energy and takes it (and its imbues) out of the
 * hand. Playing it is an action, so "this action" imbues left on other
 * cards lapse.
 */
const payForCard = (state: CombatState, handIndex: number): CombatState => {
  const cardId = state.hand[handIndex];
  const cost = cardId === undefined ? 0 : getCard(cardId).cost;
  return removeFromHand({ ...state, energy: state.energy - cost }, handIndex);
};

// --- TIMED BUFFS ---
/** Grants a buff; a timed one is logged so it can be taken back. */
const grantBuff = (
  state: CombatState,
  effect: Extract<CardEffect, { kind: 'buff' }>
): CombatState => {
  const player = addStatus(state.player, effect.buff, effect.amount);
  const { duration } = effect;
  if (duration === undefined || duration === 'battle')
    return { ...state, player };
  const timed: TimedBuff = {
    buff: effect.buff,
    amount: effect.amount,
    duration,
  };
  return { ...state, player, timedBuffs: [...state.timedBuffs, timed] };
};

/** Takes lapsing timed buffs back off the villain (never below 0). */
const takeBackBuffs = (
  player: Combatant,
  lapsing: readonly TimedBuff[]
): Combatant =>
  lapsing.reduce(
    (current, { buff, amount }) => ({
      ...current,
      statuses: {
        ...current.statuses,
        [buff]: Math.max(0, current.statuses[buff] - amount),
      },
    }),
    player
  );

/**
 * After a play: "this action" buffs that were up before it (so this
 * card got them) lapse. Ones this card granted are kept for the next.
 */
const lapseActionBuffs = (
  played: CombatState,
  countBefore: number
): CombatState => {
  const isLapsing = (buff: TimedBuff, index: number) =>
    index < countBefore && buff.duration === 'action';
  return {
    ...played,
    player: takeBackBuffs(played.player, played.timedBuffs.filter(isLapsing)),
    timedBuffs: played.timedBuffs.filter((buff, i) => !isLapsing(buff, i)),
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
 * Everything one play needs besides the card: its picks, the effects
 * imbued on it, and (for an Imbue card) the slot it imbues, counted in
 * the hand after the card itself has left it.
 */
type PlayPlan = PlayContext & {
  picks: readonly number[];
  imbued: readonly ImbuableEffect[];
};

/**
 * Resolves a paid-for card and returns the state after every beat (each
 * hit of each pick). Splitting hits changes nothing: a card's hits all
 * use the damage worked out before the first one. Imbued effects land
 * after every hit that lands (a Poison imbue on a 3-hit card poisons 3
 * times; an Out of Range miss procs nothing). A card that deals no
 * damage carries its imbues once, with the first pick.
 */
const cardBeats = (
  paid: CombatState,
  cardId: CardId,
  plan: PlayPlan
): CombatState[] => {
  const cardDef = getCard(cardId);
  // Imbued damage joins the card's own Damage; the rest proc per hit.
  const { own, extra } = foldImbuedDamage(cardDef.effects, plan.imbued);
  const beats = own.flatMap(oneHitAtATime);
  const imbuedBeats = extra.flatMap(oneHitAtATime);
  const isProcPerHit = cardDef.effects.some(
    (effect) => effect.kind === 'damage'
  );
  const states: CombatState[] = [];
  let current = paid;
  // Imperative on purpose: each pick aims at the field the last one left
  // (a hero felled by pick 1 can't be hit by pick 2; the aim moves on),
  // and each imbue proc waits to see whether the hit before it landed.
  plan.picks.forEach((requested, pick) => {
    const aimed = aimCard(current, cardId, requested);
    const apply = (effect: CardEffect) => {
      current = applyCardEffect(current, effect, aimed, cardDef, plan);
      states.push(current);
    };
    for (const effect of beats) {
      const before = current;
      apply(effect);
      const isLandedHit =
        effect.kind === 'damage' && hasLandedHit(before, current);
      if (isLandedHit) imbuedBeats.forEach(apply);
    }
    if (!isProcPerHit && pick === 0) imbuedBeats.forEach(apply);
  });
  return states;
};

/** True when the card in that hand slot has `keyword` (printed or imbued). */
const isPlayWith = (
  state: CombatState,
  handIndex: number,
  keyword: CardKeyword
): boolean => {
  const cardId = state.hand[handIndex];
  return (
    cardId !== undefined &&
    cardHasKeyword(cardId, imbuesAt(state, handIndex), keyword)
  );
};

/**
 * True when the card in that slot shoots past Out of Range: it has
 * Longrange (printed or imbued) or the villain is a Sharpshooter.
 */
const ignoresOutOfRange = (state: CombatState, handIndex: number): boolean =>
  isPlayWith(state, handIndex, 'longRange') ||
  state.player.statuses.sharpshooter > 0;

/**
 * The chance (0..1) that each shot of the card in `handIndex` lands on
 * `unit`: OUT_OF_RANGE_HIT_CHANCE for a Range or Magic shot touching the
 * Horizon (see isOutOfRangeShot), else 1. Shown on the aim arrow.
 */
export const aimHitChance = (
  state: CombatState,
  handIndex: number,
  unit: HeroUnit
): number => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined) return 1;
  const mayMiss = isOutOfRangeShot(
    getCard(cardId).type,
    unit.row,
    ignoresOutOfRange(state, handIndex)
  );
  return mayMiss ? OUT_OF_RANGE_HIT_CHANCE : 1;
};

/**
 * The plan for playing the card in `handIndex`, or null when the play
 * is illegal (unplayable, or an Imbue card without a slot it may imbue).
 */
const planPlay = (
  state: CombatState,
  handIndex: number,
  targetUid: number,
  targetUids: readonly number[] | undefined,
  imbueIndex: number | undefined
): PlayPlan | null => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined || !canPlayCard(state, handIndex)) return null;
  const isImbue = imbueEffectOf(cardId) !== undefined;
  if (isImbue && !imbueSlotsFor(state, handIndex).includes(imbueIndex ?? -1))
    return null;
  // The played card leaves the hand first, so later slots shift down.
  const asked = imbueIndex ?? -1;
  return {
    picks: requestedPicks(getCard(cardId), targetUid, targetUids),
    imbued: imbuedEffects(imbuesAt(state, handIndex)),
    slot: asked > handIndex ? asked - 1 : asked,
    isPiercing: isPlayWith(state, handIndex, 'piercing'),
    isLongRange: ignoresOutOfRange(state, handIndex),
  };
};

/**
 * Where a played card goes. An Exhaust card spends a use; on its last
 * one it Exhausts (out of the fight, and the run drops it after).
 * Remove and Imbue cards (used up once played) leave the fight too.
 * Every other card goes to the discard pile.
 */
const pileThePlayed = (
  state: CombatState,
  cardId: CardId,
  imbues: readonly Imbue[]
): CombatState => {
  const { usesSpent, isExhausted } = spendUse(state.usesSpent, cardId);
  const isRemoved =
    isExhausted ||
    cardHasKeyword(cardId, imbues, 'remove') ||
    imbueEffectOf(cardId) !== undefined;
  const spent = {
    ...state,
    usesSpent,
    exhausted: isExhausted ? [...state.exhausted, cardId] : state.exhausted,
  };
  return isRemoved
    ? { ...spent, removedPile: [...spent.removedPile, cardId] }
    : { ...spent, discardPile: [...spent.discardPile, cardId] };
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
  targetUids?: readonly number[],
  imbueIndex?: number
): CombatState => {
  const cardId = state.hand[handIndex];
  const plan = planPlay(state, handIndex, targetUid, targetUids, imbueIndex);
  if (cardId === undefined || !plan) return state;
  const cardDef = getCard(cardId);
  const paid = payForCard(state, handIndex);
  const resolved = spendMomentum(
    cardBeats(paid, cardId, plan).at(-1) ?? paid,
    cardDef
  );
  // A played card's imbues landed with it and go to the pile with it
  // (they last the battle).
  const imbues = imbuesAt(state, handIndex);
  const kept = stowPlayedImbues(
    lapseActionBuffs(resolved, state.timedBuffs.length),
    cardId,
    imbues
  );
  const cleared = removeFallen(pileThePlayed(kept, cardId, imbues));
  const outcome: PlayOutcome = {
    hasKilled: cleared.slain > state.slain,
    hasHit: hasLandedHit(state, cleared),
  };
  return moveOnTrigger(cleared, cardId, imbues, outcome);
};

// --- FREE MOVES (RAMPAGE ON KILL, DISTANCE ON HIT) ---
/** What a play did to the heroes: slew one, or landed a hit at all. */
type PlayOutcome = { hasKilled: boolean; hasHit: boolean };

/**
 * The keywords that make the villain move for free, what sets each off
 * and the move: Rampage Charges on a kill, Distance Back Steps on a hit.
 */
const FREE_MOVES: readonly {
  keyword: CardKeyword;
  trigger: keyof PlayOutcome;
  move: MovementId;
}[] = [
  { keyword: 'rampage', trigger: 'hasKilled', move: 'charge' },
  { keyword: 'distance', trigger: 'hasHit', move: 'backStep' },
];

/**
 * True when a play landed a hit on some hero: one fell, lost HP or lost
 * Guard to it. A shot that missed (Out of Range) is no hit.
 */
const hasLandedHit = (before: CombatState, after: CombatState): boolean =>
  after.slain > before.slain ||
  before.heroes.some((unit) => {
    const now = after.heroes.find((hero) => hero.uid === unit.uid);
    return (
      now !== undefined &&
      (now.damageTaken > unit.damageTaken || now.guard < unit.guard)
    );
  });

/**
 * After a card resolves, each free-move keyword it has (printed or
 * imbued) whose trigger it met makes its move for free, when there's
 * room (see moveFree).
 */
const moveOnTrigger = (
  state: CombatState,
  cardId: CardId,
  imbues: readonly Imbue[],
  outcome: PlayOutcome
): CombatState =>
  FREE_MOVES.filter(
    ({ keyword, trigger }) =>
      outcome[trigger] && cardHasKeyword(cardId, imbues, keyword)
  ).reduce((moved, free) => moveFree(moved, free.move), state);

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
  const plan = {
    picks,
    imbued: imbuedEffects(imbuesAt(state, handIndex)),
    slot: -1,
    isPiercing: isPlayWith(state, handIndex, 'piercing'),
    isLongRange: ignoresOutOfRange(state, handIndex),
  };
  const beats = cardBeats(payForCard(state, handIndex), cardId, plan);
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
  targetUids?: readonly number[],
  imbueIndex?: number
): CombatState[] => {
  const cardId = state.hand[handIndex];
  const plan = planPlay(state, handIndex, targetUid, targetUids, imbueIndex);
  if (cardId === undefined || !plan) return [];
  const beats = cardBeats(payForCard(state, handIndex), cardId, plan);
  return [
    ...beats,
    playCard(state, handIndex, targetUid, targetUids, imbueIndex),
  ];
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
    const isFull = cellCountOf(ghost) > freeHeroCells(heroes);
    if (isFull || !cellsOf(ghost).every((cell) => isCellOpen(heroes, cell))) {
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
    case 'attack':
      return heroShoots(state, actor, effect);
    case 'hex':
    case 'poison':
    case 'burn':
    case 'frost':
    case 'bleed':
    case 'shock':
      return afflictVillain(state, effect.kind, scaled(effect.amount));
    case 'weaken':
      return afflictVillain(state, 'weaken', effect.amount);
    case 'guard':
      return updateHeroes(
        state,
        heroTargets(state, actor.uid, effect.who),
        (unit) => addGuard(unit, scaled(effect.amount))
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
    case 'cleanse':
      return cleanseHeroes(state, heroTargets(state, actor.uid, effect.who));
    case 'summon':
      return summonHeroes(state, actor, effect);
    case 'revive':
      return reviveFallen(state);
    case 'soar':
      return updateHeroes(state, [actor.uid], (unit) => withAloft(unit, 1));
    case 'knockBack':
      return { ...state, heroes: fallBack(state.heroes, effect.lines) };
  }
};

// --- INSTINCT (DODGE) ---
/** The chance (0..1) to dodge at `stacks` of Instinct. */
export const dodgeChanceOf = (stacks: number): number =>
  INSTINCT_DODGE_CHANCES[Math.min(stacks, ULTRA_INSTINCT_STACKS)] ?? 0;

/**
 * Rolls the villain's Instinct on the fight's seeded rng: true when it
 * dodges. No Instinct, no roll (the rng stays put).
 */
const rollDodge = (state: CombatState): [boolean, CombatState] => {
  const chance = dodgeChanceOf(state.player.statuses.instinct);
  if (chance <= 0) return [false, state];
  const [roll, rng] = nextFloat(state.rng);
  return [roll < chance, { ...state, rng }];
};

/**
 * Lays a hero's affliction on the villain unless Instinct dodges it
 * (counted for the "Dodge" pop). Hex can't be dodged.
 */
const afflictVillain = (
  state: CombatState,
  status: StatusId,
  amount: number
): CombatState => {
  const [dodged, rolled] = status === 'hex' ? [false, state] : rollDodge(state);
  return {
    ...rolled,
    player: dodged
      ? dodge(rolled.player)
      : addStatus(rolled.player, status, amount),
  };
};

/** True for a hero whose shots ignore Out of Range (Longrange). */
export const hasLongRangePassive = (unit: Pick<HeroUnit, 'heroId'>): boolean =>
  passivesOf(unit).includes('longRange');

/**
 * A hero's attack on the villain, hit by hit. Fired from the Horizon, a
 * Range or Magic hit rolls for Out of Range first (Longrange heroes
 * never miss); a miss counts on the villain (missedShots) so the view
 * can pop "Miss". Imperative: each roll moves the rng on.
 */
const heroShoots = (
  state: CombatState,
  actor: HeroUnit,
  effect: Extract<HeroEffect, { kind: 'attack' }>
): CombatState => {
  const { type, perHit } = heroAttackOf(actor, effect);
  const mayMiss = isOutOfRangeShot(type, actor.row, hasLongRangePassive(actor));
  let current = state;
  for (let hit = 0; hit < effect.hits; hit += 1) {
    const [lands, rolled] = mayMiss ? rollShot(current) : [true, current];
    // A hit that would land may still be dodged (Instinct).
    const [dodged, ready] = lands ? rollDodge(rolled) : [false, rolled];
    current = {
      ...ready,
      player: !lands
        ? missShot(ready.player)
        : dodged
          ? dodge(ready.player)
          : takeHit(ready.player, perHit, type),
    };
  }
  return current;
};

/** The hero with its Aloft set: 1 flies it up, 0 brings it down. */
const withAloft = (unit: HeroUnit, aloft: number): HeroUnit => ({
  ...unit,
  statuses: { ...unit.statuses, aloft },
});

/**
 * One hero takes one action: performs its planned move (if it has one
 * it can make from where it stands) and moves on in its cycle past it;
 * after its last action of the turn (`isLast`) its own upkeep runs too.
 * A move made from Aloft is the dive: the hero lands once it is done.
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

  const isDiving = planned !== null && isAloft(actor);
  const settled = updateHeroes(acted, [uid], (unit) => {
    // BURN AND FROST RUN AFTER EVERY ACTION, UPKEEP AFTER THE LAST ONE
    const landed = afterAction(isDiving ? withAloft(unit, 0) : unit);
    return {
      ...(isLast ? endOfTurnUpkeep(landed) : landed),
      moveIndex: planned ? planned.index + 1 : unit.moveIndex,
    };
  });
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

/**
 * Begins a villain turn: guard and last turn's Protection fade, Hex
 * burns, energy refills, new hand.
 */
const startPlayerTurn = (state: CombatState): CombatState =>
  drawCards(
    {
      ...state,
      player: hexBurn(dropProtection(expireGuard(state.player))),
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
 * A hero's Hex burning right before it acts, as a beat of its own, or
 * null when it carries no Hex.
 */
const hexBurnStep = (state: CombatState, uid: number): TurnStep | null => {
  const unit = state.heroes.find((hero) => hero.uid === uid);
  if (!unit || unit.statuses.hex <= 0) return null;
  const next = removeFallen(updateHeroes(state, [uid], hexBurn));
  return { actorUid: null, attackType: null, move: null, state: next };
};

/**
 * Ends the villain's turn, beat by beat, so the view can play the
 * heroes' attacks one at a time. The last step is the final state.
 * Empty when the fight is already over.
 */
export const endTurnSteps = (state: CombatState): TurnStep[] => {
  if (combatOutcome(state) !== 'ongoing') return [];

  // 1. DISCARD THE HAND (HOLD CARDS STAY), THE VILLAIN'S UPKEEP (POISON
  //    TICKS), AND THE HEROES' GUARD FROM LAST ROUND FADES
  // Timed buffs ("this turn", "this action") lapse first.
  const lapsed: CombatState = {
    ...state,
    player: takeBackBuffs(state.player, state.timedBuffs),
    timedBuffs: [],
  };
  const discarded: CombatState = {
    ...discardHand(lapsed),
    // The villain's turn was its action: Burn and Frost, then upkeep.
    player: endOfTurnUpkeep(afterAction(lapsed.player)),
    // Enfeeble laid on this turn holds; any older lapses.
    heroes: state.heroes.map((unit) => enfeebleCheck(expireGuard(unit))),
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
    // ITS HEX BURNS FIRST, AS ITS OWN BEAT (it may fall to it)
    const burned = hexBurnStep(current, uid);
    if (burned) {
      steps.push(burned);
      current = burned.state;
      if (combatOutcome(current) !== 'ongoing') return steps;
    }
    const actions = actionsOf({ heroId });
    for (let action = 1; action <= actions; action += 1) {
      const actor = current.heroes.find((unit) => unit.uid === uid);
      if (!actor) break;
      const planned = plannedHeroMove(actor, current.heroes);
      const hasMove = planned !== null;
      // Out of moves early, or flying up: this is its last action
      // (upkeep runs now).
      const isLast = action === actions || !hasMove || isSoaring(planned.move);
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

  // 3. HEROES BEHIND THEIR HOME ROW STEP ONE ROW TOWARD IT (MELEE CLOSE
  //    IN, ARCHERS COME IN OFF THE HORIZON), THEN THE NEXT VILLAIN TURN
  // A knock back this turn keeps its distance: nobody walks in after it.
  const wasKnockedBack = steps.some((step) =>
    step.move?.effects.some((effect) => effect.kind === 'knockBack')
  );
  const advanced = wasKnockedBack
    ? current
    : { ...current, heroes: advanceHeroes(current.heroes) };
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
