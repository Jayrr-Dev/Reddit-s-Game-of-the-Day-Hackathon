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

import { battlemageBonusOf, buffStackBonusOf, isSpellpierceOn, volleyHitsOf, fleshWoundBonusOf, magicAccuracyBonusOf, rangeAccuracyBonusOf, sniperBonusOf, guardBreakBonusOf, hasMomentumCleave, meleeReachOf, lineTwoRangeBonusOf, rageEnergyOf, reflexDodgeOf, type SkillPick } from './skills.ts';
import { appendCombatHistory, recordEffects } from './combatHistory.ts';
import {
  advanceHeroes,
  fallBack,
  stepForward,
  canPull,
  canPush,
  affectsSelf,
  areaTargets,
  canReach,
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
  isSelfEffect,
  rowDepth,
  summonSeats,
} from './battlefield.ts';
import { starterEquipment } from './character.ts';
import { cardCost, hitsPerPlay, getCard, type CardId } from './cards.ts';
import {
  addGuard,
  addStatus,
  afflictionAmount,
  combatantBonuses,
  scornBonus,
  offensiveBonus,
  castProtection,
  tierCut,
  castCardProtection,
  bleedOnAttack,
  dropRoundBuffs,
  burstShock,
  enfeebleTimes,
  tickStackingBuffs,
  tierIVExpires,
  cleanseOne,
  dispelBuffs,
  disruptStatus,
  lowerAfflictions,
  attackDamage,
  damageFactorOf,
  expireGuard,
  createCombatant,
  afterAction,
  endOfTurnUpkeep,
  hexBurn,
  poisonTick,
  guardAmount,
  hasMomentumFor,
  heal,
  isDefeated,
  dodge,
  missShot,
  takeHit,
  reapDamage,
} from './combatant.ts';
import { isLongRangeOn } from './features.ts';
import { foldPerHitAfflictions, getHero, type HeroId } from './heroes.ts';
// A cycle (movement.ts reads combatOutcome) is safe: both sides only
// call each other inside functions, never while loading.
import { grantMomentum, hasRoomFor, moveFree, moveFromCard } from './movement.ts';
import {
  addToHand,
  cardHasKeyword,
  discardHand,
  foldImbuedDamage,
  guardApplications,
  imbueEffectOf,
  imbuedEffects,
  imbueSlot,
  imbueSlotsFor,
  imbuesAt,
  cardImbuesAt,
  removeFromHand,
  stowPlayedImbues,
} from './imbue.ts';
import { nextFloat, pickOne, shuffle, type RngState } from './rng.ts';
import {
  ELEMENT_ON_HIT,
  ON_OFF_BUFFS,
  LONG_RANGE_DAMAGE_FACTOR,
  MAX_HAND_SIZE,
  MALAISE_TURNS,
  TIERED_MAX_TIER,
  OUT_OF_RANGE_HIT_CHANCE,
  ALOFT_EVADING_TYPES,
  ALOFT_EVASION,
  SHARPSHOOTER_ACCURACY_BONUS,
  OUT_OF_RANGE_ROW,
  OUT_OF_RANGE_TYPES,
  PHYSICAL_TYPES,
  PIERCE_DAMAGE_FACTOR,
  STATUS_IS_AFFLICTION,
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
  HeroHitProc,
  HeroMove,
  HeroUnit,
  Imbue,
  ImbuableEffect,
  CardKeyword,
  CardType,
  MovementId,
  PassiveId,
  StatusId,
  TimedBuff,
  UsesSpent,
} from './types.ts';
import { spendUse } from './uses.ts';

// --- SETUP ---
export type CombatSetup = {
  traits?: import('./character.ts').Traits;
  traitNodes?: import('./character.ts').TraitNodes;
  skillPicks?: readonly import('./skills.ts').SkillPick[];
  equipment?: import('./character.ts').Equipment;
  hp: number;
  maxHp: number;
  deck: readonly CardId[];
  heroIds: readonly HeroId[];
  formation?: 'march' | 'furthest';
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
    player: { ...createCombatant(setup.hp, setup.maxHp), equipment: setup.equipment ?? starterEquipment(), ...(setup.traits && { traits: setup.traits }), ...(setup.traitNodes && { traitNodes: setup.traitNodes }), ...(setup.skillPicks && { skillPicks: setup.skillPicks }) },
    heroes: formUp(
      setup.heroIds.map((id, index) =>
        createHeroUnit(id, index + 1, setup.might)
      ),
      setup.formation
    ),
    energy: 0,
    reserve: 0,
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
 * front row (unless the hero is Aloft: its dive reaches you from any
 * line, so a Back Step can't cancel it), and a summon needs room in the
 * hero's row.
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
      isAloft(unit) ||
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
        const original = moves[index % moves.length];
        if (!original || !(unit.statuses.malaise > 0 || unit.statuses.hitLimit > 0)) return { move: original, index };
        const effects = original.effects
          .filter(effect => !(unit.statuses.malaise > 0 && (effect.kind === 'wrath' || effect.kind === 'protect')))
          .map(effect => unit.statuses.hitLimit > 0 && effect.kind === 'attack' && effect.hits > 1
            ? { ...effect, hits: 1 } : effect);
        return { move: effects.length ? { ...original, effects } : undefined, index };
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
const longRangeHit = (perHit: number, factor = LONG_RANGE_DAMAGE_FACTOR): number =>
  Math.round(perHit * factor);

/**
 * The villain's long-range factor at `unit`: the base bonus, plus
 * SKIRMISHER (skill tree) when the hero stands on Line 2 ('back').
 */
const villainLongRangeFactor = (unit: HeroUnit, picks?: readonly SkillPick[]): number =>
  LONG_RANGE_DAMAGE_FACTOR + (unit.row === 'back' ? lineTwoRangeBonusOf(picks) : 0);

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
const targetsInPosition = (state: CombatState, cardId: CardId): HeroUnit[] =>
  legalTargets(state.heroes, targetRuleOf(cardId), getCard(cardId).type,
    getCard(cardId).effects.find(effect => effect.kind === 'push')?.rows ?? 1,
    meleeReachOf(state.player.skillPicks));

/** Model the same free advance for aim previews and card resolution. */
export const positionForCard = (
  state: CombatState, cardId: CardId, handIndex?: number
): CombatState =>
  cardHasKeyword(cardId, handIndex === undefined ? [] : cardImbuesAt(state, handIndex), 'charge')
    ? moveFree(state, 'charge') : state;

export const targetsFor = (state: CombatState, cardId: CardId, handIndex?: number): HeroUnit[] =>
  targetsInPosition(positionForCard(state, cardId, handIndex), cardId);

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
  cardAreaTargets(state.heroes, cardId, meleeReachOf(state.player.skillPicks)).length === 0;

/**
 * True when the card in that hand slot can be played right now: it is
 * affordable and has someone to act on. A targeted card needs a legal
 * target (a pull with every back-row hero blocked cannot be played,
 * nor a Melee strike with the front row empty); an area card needs
 * someone in its reach.
 */
export const buffLockedByMalaise = (state: CombatState, cardId: CardId): boolean =>
  state.player.statuses.malaise > 0 && getCard(cardId).type === 'buff';

/** Explicit player portrait target. Enemy UIDs are nonnegative. */
export const SELF_TARGET_UID = -2;

const canSpendCard = (state: CombatState, handIndex: number): boolean => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined || combatOutcome(state) !== 'ongoing' || buffLockedByMalaise(state, cardId)) return false;
  const card = getCard(cardId);
  if ((state.mostKillsInOneHit ?? 0) < (card.requiredKillsInOneHit ?? 0)) return false;
  const movement = card.effects.find(effect => effect.kind === 'charge' || effect.kind === 'backStep');
  if (movement && (movement.kind === 'charge' || movement.kind === 'backStep') && !hasRoomFor(state, movement.kind)) return false;
  return cardCost(cardId, state.killsThisTurn ?? 0, state.followUpReady) <= state.energy;
};

/** Only curse cards can be deliberately aimed at the player portrait. */
export const canPlayCardOnSelf = (state: CombatState, handIndex: number): boolean => {
  const cardId = state.hand[handIndex];
  return cardId !== undefined && getCard(cardId).type === 'curse' && canSpendCard(state, handIndex);
};

export const canPlayCard = (state: CombatState, handIndex: number): boolean => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined || !canSpendCard(state, handIndex)) return false;
  return imbueEffectOf(cardId) ? imbueSlotsFor(state, handIndex).length > 0
    : targetRuleOf(cardId) === 'none'
      ? !isAreaCardWasted(positionForCard(state, cardId, handIndex), cardId)
      : targetsFor(state, cardId, handIndex).length > 0;
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
        killsThisTurn: (state.killsThisTurn ?? 0) + fallen.length,
        fallen: [...state.fallen, ...fallen],
      };
};

/**
 * Resolves who an effect hits. `one` is the aimed hero (if still alive);
 * `all` is everyone for Reach cards and curses, the front row for melee.
 * Either way only heroes a `type` card can reach (a hero Aloft: see canReach).
 * With `isFollowThrough`, a `one` hit also lands on the aimed hero after
 * it fell to an earlier hit of the same card (see villainAttack).
 */
const resolveTargets = (
  state: CombatState,
  target: CardTarget,
  targetUid: number,
  type: CardType,
  isMelee = false,
  isFollowThrough = false
): number[] => {
  const living = state.heroes.filter((unit) => !isDefeated(unit));
  if (target === 'all')
    return areaTargets(living, isMelee, type, meleeReachOf(state.player.skillPicks))
      .map((unit) => unit.uid);
  const pool = isFollowThrough ? state.heroes : living;
  // A hero Aloft is out of reach of a Melee card (see canReach).
  const aimed = pool.find((unit) => unit.uid === targetUid);
  return aimed && canReach(aimed, type) ? [targetUid] : [];
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
 * The chance (0..1) that one villain hit of a `type` card lands on
 * `unit`: Out of Range (OUT_OF_RANGE_HIT_CHANCE, unless Longrange)
 * times a hero Aloft's evasion against Range and Magic (ALOFT_EVASION;
 * Longrange is about distance, so it does not help against flight),
 * plus the attacker's `accuracyBonus` (Sharpshooter), capped at 1.
 */
const shotAccuracy = (
  type: CardType,
  unit: HeroUnit,
  hasLongRange: boolean,
  accuracyBonus = 0
): number => {
  const rangeChance = isOutOfRangeShot(type, unit.row, hasLongRange)
    ? OUT_OF_RANGE_HIT_CHANCE
    : 1;
  const isEvaded = isAloft(unit) && ALOFT_EVADING_TYPES.has(type);
  const chance = rangeChance * (isEvaded ? 1 - ALOFT_EVASION : 1);
  return chance + accuracyBonus;
};

export const shotHitChance = (type: CardType, unit: HeroUnit, longRange: boolean, bonus = 0) =>
  Math.min(1, shotAccuracy(type, unit, longRange, bonus)) * (1 - dodgeChanceAgainst(unit, bonus));

const canCrit = (type: CardType) => type === 'range' || type === 'magic';
const critChance = (type: CardType, accuracy: number) =>
  canCrit(type) ? Math.min(1, Math.max(0, accuracy - 1)) : 0;
/**
 * Rolls one shot on the fight's seeded rng (so the server's replay
 * rolls the same): true when it lands.
 */
const rollShot = (
  state: CombatState,
  chance: number
): [boolean, CombatState] => {
  const [roll, rng] = nextFloat(state.rng);
  return [roll < chance, { ...state, rng }];
};

/**
 * One villain shot at each hero in `uids`, in order. A shot that may
 * miss (Out of Range or Aloft, see shotHitChance) rolls first; a miss
 * lays nothing (no damage, no element) and counts on the hero
 * (missedShots) so the view can pop "Miss".
 * Imperative: each roll moves the rng on for the next.
 */
const shootHeroes = (
  state: CombatState,
  uids: readonly number[],
  land: (unit: HeroUnit, multiplier: number) => HeroUnit,
  cardDef: CardDef,
  hasLongRange: boolean
): CombatState => {
  let current = state;
  for (const uid of uids) {
    const unit = current.heroes.find((hero) => hero.uid === uid);
    if (!unit) continue;
    const bonusAccuracy = accuracyBonusOf(current.player, cardDef.type);
    const chance = shotAccuracy(cardDef.type, unit, hasLongRange, bonusAccuracy);
    if (chance < 1) {
      const [lands, rolled] = rollShot(current, chance);
      current = rolled;
      if (!lands) {
        current = updateHeroes(current, [uid], missShot);
        continue;
      }
    }
    const dodgeChance = dodgeChanceAgainst(unit, bonusAccuracy);
    if (dodgeChance > 0) {
      const [dodged, rolled] = rollShot(current, dodgeChance);
      current = rolled;
      if (dodged) {
        current = updateHeroes(current, [uid], dodge);
        continue;
      }
    }
    const crit = critChance(cardDef.type, chance);
    let critical = crit >= 1;
    if (crit > 0 && crit < 1) [critical, current] = rollShot(current, crit);
    current = updateHeroes(current, [uid], target => land(target, critical ? 2 : 1));
  }
  return current;
};

/**
 * The damage multiplier a card gets from the hero it is aimed at (1
 * when the target adds nothing). Today only a long-range shot does.
 */
export const targetDamageFactor = (
  unit: HeroUnit,
  cardDef: CardDef,
  picks?: readonly SkillPick[]
): number =>
  (isLongRangeShot(unit, cardDef) ? villainLongRangeFactor(unit, picks) : 1) *
  skillTargetFactor(unit, cardDef, picks);

/**
 * GUARD BREAK / FLESH WOUND (skill tree): a Blunt Melee card hits a hero
 * with Guard or Armor harder; a Sharp one hits a hero with neither harder.
 */
const skillTargetFactor = (unit: HeroUnit, cardDef: CardDef, picks?: readonly SkillPick[]): number => {
  // BATTLEMAGE / SNIPER (skill tree): Magic at Line 1, Range past it.
  if (cardDef.type === 'magic' && unit.row === 'front') return 1 + battlemageBonusOf(picks);
  if (cardDef.type === 'range' && unit.row !== 'front') return 1 + sniperBonusOf(picks);
  if (cardDef.type !== 'melee') return 1;
  const isProtected = unit.guard > 0 || unit.statuses.armor > 0;
  if (cardDef.edge === 'blunt' && isProtected) return 1 + guardBreakBonusOf(picks);
  if (cardDef.edge === 'sharp' && !isProtected) return 1 + fleshWoundBonusOf(picks);
  return 1;
};

/**
 * Every multiplier on one play's damage at one hero, combined: the
 * villain's own (Charge's Momentum, Weaken) times the target's (a long
 * Range shot). Rounded to 2 places for showing; 1 means none.
 */
export const playDamageFactor = (
  attacker: Combatant,
  unit: HeroUnit,
  cardDef: CardDef,
  isRampage = cardDef.keywords.includes('rampage')
): number => {
  const factor =
    (1 + offensiveBonus(attacker, cardDef.type).percent / 100) *
    damageFactorOf(attacker, cardDef.type, isRampage, cardDef.edge) *
    targetDamageFactor(unit, cardDef, attacker.skillPicks);
  return Math.round(factor * 100) / 100;
};

/** One villain hit on a hero: a Range card at a back-row hero hits harder. */
export const cardHitOn = (
  unit: HeroUnit,
  perHit: number,
  cardDef: CardDef,
  picks?: readonly SkillPick[]
): number =>
  Math.round(
    (isLongRangeShot(unit, cardDef) ? longRangeHit(perHit, villainLongRangeFactor(unit, picks)) : perHit) *
      skillTargetFactor(unit, cardDef, picks)
  );

/**
 * SHOCKWAVE preview: every hero a card's one-target Melee strike would
 * Cleave into right now, or null when the card would not Cleave.
 */
export const cleaveTargetsOf = (state: CombatState, cardId: CardId): HeroUnit[] | null => {
  const cardDef = getCard(cardId);
  const isStrike = cardDef.effects.some((e) => e.kind === 'damage' && e.target === 'one');
  const isCleave = !cardDef.reach && isStrike &&
    hasMomentumFor(state.player, cardDef.type) && hasMomentumCleave(state.player.skillPicks);
  if (!isCleave) return null;
  const living = state.heroes.filter((unit) => !isDefeated(unit));
  return areaTargets(living, true, cardDef.type, meleeReachOf(state.player.skillPicks));
};

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
  const perHit = attackDamage(
    effect.amount,
    state.player,
    cardDef.type,
    play.isRampage,
    hitsPerPlay(cardDef),
    cardDef.edge
  );
  // SHOCKWAVE (skill tree): with Momentum, a Melee strike Cleaves.
  const isCleave =
    isMelee &&
    effect.target === 'one' &&
    hasMomentumFor(state.player, cardDef.type) &&
    hasMomentumCleave(state.player.skillPicks);
  const isFollowThrough = effect.target === 'one' && !isCleave;
  const pierceHit = Math.floor(perHit * PIERCE_DAMAGE_FACTOR);
  // SPELLPIERCE (skill tree): Magic ignores Guard and Armor like Piercing.
  const isSpellpierce = isSpellpierceOn(state.player, cardDef.type);
  const ignoresGuard = play.isPiercing || isSpellpierce;
  const hits = volleyHitsOf(effect.hits, cardDef.type, state.player);
  return Array.from({ length: hits }).reduce<CombatState>((current) => {
    // RANDOMLY: this hit's hero is rolled now, so each hit picks anew.
    const [aim, rolled] =
      effect.target === 'random'
        ? randomAim(current, isMelee, cardDef.type)
        : [{ target: isCleave ? 'all' as const : effect.target, uid: targetUid }, current];
    const struck = shootHeroes(
      rolled,
      resolveTargets(
        rolled,
        aim.target,
        aim.uid,
        cardDef.type,
        isMelee,
        isFollowThrough
      ),
      (unit, factor) =>
        elementalHit(
          unit,
          cardHitOn(unit, perHit, cardDef, state.player.skillPicks) * factor,
          cardDef,
          ignoresGuard,
          state.player
        ),
      cardDef,
      play.isLongRange
    );
    const afterHit = play.isPiercing && aim.target === 'one'
      ? pierceBehind(struck, aim.uid, pierceHit, cardDef, play.isLongRange)
      : struck;
    // Count fresh defeats from this hit, including its piercing damage.
    const kills = afterHit.heroes.filter((hero, index) =>
      hero.hp === 0 && (current.heroes[index]?.hp ?? 0) > 0
    ).length;
    return kills > (current.mostKillsInOneHit ?? 0)
      ? { ...afterHit, mostKillsInOneHit: kills }
      : afterHit;
  }, state);
};

/**
 * Rolls a Randomly hit's hero on the fight's seeded rng: any living hero
 * the card can reach (Melee: the front row). Nobody to hit, no aim.
 */
const randomAim = (
  state: CombatState,
  isMelee: boolean,
  type: CardType
): [{ target: CardTarget; uid: number }, CombatState] => {
  const living = state.heroes.filter((unit) => !isDefeated(unit));
  const pool = areaTargets(living, isMelee, type, meleeReachOf(state.player.skillPicks));
  if (pool.length === 0) return [{ target: 'one', uid: -1 }, state];
  const [picked, rng] = pickOne(state.rng, pool);
  return [
    { target: 'one', uid: picked.uid },
    { ...state, rng },
  ];
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
    (unit, factor) =>
      elementalHit(unit, cardHitOn(unit, amount, cardDef, state.player.skillPicks) * factor, cardDef, true, state.player),
    cardDef,
    hasLongRange
  );
};

/**
 * One card hit on a hero, plus whatever the card's element lays on
 * every hit (ELEMENT_ON_HIT: Ice adds Frost).
 */
const elementalHit = <T extends Combatant>(
  unit: T,
  amount: number,
  cardDef: CardDef,
  isPiercing: boolean,
  attacker: Combatant
): T => {
  const hit = takeHit(unit, amount, cardDef.type, isPiercing, attacker);
  // A hit for 0 (all Armor or Protection) carries no element.
  const isLanded = hit.damageTaken > unit.damageTaken || hit.guard < unit.guard;
  const onHit = cardDef.element ? ELEMENT_ON_HIT[cardDef.element] : null;
  return onHit && isLanded ? addStatus(hit, onHit.status, onHit.amount + scornBonus(attacker, onHit.status)) : hit;
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
  return shootHeroes(
    state,
    resolveTargets(state, 'one', targetUid, cardDef.type),
    (unit, factor) =>
      takeHit(unit, reapDamage(unit.statuses.hex, multiplier, state.player, cardDef.type) * factor, cardDef.type, false, state.player),
    cardDef,
    hasLongRange
  );
};

/**
 * How this play differs from the printed card: imbue slot, Piercing,
 * Longrange (printed or imbued).
 */
type PlayContext = {
  slot: number;
  isPiercing: boolean;
  isLongRange: boolean;
  /** Rampage (printed or imbued): Momentum's bonus doubles. */
  isRampage: boolean;
  hasCharge: boolean;
};

const applyDisruptCard = <T extends Combatant>(
  target: T, effect: Extract<CardEffect, { kind: 'disrupt' }>, rng: RngState, innateArmor = 0
): readonly [T, RngState, StatusId | undefined] => {
  const [reduced, next, changed] = disruptStatus(target, effect.amount, rng, innateArmor, effect.allAfflictions === true);
  const cleansed = effect.allAfflictions ? lowerAfflictions(reduced, effect.amount) : reduced;
  return [effect.hitLimitTurns ? addStatus(cleansed, 'hitLimit', effect.hitLimitTurns) : cleansed, next, changed];
};

const applyOnPortrait = (
  state: CombatState, effect: CardEffect, cardDef: CardDef, play: PlayContext
): CombatState => {
  const { player } = state;
  switch (effect.kind) {
    case 'damage':
    case 'reap': {
      const amount = effect.kind === 'reap'
        ? reapDamage(player.statuses.hex, effect.multiplier, player, cardDef.type)
        : attackDamage(effect.amount, player, cardDef.type, play.isRampage, hitsPerPlay(cardDef), cardDef.edge);
      const criticalChance = critChance(cardDef.type, 1 + accuracyBonusOf(player, cardDef.type));
      const [critical, current] = criticalChance > 0 && criticalChance < 1 ? rollShot(state, criticalChance)
        : [criticalChance >= 1, state];
      const damage = amount * (critical ? 2 : 1);
      const hit = effect.kind === 'damage'
        ? elementalHit(player, damage, cardDef, play.isPiercing, player)
        : takeHit(player, damage, cardDef.type, false, player);
      return { ...current, player: hit };
    }
    case 'hex':
    case 'poison':
    case 'burn':
    case 'frost':
    case 'bleed':
    case 'shock':
    case 'vex':
    case 'weaken':
      return { ...state, player: addStatus(player, effect.kind, afflictionAmount(effect.amount, player, effect.kind, player)) };
    case 'malaise':
      return { ...state, player: addStatus(player, 'malaise', effect.amount) };
    case 'enfeeble':
      return { ...state, player: enfeebleTimes(player, (effect.times ?? 1) + scornBonus(player, 'enfeeble')) };
    case 'dispel': {
      const [target, rng, removed] = dispelBuffs(player, effect.amount, state.rng);
      return { ...state, player: target, rng, timedBuffs: state.timedBuffs.filter(buff => !removed.includes(buff.buff)) };
    }
    case 'disrupt': {
      const [target, rng, changed] = applyDisruptCard(player, effect, state.rng);
      return { ...state, player: target, rng, timedBuffs: state.timedBuffs.filter(buff => buff.buff !== changed || target.statuses[buff.buff] > 0) };
    }
    case 'pull':
    case 'push':
      return forcePlayerMovement(state, effect.kind === 'pull', effect.rows);
    case 'amplify':
      return { ...state, player: { ...player, statuses: { ...player.statuses, [effect.status]: player.statuses[effect.status] * effect.factor } } };
    // Native self and utility effects are handled by applyCardEffect.
    default:
      return state;
  }
};

/**
 * Resolves one effect of the card `cardDef` (its type picks the buff).
 * `play.slot` is the hand slot an Imbue effect goes on.
 */
const applyCardEffect = (
  state: CombatState,
  effect: CardEffect,
  targetUid: number,
  cardDef: CardDef,
  play: PlayContext,
  guardRepeats: number
): CombatState => {
  if (targetUid === SELF_TARGET_UID && !isSelfEffect(effect)) return applyOnPortrait(state, effect, cardDef, play);
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
        resolveTargets(state, effect.target, targetUid, cardDef.type),
        (unit) =>
          addStatus(
            unit,
            effect.kind,
            afflictionAmount(effect.amount, state.player, effect.kind, unit)
          )
      );
    case 'malaise':
      return updateHeroes(
        state,
        resolveTargets(state, effect.target, targetUid, cardDef.type),
        (unit) => addStatus(unit, 'malaise', effect.amount)
      );
    case 'enfeeble':
      return updateHeroes(
        state,
        resolveTargets(state, effect.target, targetUid, cardDef.type),
        (unit) => enfeebleTimes(unit, (effect.times ?? 1) + scornBonus(state.player, 'enfeeble'))
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
      const amount = guardAmount(effect.amount, state.player, guardRepeats);
      return { ...state, player: addGuard(state.player, amount) };
    }
    case 'protect':
      return { ...state, player: castCardProtection(state.player) };
    case 'charge':
    case 'backStep':
      return moveFromCard(state, effect.kind);
    case 'momentum':
      return grantMomentum(state);
    case 'brace':
    case 'move':
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
        player: addStatus(state.player, 'wrath', effect.amount + buffStackBonusOf(state.player.skillPicks)),
      };
    case 'draw':
      return drawCards(state, effect.amount);
    case 'energy':
      return { ...state, energy: Math.min(combatantBonuses(state.player).maxEnergy, state.energy + effect.amount) };
    case 'heal':
      return { ...state, player: heal(state.player, effect.amount) };
    case 'cleanse': {
      const [player, rng] = cleanseOne(state.player, state.rng);
      return { ...state, player, rng };
    }
    case 'dispel':
    case 'disrupt': {
      const targets = new Set(resolveTargets(state, effect.target, targetUid, cardDef.type));
      let rng = state.rng;
      const heroes = state.heroes.map(unit => {
        if (!targets.has(unit.uid)) return unit;
        const innateArmor = getHero(unit.heroId).armor ?? 0;
        const [reduced, next] = effect.kind === 'dispel'
          ? dispelBuffs(unit, effect.amount, rng, innateArmor)
          : applyDisruptCard(unit, effect, rng, innateArmor);
        rng = next;
        return reduced;
      });
      return { ...state, heroes, rng };
    }
    case 'pull':
      return {
        ...state,
        heroes: pullHero(state.heroes, targetUid, effect.rows),
      };
    case 'push': {
      if (effect.target === 'all') {
        const living = removeFallen(state);
        const targets = resolveTargets(living, 'all', targetUid, cardDef.type, !cardDef.reach);
        const heroes = fallBack(living.heroes, effect.rows, new Set(targets));
        const moved = heroes.some((hero, index) => hero.row !== living.heroes[index]?.row);
        return { ...living, heroes, followUpReady: moved || !!living.followUpReady };
      }
      const heroes = pushHero(state.heroes, targetUid, effect.rows);
      const moved = heroes !== state.heroes && heroes.some(hero => hero.uid === targetUid && hero.hp > 0);
      return { ...state, heroes, followUpReady: moved || !!state.followUpReady };
    }
    case 'amplify':
      // OVERCHARGE: the status already on the target, multiplied.
      return updateHeroes(
        state,
        resolveTargets(state, effect.target, targetUid, cardDef.type),
        (unit) => ({
          ...unit,
          statuses: {
            ...unit.statuses,
            [effect.status]: unit.statuses[effect.status] * effect.factor,
          },
        })
      );
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
      (effect.kind === 'push' && !canPush(state.heroes, unit, effect.rows))
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
  const legal = targetsInPosition(state, cardId).filter((unit) => !isDefeated(unit));
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
  const cost = cardId === undefined ? 0 : cardCost(cardId, state.killsThisTurn ?? 0, state.followUpReady);
  return removeFromHand({ ...state, energy: state.energy - cost, ...(cardId === 'followUp' && { followUpReady: false }) }, handIndex);
};

// --- TIMED BUFFS ---
/** Grants a buff; a timed one is logged so it can be taken back. */
const grantBuff = (
  state: CombatState,
  effect: Extract<CardEffect, { kind: 'buff' }>
): CombatState => {
  // OVERFLOW (skill tree): stacked buffs gain one more stack (on/off ones can't).
  const extra = ON_OFF_BUFFS.has(effect.buff) ? 0 : buffStackBonusOf(state.player.skillPicks);
  const amount = effect.amount + extra;
  const player = addStatus(state.player, effect.buff, amount);
  const { duration } = effect;
  if (duration === undefined || duration === 'battle')
    return { ...state, player };
  const timed: TimedBuff = {
    buff: effect.buff,
    amount,
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

/** True for a card effect that lays an affliction (Burn 3, Hex 1 ...). */
const isAfflictionEffect = (effect: CardEffect): boolean =>
  effect.kind in STATUS_IS_AFFLICTION &&
  STATUS_IS_AFFLICTION[effect.kind as StatusId];

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
  const guardRepeats = guardApplications(cardDef, plan.imbued);
  const isProcPerHit = cardDef.effects.some(
    (effect) => effect.kind === 'damage'
  );
  // AFFLICTIONS ON HIT: an attack card's own afflictions proc on every
  // hit that lands, just like imbued ones (Barbed Volley 2x3, Bleed 2:
  // Bleed 6). A card with no damage lays them once.
  const isOnHitOwn = (effect: CardEffect) =>
    isProcPerHit && isAfflictionEffect(effect);
  const splitHits = (effect: CardEffect) =>
    paid.player.statuses.hitLimit > 0 && effect.kind === 'damage' ? [{ ...effect, hits: 1 }] : oneHitAtATime(effect);
  const beats = own.filter((effect) => !isOnHitOwn(effect)).flatMap(splitHits);
  const imbuedBeats = [...own.filter(isOnHitOwn), ...extra].flatMap(splitHits);
  const states: CombatState[] = [];
  let current = plan.hasCharge ? moveFree(paid, 'charge') : paid;
  if (current !== paid) states.push(current);
  // Imperative on purpose: each pick aims at the field the last one left
  // (a hero felled by pick 1 can't be hit by pick 2; the aim moves on),
  // and each imbue proc waits to see whether the hit before it landed.
  plan.picks.forEach((requested, pick) => {
    const aimed = requested === SELF_TARGET_UID ? requested : aimCard(current, cardId, requested);
    // A HIT FOR 0 PROCS NOTHING: until one of this pick's hits lands
    // (HP or Guard lost), its effects on heroes (Burn, Knockback ...)
    // are skipped; effects on the villain (Guard, Draw) still apply.
    let hasLanded = false;
    const apply = (effect: CardEffect) => {
      if (aimed === SELF_TARGET_UID && current.player.hp <= 0) return;
      current = applyCardEffect(current, effect, aimed, cardDef, plan, guardRepeats);
      states.push(current);
    };
    for (const effect of beats) {
      const before = current;
      const isOnHit = isProcPerHit && effect.kind !== 'damage';
      if (isOnHit && !hasLanded && !isSelfEffect(effect)) continue;
      apply(effect);
      const isLandedHit =
        effect.kind === 'damage' && (aimed === SELF_TARGET_UID
          ? villainWasHit(before.player, current.player) : hasLandedHit(before, current));
      hasLanded ||= isLandedHit;
      if (isLandedHit) imbuedBeats.forEach(apply);
    }
    if (!isProcPerHit && pick === 0) imbuedBeats.forEach(apply);
  });
  // BLEED: one bite per hero struck (a whole card, not its hits), as a
  // last beat of its own when it changes anything.
  const counted = plan.picks.includes(SELF_TARGET_UID) && isProcPerHit && PHYSICAL_TYPES.has(cardDef.type) &&
      current.player.hp > 0 && villainWasHit(paid.player, current.player)
    ? { ...current, player: bleedOnAttack(current.player, paid.player.statuses.bleed, paid.player) }
    : biteBleedOnAttack(paid, current, cardDef);
  if (counted !== current) states.push(counted);
  return states;
};

/**
 * After a physical attack card resolves, Bleed bites once on every hero
 * it landed on (HP or Guard lost) that bled before it (see bleedOnAttack).
 */
const biteBleedOnAttack = (
  before: CombatState,
  after: CombatState,
  cardDef: CardDef
): CombatState => {
  const isAttack = cardDef.effects.some((effect) => effect.kind === 'damage');
  if (!isAttack || !PHYSICAL_TYPES.has(cardDef.type)) return after;
  const priorBleedOf = (uid: number): number =>
    before.heroes.find((hero) => hero.uid === uid)?.statuses.bleed ?? 0;
  const struck = after.heroes.filter((unit) => {
    const old = before.heroes.find((hero) => hero.uid === unit.uid);
    return (
      old !== undefined && old.statuses.bleed > 0 && villainWasHit(old, unit)
    );
  });
  if (struck.length === 0) return after;
  return removeFallen(
    updateHeroes(
      after,
      struck.map((unit) => unit.uid),
      (unit) => bleedOnAttack(unit, priorBleedOf(unit.uid), before.player)
    )
  );
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
    cardHasKeyword(cardId, cardImbuesAt(state, handIndex), keyword)
  );
};

/**
 * True when the card in that slot shoots past Out of Range: it has
 * Longrange (printed or imbued). (Sharpshooter only adds accuracy.)
 */
const ignoresOutOfRange = (state: CombatState, handIndex: number): boolean =>
  isPlayWith(state, handIndex, 'longRange');

/** The villain's bonus to each shot's chance to land (Sharpshooter). */
const accuracyBonusOf = (villain: Combatant, type: CardType): number =>
  (villain.statuses.sharpshooter > 0 ? SHARPSHOOTER_ACCURACY_BONUS : 0) +
  // ARCANE FOCUS (skill tree): Magic shots land more often.
  (type === 'magic' ? magicAccuracyBonusOf(villain.skillPicks) : 0) +
  // STEADY AIM (skill tree): Range shots land more often.
  (type === 'range' ? rangeAccuracyBonusOf(villain.skillPicks) : 0) +
  (canCrit(type) && villain.traits ? combatantBonuses(villain).accuracyPercent / 100 : 0);

/**
 * The chance (0..1) that each shot of the card in `handIndex` lands on
 * `unit` (see shotHitChance: Out of Range and Aloft). Shown on the aim
 * arrow.
 */
export const aimCritChance = (state: CombatState, index: number, unit: HeroUnit): number => {
  const id = state.hand[index];
  if (id === undefined) return 0;
  const card = getCard(id);
  if (!canCrit(card.type) || ![...card.effects, ...imbuedEffects(imbuesAt(state, index))].some(e => e.kind === 'damage' || e.kind === 'reap')) return 0;
  return critChance(card.type, shotAccuracy(card.type, unit, ignoresOutOfRange(state, index), accuracyBonusOf(state.player, card.type)));
};
export const aimHitChance = (
  state: CombatState,
  handIndex: number,
  unit: HeroUnit
): number => {
  const cardId = state.hand[handIndex];
  if (cardId === undefined || getCard(cardId).effects.every(effect => effect.kind === 'dispel' || effect.kind === 'disrupt')) return 1;
  return shotHitChance(
    getCard(cardId).type,
    unit,
    ignoresOutOfRange(state, handIndex),
    accuracyBonusOf(state.player, getCard(cardId).type)
  );
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
  const self = targetUid === SELF_TARGET_UID;
  if (cardId === undefined || (self ? !canPlayCardOnSelf(state, handIndex) : !canPlayCard(state, handIndex))) return null;
  if (targetUids?.some(uid => (uid === SELF_TARGET_UID) !== self)) return null;
  const isImbue = imbueEffectOf(cardId) !== undefined;
  if (isImbue && !imbueSlotsFor(state, handIndex).includes(imbueIndex ?? -1))
    return null;
  // The played card leaves the hand first, so later slots shift down.
  const asked = imbueIndex ?? -1;
  return {
    picks: self ? [SELF_TARGET_UID] : requestedPicks(getCard(cardId), targetUid, targetUids),
    imbued: imbuedEffects(imbuesAt(state, handIndex)),
    slot: asked > handIndex ? asked - 1 : asked,
    isPiercing: isPlayWith(state, handIndex, 'piercing'),
    isLongRange: ignoresOutOfRange(state, handIndex),
    isRampage: isPlayWith(state, handIndex, 'rampage'),
    hasCharge: isPlayWith(state, handIndex, 'charge'),
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
  const imbues = cardImbuesAt(state, handIndex);
  const kept = stowPlayedImbues(
    lapseActionBuffs(resolved, state.timedBuffs.length),
    cardId,
    imbues
  );
  const cleared = removeFallen(pileThePlayed(kept, cardId, imbues));
  const outcome: PlayOutcome = {
    hasKilled: cleared.slain > state.slain,
    hasHit: plan.picks.includes(SELF_TARGET_UID)
      ? cleared.player.hp > 0 && villainWasHit(state.player, cleared.player)
      : hasLandedHit(state, cleared),
  };
  const entry = {
    turn: state.turn,
    cardId,
    cost: state.energy - paid.energy,
    ...(imbues.length ? { imbues } : {}),
    ...(state.usesSpent[cardId] ? { usesSpent: state.usesSpent[cardId] } : {}),
  };
  // BATTLE RUSH (skill): a kill made with Momentum gives energy back.
  const isMomentumKill = outcome.hasKilled && hasMomentumFor(state.player, cardDef.type);
  const raged = isMomentumKill
    ? { ...cleared, energy: cleared.energy + rageEnergyOf(cleared.player.skillPicks) }
    : cleared;
  return recordEffects(state, {
    ...moveOnTrigger(raged, cardId, imbues, outcome),
    playHistory: appendCombatHistory(state.playHistory, entry),
  });
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
  ).reduce((current, free) => {
    const moved = moveFree(current, free.move);
    return free.keyword === 'rampage' && moved === current ? grantMomentum(current) : moved;
  }, state);

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
    isRampage: isPlayWith(state, handIndex, 'rampage'),
    hasCharge: isPlayWith(state, handIndex, 'charge'),
  };
  const beats = cardBeats(payForCard(state, handIndex), cardId, plan);
  const target = beats.at(-1)?.heroes.find((unit) => unit.uid === uid);
  return target !== undefined && target.hp <= 0;
};

/** The sum of this unit's announced attack hits, using the same numbers as its intent chips. */
const announcedAttackDamage = (unit: HeroUnit, field: readonly HeroUnit[]): number =>
  plannedHeroMoves(unit, field).reduce((total, { move }) =>
    total + move.effects.reduce((damage, effect) =>
      effect.kind === 'attack' ? damage + heroAttackOf(unit, effect).perHit * effect.hits : damage, 0), 0);

/**
 * Every hero a card would be played at when the player lets the game
 * choose (tapping a held card again), one per pick. Heroes the card
 * would kill come first, toughest first; then the rest, weakest first.
 * Attack-reducing cards instead prioritize the largest announced attack total,
 * using the same lethal/HP rules for ties. Picks the
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
  const legal = targetsFor(state, cardId, handIndex);
  if (legal.length === 0) return [];
  const card = getCard(cardId);
  const weaknesses = [...card.effects, ...imbuedEffects(imbuesAt(state, handIndex))]
    .some(effect => effect.kind === 'enfeeble' || effect.kind === 'weaken' || effect.kind === 'frost');
  const frostOnHit = card.element && ELEMENT_ON_HIT[card.element]?.status === 'frost';
  const prioritizesThreat = weaknesses || frostOnHit;
  const positioned = prioritizesThreat ? positionForCard(state, cardId, handIndex) : state;
  const ranked = legal.map(unit => ({
    unit,
    lethal: wouldFell(state, handIndex, [unit.uid], unit.uid),
    threat: prioritizesThreat ? announcedAttackDamage(unit, positioned.heroes) : 0,
  })).sort((a, b) =>
    b.threat - a.threat || Number(b.lethal) - Number(a.lethal) ||
    (a.lethal ? b.unit.hp - a.unit.hp : a.unit.hp - b.unit.hp)
  ).map(({ unit }) => unit);
  const fresh = ranked.filter((unit) => !chosen.includes(unit.uid));
  const pool = fresh.length > 0 ? fresh : ranked;
  const missing = Math.max(0, card.targets - chosen.length);
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
      return afflictVillain(state, effect.kind, scaled(effect.amount), accuracyBonusOf(actor, 'magic'));
    case 'weaken':
      return afflictVillain(state, 'weaken', effect.amount, accuracyBonusOf(actor, 'magic'));
    case 'malaise':
      return afflictVillain(state, 'malaise', effect.amount, accuracyBonusOf(actor, 'magic'));
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
    case 'protect':
      return updateHeroes(
        state,
        heroTargets(state, actor.uid, effect.who),
        castProtection
      );
    case 'cleanse':
      return cleanseHeroes(state, heroTargets(state, actor.uid, effect.who));
    case 'dispel': {
      const [player, rng, removed] = dispelBuffs(state.player, effect.amount, state.rng);
      return {
        ...state, player, rng,
        timedBuffs: state.timedBuffs.filter(buff => !removed.includes(buff.buff)),
      };
    }
    case 'disrupt': {
      const [player, rng, changed] = disruptStatus(state.player, effect.amount, state.rng);
      const timedBuffs = changed === undefined ? state.timedBuffs :
        state.timedBuffs.filter(buff => buff.buff !== changed || player.statuses[changed] > 0);
      return { ...state, player, rng, timedBuffs };
    }
    case 'summon':
      return summonHeroes(state, actor, effect);
    case 'revive':
      return reviveFallen(state);
    case 'soar':
      return updateHeroes(state, [actor.uid], (unit) => withAloft(unit, 1));
    case 'knockBack':
    case 'pullPlayer':
      return forcePlayerMovement(state, effect.kind === 'pullPlayer', effect.lines);
    case 'detonate':
      return { ...state, player: burstShock(state.player) };
  }
};

/** Forced movement changes the shared relative formation and grants no movement buffs. */
const forcePlayerMovement = (state: CombatState, pulling: boolean, lines: number): CombatState => {
  const heroes = pulling ? stepForward(state.heroes, lines) : fallBack(state.heroes, lines);
  const distance = Math.max(0, ...heroes.map((unit, i) => Math.abs(rowDepth(unit.row) - rowDepth(state.heroes[i]!.row))));
  return {
    ...state, heroes,
    travelRows: (state.travelRows ?? 0) + (pulling ? distance : -distance),
    forcedMovement: { count: (state.forcedMovement?.count ?? 0) + 1, move: pulling ? 'charge' : 'backStep', distance },
  };
};

// --- DODGE ---
/** The chance (0..1) to dodge at `stacks` of Instinct. */
export const dodgeChanceOf = (stacks: number): number =>
  tierCut(stacks);

/** Bonus Accuracy subtracts percentage points before bounding the probability. */
export const dodgeChanceAgainst = (target: Combatant, bonusAccuracy = 0): number => {
  const dodge = dodgeChanceOf(target.statuses.instinct) + (target.statuses.reflex > 0 ? reflexDodgeOf(target) : 0);
  return Math.min(1, Math.max(0, dodge - Math.max(0, bonusAccuracy)));
};

/** No chance to dodge means no RNG roll. */
const rollDodge = (state: CombatState, bonusAccuracy = 0): [boolean, CombatState] => {
  const chance = dodgeChanceAgainst(state.player, bonusAccuracy);
  if (chance <= 0) return [false, state];
  const [roll, rng] = nextFloat(state.rng);
  return [roll < chance, { ...state, rng }];
};

/**
 * Lays a hero's affliction on the villain unless it is dodged
 * (counted for the "Dodge" pop). Hex can't be dodged.
 */
const afflictVillain = (
  state: CombatState,
  status: StatusId,
  amount: number,
  bonusAccuracy = 0
): CombatState => {
  const [dodged, rolled] = status === 'hex' ? [false, state] : rollDodge(state, bonusAccuracy);
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
  const bonusAccuracy = accuracyBonusOf(actor, type);
  let current = state;
  let hasLandedAny = false;
  for (let hit = 0; hit < effect.hits; hit += 1) {
    const [lands, rolled] = mayMiss
      ? rollShot(current, OUT_OF_RANGE_HIT_CHANCE)
      : [true, current];
    // A hit that would land may still be dodged, unless Homing.
    const mayDodge = lands && !effect.isHoming;
    const [dodged, ready] = mayDodge ? rollDodge(rolled, bonusAccuracy) : [false, rolled];
    const isStruck = lands && !dodged;
    const struck = {
      ...ready,
      player: !lands
        ? missShot(ready.player)
        : dodged
          ? dodge(ready.player)
          : takeHit(ready.player, perHit, type),
    };
    // PER HIT: a landed hit (one that took HP or Guard; a hit for 0
    // procs nothing) lays the attack's afflictions too.
    const hasLanded = isStruck && villainWasHit(ready.player, struck.player);
    hasLandedAny ||= hasLanded;
    current = hasLanded
      ? (effect.perHit ?? []).reduce(
          (laid, proc) =>
            afflictVillain(laid, proc.status, procAmount(proc, actor), bonusAccuracy),
          struck
        )
      : struck;
  }
  // BLEED: the whole attack bites once, if any hit landed.
  return hasLandedAny && PHYSICAL_TYPES.has(type)
    ? {
        ...current,
        player: bleedOnAttack(current.player, state.player.statuses.bleed),
      }
    : current;
};

/** A per-hit affliction's stacks: scaled by might (Weaken counts turns). */
const procAmount = (proc: HeroHitProc, actor: HeroUnit): number =>
  proc.status === 'weaken'
    ? proc.amount
    : scaleByMight(proc.amount, actor.might);

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

  // A move's afflictions ride its attack: one proc per landed hit.
  const effects = foldPerHitAfflictions(planned?.move.effects ?? []);
  const hasAttack = effects.some((effect) => effect.kind === 'attack');
  // A HIT FOR 0 PROCS NOTHING: a move whose attacks all came to 0 (missed,
  // dodged, or stopped by Armor) lays none of its effects on the villain.
  let hasLanded = false;
  const acted = effects.reduce<CombatState>((current, effect) => {
    const freshActor = current.heroes.find((unit) => unit.uid === uid) ?? actor;
    if (isDefeated(current.player)) return current;
    const isSkipped = hasAttack && !hasLanded && isOnVillain(effect);
    if (isSkipped) return current;
    const next = applyHeroEffect(current, freshActor, effect);
    if (effect.kind === 'attack')
      hasLanded ||= villainWasHit(current.player, next.player);
    return next;
  }, state);

  const isDiving = planned !== null && isAloft(actor);
  const settled = updateHeroes(acted, [uid], (unit) => {
    // BURN AND FROST RUN AFTER EVERY ACTION, UPKEEP AFTER THE LAST ONE
    const landed = afterAction(isDiving ? withAloft(unit, 0) : unit, state.player);
    return {
      ...(isLast ? endOfTurnUpkeep(landed) : landed),
      moveIndex: planned ? planned.index + 1 : unit.moveIndex,
    };
  });
  return removeFallen(settled);
};

/** Hero effects that land on the villain (afflictions, Knockback). */
const VILLAIN_EFFECT_KINDS: ReadonlySet<HeroEffect['kind']> = new Set([
  'hex',
  'poison',
  'burn',
  'frost',
  'bleed',
  'shock',
  'weaken',
  'malaise',
  'knockBack',
  'detonate',
]);

/** True for a hero effect that lands on the villain. */
const isOnVillain = (effect: HeroEffect): boolean =>
  VILLAIN_EFFECT_KINDS.has(effect.kind);

/** True when the villain lost HP or Guard between two looks. */
const villainWasHit = (before: Combatant, after: Combatant): boolean =>
  after.damageTaken > before.damageTaken || after.guard < before.guard;

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
 * Begins a villain turn: guard and last round's buffs fade, Hex burns,
 * energy refills (plus whatever the reserve kept), new hand.
 */
export const startPlayerTurn = (state: CombatState): CombatState => {
  const { startingEnergy, maxEnergy, cardsPerTurn } = combatantBonuses(state.player);
  return drawCards(
    {
      ...state,
      // Hex and Poison run before the villain's action (its turn).
      player: poisonTick(hexBurn(dropRoundBuffs(expireGuard(state.player)))),
      energy: Math.min(maxEnergy, startingEnergy + state.reserve),
      reserve: 0,
      turn: state.turn + 1,
      killsThisTurn: 0,
      followUpReady: false,
    },
    cardsPerTurn
  );
};

/** Closes the player turn, including discards, reserve and status upkeep. */
export const finishPlayerTurn = (state: CombatState): CombatState => {
  // Timed buffs ("this turn", "this action") lapse first.
  const lapsed: CombatState = {
    ...state,
    player: takeBackBuffs(state.player, state.timedBuffs),
    timedBuffs: [],
  };
  return {
    ...discardHand(lapsed),
    // RESERVE ENERGY: unspent energy fills the reserve slots; the rest is lost.
    energy: 0,
    reserve: Math.min(lapsed.energy, combatantBonuses(lapsed.player).retainEnergy),
    // The villain's turn was its action: Burn and Frost, then upkeep.
    player: endOfTurnUpkeep(afterAction(lapsed.player)),
  };
};

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
  const ticked = updateHeroes(state, [uid], hero => hexBurn(hero, state.player));
  return {
    actorUid: null, attackType: null, move: null, state: removeFallen(ticked),
  };
};

/**
 * A hero's Poison ticking right before one of its actions, as a beat
 * of its own, or null when it carries no Poison.
 */
const poisonStep = (state: CombatState, uid: number): TurnStep | null => {
  const unit = state.heroes.find((hero) => hero.uid === uid);
  if (!unit || unit.statuses.poison <= 0) return null;
  const next = removeFallen(updateHeroes(state, [uid], hero => poisonTick(hero, state.player)));
  return { actorUid: null, attackType: null, move: null, state: next };
};

const applyMalaise = <T extends Combatant>(unit: T): T =>
  addStatus(unit, 'malaise', MALAISE_TURNS);

const expireStackedBuffs = <T extends Combatant>(unit: T): T => {
  const next = tickStackingBuffs(unit);
  return tierIVExpires(unit) ? applyMalaise(next) : next;
};

/**
 * Ends the villain's turn, beat by beat, so the view can play the
 * heroes' attacks one at a time. The last step is the final state.
 * Empty when the fight is already over.
 */
const resolveTurnSteps = (state: CombatState): TurnStep[] => {
  if (combatOutcome(state) !== 'ongoing') return [];

  // 1. DISCARD THE HAND (HOLD CARDS STAY), THE VILLAIN'S UPKEEP, AND THE HEROES' GUARD FROM LAST ROUND FADES
  const discarded: CombatState = {
    ...finishPlayerTurn(state),
    // Hero-cast Protection still expires when its owner's next turn starts.
    heroes: state.heroes.map((unit) => {
      const guarded = expireGuard(unit);
      if (state.waveArrival) return guarded;
      const active = dropRoundBuffs(guarded);
      return unit.statuses.protection === TIERED_MAX_TIER && !active.statuses.protection
        ? applyMalaise(active) : active;
    }),
  };
  const steps: TurnStep[] = [
    { actorUid: null, attackType: null, move: null, state: discarded },
  ];
  if (combatOutcome(discarded) === 'lost') return steps;
  if (state.waveArrival) {
    steps.push({ actorUid: null, attackType: null, move: null,
      state: startPlayerTurn({ ...discarded, waveArrival: false, heroes: advanceHeroes(discarded.heroes) }),
    });
    return steps;
  }

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
      // ITS POISON TICKS BEFORE EACH ACTION, AS ITS OWN BEAT
      const poisoned = poisonStep(current, uid);
      if (poisoned) {
        steps.push(poisoned);
        current = poisoned.state;
        if (combatOutcome(current) !== 'ongoing') return steps;
      }
      const actor = current.heroes.find((unit) => unit.uid === uid);
      if (!actor) break;
      const planned = plannedHeroMove(actor, current.heroes);
      const hasMove = planned !== null;
      // Out of moves early, or flying up: this is its last action
      // (upkeep runs now).
      const isLast = action === actions || !hasMove || isSoaring(planned.move);
      const attackType = plannedAttackType(actor, current.heroes);
      const acted = heroActs(current, uid, isLast);
      if (acted !== current) {
        const next = planned && attackType ? {
          ...acted,
          playHistory: appendCombatHistory(acted.playHistory, {
            heroId, turn: current.turn, attackName: planned.move.name, attackType,
            hpLost: Math.max(0, current.player.hp - acted.player.hp),
            guardLost: Math.max(0, current.player.guard - acted.player.guard),
          }),
        } : acted;
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
  // Keep the distance set by enemy displacement through the end of the turn.
  const hadForcedMovement = steps.some((step) =>
    step.move?.effects.some((effect) => effect.kind === 'knockBack' || effect.kind === 'pullPlayer')
  );
  const advanced = hadForcedMovement
    ? current
    : { ...current, heroes: advanceHeroes(current.heroes) };

  steps.push({
    actorUid: null,
    attackType: null,
    move: null,
    state: startPlayerTurn({
      ...advanced,
      player: expireStackedBuffs({ ...advanced.player, statuses: { ...advanced.player.statuses, reflex: 0 } }),
      heroes: advanced.heroes.map(expireStackedBuffs),
    }),
  });
  return steps;
};

export function endTurnSteps(state: CombatState): TurnStep[] {
  let previous = state;
  let raw = state.playHistory;
  return resolveTurnSteps(state).map(step => {
    const record = step.state.playHistory !== raw ? step.state.playHistory?.at(-1) : undefined;
    raw = step.state.playHistory;
    const history = record ? appendCombatHistory(previous.playHistory, record) : previous.playHistory;
    previous = recordEffects(previous, { ...step.state, ...(history && { playHistory: history }) });
    return { ...step, state: previous };
  });
}

/** Ends the villain's turn and plays out the heroes' turn. */
export const endTurn = (state: CombatState): CombatState =>
  endTurnSteps(state).at(-1)?.state ?? state;
