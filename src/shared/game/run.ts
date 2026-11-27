import { isStarterName, validStarter, type StarterName } from './starters.ts';
import { planSkillPath, buySkill, isSkillPick, type SkillPick } from './skills.ts';
import { playerHpCap, progressionFromWins, healingAmount, type RingProgress, allocateTrait, awardCharacterVictory, characterBonuses, createCharacter, discardItem, equipItem, isRingIndex, saveTraits, isTrait, isTraitRank, isTraitNode, isTraitPath, traitPathCap, type TraitPath, setTraitNode, setTraitPathRank, setTraitRank, traitHealth, syncCharacterCombat, type CharacterState, type TraitId, type EquipmentSlot } from './character.ts';
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

import { getCard, STARTER_DECK, type CardId } from './cards.ts';
import { getRunArtifact, isHellArtifact, type HellArtifactId, type RunArtifactId } from './hellArtifacts.ts';
import { combatOutcome, createHeroUnit, drawCards, endTurn, openPlayerRound, playCard, startCombat, SELF_TARGET_UID } from './combat.ts';
import { imbueBorrowedCopies, rollBorrowedPowers, type BorrowedPower } from './borrowedPowers.ts';
import { combatantBonuses } from './combatant.ts';
import { formUp } from './battlefield.ts';
import { areaRoomEvent, buildAreaBattles, conquestMightAt, conquestStops, isLastRegion, REST_FRACTION, type AreaBattle, type AreaSite, type ConquestVersion, type RoomEvent } from './conquestAreas.ts';
import { areaTerrain, areaVisitCount, areaVisitedRooms } from './areaMap.ts';
import { BATTLE_WAVES, battleRewardMultiplier, EXPLORE_RESUPPLY_FRACTION } from './battleTiers.ts';
import { buildEndlessWaves } from './endlessWaves.ts';
import { canChooseRegion, isRegionChoice, type RegionChoice } from './regionRoutes.ts';
import { regionIndexOf, mightAt, routeOptions, stopSeed, type Stop } from './kingdom.ts';
import { isMovementId, move } from './movement.ts';
import type { GoldVictory } from './gold.ts';
import { PANDORA_MAX_HP_GAIN, PANDORA_MAX_HP_LOSS, type PandoraRunEffect } from './pandora.ts';
import { ringInventory, type ShopRingId } from './ringShop.ts';
import { appendCarriedCards, IMBUE_CARDS } from './carryCards.ts';
import { nextInt, pickOne } from './rng.ts';
import { rollOffers } from './rewards.ts';
import { isUniqueInDeck } from './unique.ts';
import {
  CHAMPION_VICTORY_HEAL,
  GRAVE_HEAL_FRACTION,
  GRAVE_VOW_MAX_HP,
  PLAYER_MAX_HP,
  SCORE_PER_HERO_SLAIN,
  SCORE_PER_REGION,
  SCORE_PER_WAVE,
  XP_PER_VICTORY,
} from './rules.ts';
import type { CombatState, CopyImbues, MovementId, UsesSpent } from './types.ts';
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
  | { kind: 'reward'; offers: CardId[]; source?: 'horde' | 'elite' | 'champion'; rerolled?: boolean; leveledUp?: boolean; levelsGained?: number; bonusImbue?: CardId; foundCards?: CardId[] }
  | { kind: 'grave' }
  | { kind: 'greed-bargain'; explored?: number; event?: RoomEvent; visited?: readonly number[] }
  | { kind: 'altar'; offers: CardId[] }
  | { kind: 'area-camp'; explored: number; event?: RoomEvent & { result?: string }; visited?: readonly number[] }
  | { kind: 'sealing'; source: 'champion' }
  | { kind: 'conquered' }
  | { kind: 'fallen'; battlefield?: { stop: Stop; combat: CombatState } };

type AreaProgress = {
  site: AreaSite; stop: Stop; battles: AreaBattle[]; battle: number; wave: number; wavePending?: boolean;
  waveRefillPending?: boolean;
  waveBase?: number; respite?: { offers?: CardId[]; powers?: BorrowedPower[] }; pushes?: number; finds?: CardId[];
};

export type RunState = {
  borrowedHp?: number;
  artifacts?: readonly RunArtifactId[];
  conquestVersion?: ConquestVersion;
  area?: AreaProgress | undefined;
  regionPath?: Partial<Record<number, RegionChoice>>;
  attempt: number;
  rewardStarter?: StarterName;
  ringDrops?: number[];
  baseMaxHp?: number;
  pandoraEffect?: PandoraRunEffect;
  deckImbues?: CopyImbues;
  carriedCards?: CardId[];
  promisedToGreed?: CardId;
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
  goldVictories: GoldVictory[];
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
  /** Locks the spent trait nodes in (Save traits); only a respec undoes it. */
  | { type: 'saveTraits' }
  | { type: 'chooseRegion'; option: RegionChoice }
  | { type: 'chooseStop'; option: number; hellArtifact?: HellArtifactId }
  | { type: 'nextBattleWave' }
  | { type: 'battleRespite'; choice: 'rest' | 'explore' | 'fight' | 'borrow' }
  | { type: 'takeBorrowedPower'; index: number }
  | { type: 'closeBorrowedPowers' }
  | { type: 'finishSealing' }
  | { type: 'areaCamp'; choice: 'explore' | 'rest' | 'continue'; room?: number }
  | PlayCardAction
  | { type: 'endTurn' }
  /** A movement on the battlefield, e.g. Charge (see movement.ts). */
  | MoveAction
  | LegacyMoveAction
  | { type: 'pickCard'; offerIndex: number | null }
  | { type: 'rerollReward' }
  | { type: 'graveChoice'; choice: GraveChoice }
  | { type: 'greedChoice'; cardIndex: number | null }
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

/** Owned shop rings are part of the trusted run baseline, not a player action. */
const initialCharacter = (ringProgress: RingProgress | undefined, wins: number, shopRings: readonly ShopRingId[], legacyProgression: boolean, xpStartWins?: number, bonusXp = 0) => {
  const character = createCharacter(ringProgress);
  return { ...character, ...progressionFromWins(wins, legacyProgression, xpStartWins, bonusXp), ...(xpStartWins !== undefined && { scaledExperience: true as const }), ...(legacyProgression && { legacyProgression: true as const }), inventory: [...character.inventory, ...ringInventory(shopRings)] };
};

/** The start of the day's run: full HP, starter deck, first crossroads. */
export const createRun = (dailyKey: string, ringProgress?: RingProgress, attempt = 0, wins = 0,
  shopRings: readonly ShopRingId[] = [], pandoraEffect?: PandoraRunEffect, cardRules?: 1, carried?: CardId | readonly CardId[], legacyProgression = false, conquestVersion?: ConquestVersion, xpStartWins?: number, legacyVigor = false, bonusXp = 0): RunState => {
  const carriedCards = typeof carried === 'string' ? [carried] : carried ? [...carried] : [];
  const maxHp = PLAYER_MAX_HP + (pandoraEffect === 'lasting-vigor' ? PANDORA_MAX_HP_GAIN : pandoraEffect === 'brittle-blood' ? -PANDORA_MAX_HP_LOSS : 0);
  return {
  attempt,
  ...(conquestVersion && { conquestVersion }),
  ...(pandoraEffect && { pandoraEffect, baseMaxHp: maxHp }),
  dailyKey,
  stop: 1,
  character: { ...initialCharacter(ringProgress, wins, shopRings, legacyProgression, xpStartWins, bonusXp), ...(legacyVigor && { legacyVigor: true }) },
  hp: (pandoraEffect === 'half-life' || pandoraEffect === 'half-life-double-gold') ? Math.ceil(maxHp / 2) : maxHp,
  maxHp,
  deck: appendCarriedCards(STARTER_DECK, carriedCards),
  ...(cardRules && { deckImbues: {} }),
  ...(carriedCards.length && { carriedCards }),
  usesSpent: {},
  stats: EMPTY_STATS,
  goldVictories: [],
  phase: { kind: 'route', options: conquestVersion ? conquestStops(dailyKey, 1, undefined, conquestVersion) : routeOptions(dailyKey, 1, cardRules === 1) },
  };
};

// --- TRANSITIONS ---

/** Each region branch has its own deterministic encounters. Legacy routes keep the daily seed. */
function regionRouteKey(state: RunState, stop: number) {
  const index = regionIndexOf(stop);
  const choice = state.regionPath?.[index];
  return choice === undefined ? state.dailyKey : state.dailyKey + ':region:' + index + ':' + choice;
}

/** Only new runs use the expanded campaign. The earlier route is replayed unchanged. */
export function optionsFor(state: RunState, stop: number): Stop[] {
  const key = regionRouteKey(state, stop);
  return state.conquestVersion ? conquestStops(key, stop, state.regionPath?.[regionIndexOf(stop)], state.conquestVersion)
    : routeOptions(key, stop, !!state.deckImbues && !state.promisedToGreed);
}

/** Moves on to the crossroads of the next stop. */
const advanceToNextStop = (state: RunState): RunState => {
  const stop = state.stop + 1;
  return {
    ...state,
    stop,
    storyRingUnlocked: undefined,
    area: undefined,
    phase: { kind: 'route', options: optionsFor(state, stop) },
  };
};

/** Starts a location's next battle; wave changes inside it never reset combat. */
export function beginAreaBattle(state: RunState, area: AreaProgress): RunState {
  const first = area.battles[area.battle]!.waves[0]!;
  const combat = startCombat({
    hp: state.hp, maxHp: state.maxHp, deck: state.deck,
    traits: state.character.traits, equipment: state.character.equipment,
    ...(state.character.traitNodes && { traitNodes: state.character.traitNodes }),
    ...(state.character.skillPicks && { skillPicks: state.character.skillPicks }),
    heroIds: first.heroIds, formation: 'furthest', might: first.might ?? conquestMightAt(state.stop),
    seed: stopSeed(state.dailyKey, 'area-battle:' + area.stop.optionIndex + ':' + area.battle, state.stop),
    usesSpent: state.usesSpent,
    ...(state.deckImbues && { copyImbues: state.deckImbues }),
  });
  return { ...state, area, phase: { kind: 'combat', stop: area.stop, combat: { ...combat, waveArrival: true } } };
}

/** Enters the chosen stop: starts a fight, or opens the grave or altar. */
const enterStop = (state: RunState, stop: Stop): RunState => {
  if (stop.site) {
    const battles = buildAreaBattles(stop.site, state.dailyKey, state.stop, stop.optionIndex ?? 0, state.conquestVersion);
    return beginAreaBattle(state, { site: stop.site, stop, battles, battle: 0, wave: 0 });
  }
  if (stop.kind === 'greed-bargain') return { ...state, phase: { kind: 'greed-bargain' } };
  if (stop.kind === 'grave') return { ...state, phase: { kind: 'grave' } };
  if (stop.kind === 'altar') {
    const offers = rollOffers(
      stopSeed(state.dailyKey, 'altar', state.stop),
      'altar',
      [],
      undefined,
      state.character.skillPicks,
      state.deck, undefined, !!state.deckImbues
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
    ...(state.deckImbues && { copyImbues: state.deckImbues }),
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
  isRegionBoss: boolean,
  waves: number
) => ({
  wavesCleared: stats.wavesCleared + waves,
  heroesSlain: stats.heroesSlain + combat.slain,
  regionsConquered:
    stats.regionsConquered + (won && isRegionBoss ? 1 : 0),
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
  combat: CombatState,
  afterRespite = false
): RunState => {
  const area = state.area;
  const battle = area?.battles[area.battle];
  const outcome = combatOutcome(combat);
  if (!afterRespite && state.phase.kind === 'combat' && combat === state.phase.combat) return state;
  if (outcome === 'ongoing') return { ...state, phase: { kind: 'combat', stop, combat } };
  const won = outcome === 'won';
  if (won && !afterRespite && area && battle && (state.conquestVersion === 3 || battle.finish === 'endless-boss') &&
      (area.wave + 1) % BATTLE_WAVES.skirmish === 0) {
    return { ...state, area: { ...area, respite: {} }, phase: { kind: 'combat', stop, combat } };
  }
  if (won && area && battle && area.wave + 1 < battle.waves.length) {
    return { ...state, area: { ...area, wavePending: true }, phase: { kind: 'combat', stop, combat } };
  }

  const isRegionBoss = battle ? battle.finish === 'region-boss' : stop.kind === 'champion';
  const source = battle ? battle.finish === 'elite' ? 'elite' : 'champion' : rewardSourceOf(stop);
  const stats = tallyFight(state.stats, combat, won, isRegionBoss, (area?.waveBase ?? 0) + (area?.wave ?? 0) + Number(won));
  if (!won) return finishRun({ ...state, hp: 0, stats }, { stop, combat });

  const waves = battle?.waves.length;
  const character = awardCharacterVictory(state.character, XP_PER_VICTORY * battleRewardMultiplier(waves));
  const levelsGained = character.level - state.character.level;
  const isChampion = source === 'champion';
  const bossWins = character.ringProgress.bossWins + (isRegionBoss ? 1 : 0);
  const victoryHeal = isRegionBoss ? CHAMPION_VICTORY_HEAL : 0;
  const rewardKey = area ? 'reward:area:' + area.battle : 'reward';
  const copies = combat.copies;
  const survivors = state.deck.map((_, index) => index).filter(index => !copies?.destroyed.includes(index));
  const deck = copies ? survivors.map(index => state.deck[index]!) : deckWithout(state.deck, combat.exhausted);
  const foundCards = area?.finds?.filter(id => !isUniqueInDeck(deck, id)) ?? [];
  const rewardedDeck = [...deck, ...foundCards];
  const deckImbues = copies ? remapImbues(copies.gifts, survivors) : undefined;
  const bonusImbue = copies && isChampion && nextInt(stopSeed(state.dailyKey, 'champion-imbue-drop', state.stop), 100)[0] < 35
    ? pickOne(stopSeed(state.dailyKey, 'champion-imbue-card', state.stop), IMBUE_CARDS)[0] : undefined;
  const offers = rollOffers(
    stopSeed(state.dailyKey, rewardKey, state.stop),
    source, [], state.rewardStarter, state.character.skillPicks, rewardedDeck, undefined, !!copies, waves, area?.pushes
  );
  const isFinale = area?.site.kind === 'capital' && isRegionBoss && isLastRegion(state.stop);
  return {
    ...state,
    hp: Math.min(state.maxHp, combat.player.hp + healingAmount(victoryHeal, character)),
    character: { ...character, ringProgress: { ...character.ringProgress, bossWins } },
    storyRingUnlocked: isRegionBoss && bossWins <= 5 ? bossWins : undefined,
    deck: bonusImbue ? [...rewardedDeck, bonusImbue] : rewardedDeck,
    ...(deckImbues && { deckImbues }),
    usesSpent: combat.usesSpent,
    stats,
    goldVictories: [...state.goldVictories, { stop: state.stop, encounter: source, ...(area && { battle: area.battle }),
      ...(waves && battleRewardMultiplier(waves) > 1 && { waves }), ...(area?.pushes && { pushes: area.pushes }) }],
    phase: isFinale ? { kind: 'sealing', source: 'champion' }
      : { kind: 'reward', offers, source, leveledUp: levelsGained > 0,
        ...(levelsGained > 1 && { levelsGained }), ...(bonusImbue && { bonusImbue }),
        ...(foundCards.length && { foundCards }) },
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
  return state.area && state.area.battles[state.area.battle]?.finish !== 'endless-boss'
    ? { ...state, deck, phase: { kind: 'area-camp', explored: 0 } }
    : advanceToNextStop({ ...state, deck });
};

/** Spawn fresh units at range without resetting cards, afflictions, or the clock. */
function acceptNextWave(state: RunState): RunState {
  const { area, phase } = state;
  if (phase.kind !== 'combat' || !area?.wavePending) return state;
  return spawnReinforcements(state, area, phase, area.wave + 1);
}

/** Preserve the current turn unless the last wave ended before its next refill. */
function spawnReinforcements(state: RunState, area: AreaProgress, phase: Extract<RunPhase, { kind: 'combat' }>, index: number): RunState {
  const wave = area.battles[area.battle]?.waves[index];
  if (!wave) return state;
  const combat = phase.combat;
  const might = wave.might ?? conquestMightAt(state.stop);
  const heroes = formUp(wave.heroIds.map((id, index) => createHeroUnit(id, combat.nextUid + index, id === 'ballista' ? 1 : might)), 'furthest');
  const { waveRefillPending, ...progress } = area;
  const arriving = { ...combat, heroes, fallen: [], waveArrival: true, nextUid: combat.nextUid + heroes.length };
  const next = { ...state, area: { ...progress, wave: index, wavePending: false },
    phase: { ...phase, combat: arriving } };
  return waveRefillPending ? settleCombat(next, phase.stop, openPlayerRound(arriving)) : next;
}

/** Inspection of the field can find a card without changing combat's active card copies. */
function respiteFind(state: RunState, area: AreaProgress): CardId | undefined {
  const seed = stopSeed(state.dailyKey, 'respite:' + area.battle + ':' + area.wave, state.stop);
  if (nextInt(seed, 3)[0] !== 0) return undefined;
  const deck = [...state.deck, ...(area.finds ?? [])];
  return rollOffers(seed, 'horde', [], state.rewardStarter, state.character.skillPicks, deck, undefined, true)
    .find(id => !isUniqueInDeck(deck, id));
}

/** Endless swaps the mob queue, not the combat. Its spoils enter the current discard pile. */
function continueOnslaught(state: RunState, area: AreaProgress, phase: Extract<RunPhase, { kind: 'combat' }>, card?: CardId): RunState {
  let next = phase;
  const combat = phase.combat;
  if (card) next = { ...phase, combat: { ...combat, discardPile: [...combat.discardPile, card],
    ...(combat.copies && { copies: { ...combat.copies, discard: [...combat.copies.discard, state.deck.length] } }) } };
  const waveBase = (area.waveBase ?? 0) + BATTLE_WAVES.skirmish;
  const { respite: _respite, ...progress } = area;
  const nextArea = { ...progress, waveBase, battles: [buildEndlessWaves(state.dailyKey, waveBase)] };
  return spawnReinforcements(card ? { ...state, deck: [...state.deck, card] } : state, nextArea, next, 0);
}

/** Borrowed powers affect only the Endless combat and survive card movement and trait edits. */
export function applyBorrowedPower(state: RunState, power: BorrowedPower): RunState {
  if (state.phase.kind !== 'combat' || state.area?.battles[state.area.battle]?.finish !== 'endless-boss') return state;
  const { benefit, price } = power;
  const initial = state.phase.combat;
  const combat = benefit.kind === 'imbue' ? imbueBorrowedCopies(initial, state.deck, power) : initial;
  const stats = { ...combat.player.borrowedStats };
  if (benefit.kind === 'stat') stats[benefit.stat] = (stats[benefit.stat] ?? 0) + benefit.amount;
  if (price?.kind === 'stat') stats[price.stat] = (stats[price.stat] ?? 0) - price.amount;
  const hpGain = benefit.kind === 'hp' ? (benefit.percent ? Math.ceil(combat.player.maxHp * benefit.amount / 100) : benefit.amount) : 0;
  const maxHp = combat.player.maxHp + hpGain;
  const blood = price?.kind === 'blood' ? Math.ceil(combat.player.maxHp * price.percent / 100) : 0;
  const hp = Math.max(1, Math.min(maxHp, combat.player.hp + hpGain - blood));
  const player = { ...combat.player, hp, maxHp, borrowedStats: stats };
  const { retainEnergy } = combatantBonuses(player);
  return { ...state, hp, maxHp, borrowedHp: (state.borrowedHp ?? 0) + hpGain,
    ...(combat.copies && { deckImbues: combat.copies.gifts }),
    phase: { ...state.phase, combat: { ...combat, player, reserve: Math.min(combat.reserve, retainEnergy),
      borrowedPowers: [...(combat.borrowedPowers ?? []), power] } } };
}

/** Resolves one choice at a five-wave checkpoint. */
function resolveRespite(state: RunState, area: AreaProgress, phase: Extract<RunPhase, { kind: 'combat' }>, action: RunAction): RunState {
  const endless = area.battles[area.battle]?.finish === 'endless-boss';
  const offers = area.respite?.offers;
  const powers = area.respite?.powers;
  if (endless && powers) {
    if (action.type === 'closeBorrowedPowers') return { ...state, area: { ...area, respite: {} } };
    if (action.type !== 'takeBorrowedPower') return state;
    const power = powers[action.index];
    if (!power) return state;
    const next = applyBorrowedPower(state, power);
    return next.phase.kind === 'combat' ? continueOnslaught(next, area, next.phase) : state;
  }
  if (endless && offers) {
    if (action.type !== 'pickCard') return state;
    const card = action.offerIndex === null ? undefined : offers[action.offerIndex];
    if (action.offerIndex !== null && !card) return state;
    return continueOnslaught(state, area, phase, card && !isUniqueInDeck(state.deck, card) ? card : undefined);
  }
  if (action.type !== 'battleRespite') return state;
  const { choice } = action;
  const combat = phase.combat;
  if (choice === 'borrow') {
    if (!endless) return state;
    const wave = (area.waveBase ?? 0) + area.wave + 1;
    const powers = rollBorrowedPowers(state.dailyKey + ':' + state.deck.join(','), wave, combat, state.deck);
    return { ...state, area: { ...area, respite: { powers } } };
  }
  if (endless && choice === 'fight') {
    const wave = (area.waveBase ?? 0) + area.wave + 1;
    const cards = rollOffers(stopSeed(state.dailyKey, 'endless-spoils', wave), 'champion', [], state.rewardStarter,
      state.character.skillPicks, state.deck, undefined, true, wave, 1);
    return { ...state, area: { ...area, respite: { offers: cards } } };
  }
  const fraction = choice === 'rest' ? REST_FRACTION : choice === 'explore' ? EXPLORE_RESUPPLY_FRACTION : 0;
  const hp = Math.min(state.maxHp, combat.player.hp + healingAmount(Math.ceil(state.maxHp * fraction),
    { ...state.character, ...(combat.player.borrowedStats && { borrowedStats: combat.player.borrowedStats }) }));
  const healed = { ...combat, player: { ...combat.player, hp } };
  if (endless) return continueOnslaught(state, area, { ...phase, combat: choice === 'explore' ? drawCards(healed, 1) : healed });
  const { respite: _respite, ...progress } = area;
  const found = choice === 'explore' ? respiteFind(state, area) : undefined;
  const nextArea = { ...progress, ...(choice === 'fight' && { pushes: (area.pushes ?? 0) + 1 }),
    ...(found && { finds: [...(area.finds ?? []), found] }) };
  return settleCombat({ ...state, area: nextArea }, phase.stop, healed, true);
}

/** Continue deeper into this site, leave for the map, or complete the campaign. */
function leaveCamp(state: RunState, area: AreaProgress): RunState {
  const { pushes: _pushes, finds: _finds, ...progress } = area;
  if (area.battle + 1 < area.battles.length) return beginAreaBattle(state, { ...progress, battle: area.battle + 1, wave: 0 });
  return advanceToNextStop(state);
}

/** A chosen room resolves once. Rest skips unexplored rooms. */
function visitAreaCamp(state: RunState, { choice, room: pickedRoom }: Extract<RunAction, { type: 'areaCamp' }>): RunState {
  const { phase, area } = state;
  if (phase.kind !== 'area-camp' || !area) return state;
  if (choice === 'continue') return leaveCamp(state, area);
  if (choice === 'rest') {
    if (phase.explored > 0 || state.conquestVersion === 3) return state;
    const hp = Math.min(state.maxHp, state.hp + healingAmount(Math.ceil(state.maxHp * REST_FRACTION), state.character));
    return leaveCamp({ ...state, hp }, area);
  }
  const battle = area.battles[area.battle]!;
  const visited = areaVisitedRooms(phase.explored, phase.visited);
  const count = pickedRoom === undefined ? battle.rooms : areaVisitCount(area.site, battle);
  const roomIndex = pickedRoom ?? Array.from({ length: count }, (_, index) => index).find(index => !visited.includes(index));
  if (roomIndex === undefined || !isIndex(roomIndex) || roomIndex >= count || visited.includes(roomIndex)) return state;
  const event = areaRoomEvent(state.dailyKey, state.stop, area.site, area.battle,
    { ...battle, rooms: count }, roomIndex, !!state.deckImbues && !state.promisedToGreed,
    pickedRoom !== undefined && areaTerrain(area.site) === 'village');
  const heal = event.heal ? healingAmount(Math.ceil(state.maxHp * event.heal), state.character) : 0;
  const hp = Math.min(state.maxHp, state.hp + heal);
  const seed = stopSeed(state.dailyKey, 'room-card:' + area.site.name + ':' + area.battle + ':' + roomIndex, state.stop);
  const card = event.reward ? rollOffers(seed, event.reward, [], state.rewardStarter, state.character.skillPicks, state.deck, undefined, !!state.deckImbues)
    .find(id => !isUniqueInDeck(state.deck, id)) : undefined;
  const result = card ? 'Found: ' + getCard(card).name : event.heal ? 'Recovered ' + (hp - state.hp) + ' HP' : undefined;
  const room = { ...event, ...(result && { result }) };
  const visits = { explored: phase.explored + 1, event: room,
    ...((pickedRoom !== undefined || phase.visited) && { visited: [...visited, roomIndex] }) };
  return { ...state, hp, deck: card ? [...state.deck, card] : state.deck,
    phase: event.greed ? { kind: 'greed-bargain', ...visits } : { kind: 'area-camp', ...visits } };
}

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
    baseMaxHp: (state.baseMaxHp ?? state.maxHp - characterBonuses(state.character.traits, state.character.equipment, state.character.traitNodes, state.character.legacyVigor).maxHp + PLAYER_MAX_HP)
      + Math.min(playerHpCap(state.character.legacyVigor) - state.maxHp, GRAVE_VOW_MAX_HP),
    maxHp: Math.min(playerHpCap(state.character.legacyVigor), state.maxHp + GRAVE_VOW_MAX_HP),
    hp: state.hp + Math.min(playerHpCap(state.character.legacyVigor) - state.maxHp, GRAVE_VOW_MAX_HP),
  });
};

/** Compact the deck positions after a card leaves the run. */
function remapImbues(imbues: CopyImbues, kept: readonly number[]): CopyImbues {
  return Object.fromEntries(kept.flatMap((old, next) => imbues[old] ? [[next, imbues[old]]] : []));
}

/** This bargain cannot be used to preserve a card carried into the run. */
export function greedCanTake(state: RunState, index: number): boolean {
  const card = state.deck[index];
  return state.phase.kind === 'greed-bargain' && !state.promisedToGreed && !!card &&
    state.deck.length > 1 && !state.carriedCards?.includes(card);
}

// --- REDUCER ---

/** Apply the same character edits in a story run and in Illusion Training. */
export const applyCharacterAction = (
  character: CharacterState,
  action: Extract<RunAction, { type: 'setTraitNode' | 'setTraitPathRank' | 'setTraitRank' | 'allocateTrait' | 'buySkill' | 'skillPath' | 'equipItem' | 'discardItem' | 'saveTraits' }>
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
    case 'saveTraits': return saveTraits(character);
  }
};

/** Carry one artifact's effect into this run, never into the permanent inventory. */
function bringHellArtifact(state: RunState, id: HellArtifactId): RunState {
  if (!isHellArtifact(id) || state.artifacts?.includes(id)) return state;
  const artifact = getRunArtifact(id);
  const artifacts = [...(state.artifacts ?? []), id];
  if ('card' in artifact) return { ...state, artifacts, deck: [...state.deck, artifact.card] };

  const bonus = Math.max(0, Math.min(10, playerHpCap(state.character.legacyVigor) - state.maxHp));
  const baseMaxHp = state.baseMaxHp ??
    state.maxHp - characterBonuses(state.character.traits, state.character.equipment, state.character.traitNodes, state.character.legacyVigor).maxHp + PLAYER_MAX_HP;
  return { ...state, artifacts, baseMaxHp: baseMaxHp + bonus, hp: state.hp + bonus, maxHp: state.maxHp + bonus };
}

/** Remember a cancelled turn opening when an affliction ends the wave during End Turn. */
function settleEndTurn(state: RunState, phase: Extract<RunPhase, { kind: 'combat' }>): RunState {
  const combat = endTurn(phase.combat);
  const next = settleCombat(state, phase.stop, combat);
  const area = next.area;
  if (combat === phase.combat || combat.turn !== phase.combat.turn || next.phase.kind !== 'combat' || !area) return next;
  const battle = area.battles[area.battle];
  const willContinue = area.wavePending || (area.respite && battle &&
    (battle.finish === 'endless-boss' || area.wave + 1 < battle.waves.length));
  return willContinue ? { ...next, area: { ...area, waveRefillPending: true } } : next;
}

/** Applies one action. Actions that don't fit the current phase are ignored. */
export const runReducer = (state: RunState, action: RunAction): RunState => {
  const { phase } = state;
  if (phase.kind === 'conquered') return state;
  if (phase.kind === 'sealing') return action.type === 'finishSealing'
    ? { ...state, area: undefined, phase: { kind: 'conquered' } } : state;
  if (phase.kind === 'combat' && state.area?.respite && action.type !== 'abandon')
    return resolveRespite(state, state.area, phase, action);
  switch (action.type) {
    case 'finishSealing':
      return state;
    case 'starterDeck':
      return state.stop === 1 && phase.kind === 'route' && validStarter(action.name, action.cards)
        ? { ...state, ...(action.favorStarter && {rewardStarter: action.name}), deck: appendCarriedCards(action.cards, state.carriedCards ?? []) } : state;
    case 'skillPath':
    case 'buySkill':
    case 'saveTraits': {
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
      const baseHp = state.baseMaxHp ?? state.maxHp - (state.borrowedHp ?? 0) - characterBonuses(state.character.traits, state.character.equipment, state.character.traitNodes, state.character.legacyVigor).maxHp + PLAYER_MAX_HP;
      const health = traitHealth(state.hp, state.maxHp, state.character.traits, character, credited, baseHp, state.character.traitNodes, state.character.highestVigorHp, state.borrowedHp);
      return { ...state, character, baseMaxHp: baseHp, ...health,
        phase: phase.kind === 'combat' ? { ...phase, combat: syncCharacterCombat(phase.combat, character, credited, baseHp, state.character.highestVigorHp, state.borrowedHp) } : phase };
    }
    case 'chooseRegion': {
      if (!isRegionChoice(action.option) || !canChooseRegion(state)) return state;
      const next = { ...state, regionPath: { ...state.regionPath, [regionIndexOf(state.stop)]: action.option } };
      return { ...next, phase: { kind: 'route', options: optionsFor(next, next.stop) } };
    }
    case 'chooseStop': {
      if (state.conquestVersion && canChooseRegion(state)) return state;
      const chosen =
        phase.kind === 'route' ? phase.options[action.option] : undefined;
      if (!chosen) return state;
      const prepared = state.stop === 1 && action.hellArtifact ? bringHellArtifact(state, action.hellArtifact) : state;
      return enterStop(prepared, { ...chosen, optionIndex: action.option });
    }
    case 'nextBattleWave':
      return acceptNextWave(state);
    case 'battleRespite':
    case 'takeBorrowedPower':
    case 'closeBorrowedPowers':
      return state;
    case 'areaCamp':
      return visitAreaCamp(state, action);
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
        ? settleEndTurn(state, phase)
        : state;
    case 'move':
    case 'charge':
    case 'backStep':
      return phase.kind === 'combat'
        ? settleCombat(state, phase.stop, move(phase.combat, moveIdOf(action)))
        : state;
    case 'rerollReward': {
      if (phase.kind !== 'reward' || phase.rerolled) return state;
      const waves = state.area?.battles[state.area.battle]?.waves.length;
      const offers = rollOffers(stopSeed(state.dailyKey, state.area ? 'reward-reroll:area:' + state.area.battle : 'reward-reroll', state.stop), phase.source ?? 'horde', phase.offers, state.rewardStarter, state.character.skillPicks, state.deck, undefined, !!state.deckImbues, waves, state.area?.pushes);
      return { ...state, phase: { ...phase, offers, rerolled: true } };
    }
    case 'pickCard':
      return phase.kind === 'reward' || phase.kind === 'altar'
        ? takeOffer(state, phase.offers, action.offerIndex)
        : state;
    case 'greedChoice': {
      if (phase.kind !== 'greed-bargain') return state;
      const exit = (next: RunState): RunState => phase.explored === undefined ? advanceToNextStop(next)
        : { ...next, phase: { kind: 'area-camp', explored: phase.explored,
          ...(phase.event && { event: phase.event }), ...(phase.visited && { visited: phase.visited }) } };
      if (action.cardIndex === null) return exit(state);
      if (!greedCanTake(state, action.cardIndex)) return state;
      const kept = state.deck.map((_, index) => index).filter(index => index !== action.cardIndex);
      return exit({ ...state, promisedToGreed: state.deck[action.cardIndex]!,
        deck: kept.map(index => state.deck[index]!),
        ...(state.deckImbues && { deckImbues: remapImbues(state.deckImbues, kept) }) });
    }
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
  attempt = 0, wins = 0, shopRings: readonly ShopRingId[] = [], pandoraEffect?: PandoraRunEffect, cardRules?: 1, carried?: CardId | readonly CardId[], legacyProgression = false, conquestVersion?: ConquestVersion, xpStartWins?: number, legacyVigor = false, bonusXp = 0
): RunState => actions.reduce(runReducer, createRun(dailyKey, ringProgress, attempt, wins, shopRings, pandoraEffect, cardRules, carried, legacyProgression, conquestVersion, xpStartWins, legacyVigor, bonusXp));

/** True once the heroes have stopped the villain. */
export const isRunOver = (state: RunState): boolean =>
  state.phase.kind === 'fallen' || state.phase.kind === 'conquered';

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
    case 'saveTraits': return true;
    case 'chooseRegion':
      return 'option' in value && isRegionChoice(value.option);
    case 'chooseStop':
      return 'option' in value && isIndex(value.option) &&
        (!('hellArtifact' in value) || value.hellArtifact === undefined || isHellArtifact(value.hellArtifact));
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
    case 'areaCamp':
      return 'choice' in value && (value.choice === 'explore' || value.choice === 'rest' || value.choice === 'continue') &&
        (!('room' in value) || (value.choice === 'explore' && isIndex(value.room)));
    case 'nextBattleWave':
    case 'finishSealing':
      return true;
    case 'battleRespite':
      return 'choice' in value && (value.choice === 'rest' || value.choice === 'explore' || value.choice === 'fight' || value.choice === 'borrow');
    case 'takeBorrowedPower':
      return 'index' in value && isIndex(value.index) && value.index < 3;
    case 'closeBorrowedPowers':
      return true;
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
    case 'greedChoice':
      return 'cardIndex' in value && (value.cardIndex === null || isIndex(value.cardIndex));
    case 'graveChoice':
      return (
        'choice' in value &&
        (value.choice === 'mourn' || value.choice === 'vow')
      );
    default:
      return false;
  }
};

