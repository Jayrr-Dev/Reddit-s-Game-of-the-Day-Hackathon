// ===================================================================
// COMBAT ENGINE TESTS
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CardId } from './cards.ts';
import {
  attackDamage,
  endOfTurnUpkeep,
  takeDamage,
  createCombatant,
  NO_STATUSES,
} from './combatant.ts';
import {
  canPlayCard,
  combatOutcome,
  endTurn,
  endTurnSteps,
  heroTurnOrder,
  playCard,
  playCardSteps,
  startCombat,
} from './combat.ts';
import { describeCard } from './describe.ts';
import { CARDS_PER_TURN, ENERGY_PER_TURN } from './rules.ts';
import type { CombatState } from './types.ts';

// --- FIXTURES ---
/** A fight against one Squire with the given deck. */
const fightWith = (deck: CardId[]): CombatState =>
  startCombat({
    hp: 60,
    maxHp: 60,
    deck,
    heroIds: ['squire'],
    might: 1,
    seed: 7,
  });

/** Puts a specific card in hand slot 0 so a test controls what is played. */
const withHand = (state: CombatState, hand: CardId[]): CombatState => ({
  ...state,
  hand,
});

// --- COMBATANT RULES ---
void test('shroud absorbs damage before HP', () => {
  const shrouded = { ...createCombatant(20, 20), shroud: 5 };
  const hit = takeDamage(shrouded, 8);
  assert.equal(hit.shroud, 0);
  assert.equal(hit.hp, 17);
});

void test('wrath adds to each hit and dread cuts damage by 25%', () => {
  const base = createCombatant(10, 10);
  assert.equal(
    attackDamage(6, { ...base, statuses: { ...NO_STATUSES, wrath: 2 } }),
    8
  );
  assert.equal(
    attackDamage(8, { ...base, statuses: { ...NO_STATUSES, dread: 1 } }),
    6
  );
});

void test('hex deals its damage at end of turn and then drops by one', () => {
  const hexed = {
    ...createCombatant(20, 20),
    statuses: { ...NO_STATUSES, hex: 3, dread: 1 },
  };
  const after = endOfTurnUpkeep(hexed);
  assert.equal(after.hp, 17);
  assert.deepEqual(after.statuses, { ...NO_STATUSES, hex: 2 });
});

// --- TURN FLOW ---
void test('a fight starts with a full hand and full energy', () => {
  const state = fightWith(Array<CardId>(10).fill('backhand'));
  assert.equal(state.hand.length, CARDS_PER_TURN);
  assert.equal(state.energy, ENERGY_PER_TURN);
  assert.equal(state.turn, 1);
});

void test('playing a card spends energy and damages the target', () => {
  const state = withHand(fightWith(Array<CardId>(10).fill('backhand')), [
    'backhand',
  ]);
  const after = playCard(state, 0, 1);
  assert.equal(after.energy, ENERGY_PER_TURN - 1);
  assert.equal(after.heroes[0]?.hp, 14 - 6);
  assert.deepEqual(after.discardPile, ['backhand']);
});

void test('a card that costs too much is refused', () => {
  const broke = { ...withHand(fightWith(['ruin']), ['ruin']), energy: 1 };
  assert.equal(canPlayCard(broke, 0), false);
  assert.equal(playCard(broke, 0, 1), broke);
});

void test('a fading card leaves the fight after use', () => {
  const after = playCard(withHand(fightWith(['seethe']), ['seethe']), 0, 1);
  assert.deepEqual(after.fadedPile, ['seethe']);
  assert.equal(after.player.statuses.wrath, 2);
});

void test('killing the last hero wins the fight and counts it as slain', () => {
  const state = withHand(fightWith(['undyingHatred']), ['undyingHatred']);
  const after = playCard(state, 0, 1);
  assert.equal(combatOutcome(after), 'won');
  assert.equal(after.slain, 1);
});

void test('a stale target falls back to a living hero', () => {
  const after = playCard(
    withHand(fightWith(['backhand']), ['backhand']),
    0,
    99
  );
  assert.equal(after.heroes[0]?.hp, 8);
});

void test('ending the turn lets the hero act and deals a new hand', () => {
  const state = fightWith(Array<CardId>(10).fill('backhand'));
  const after = endTurn(state);
  assert.equal(after.player.hp, 60 - 5); // Squire opens with Swing (5).
  assert.equal(after.turn, 2);
  assert.equal(after.hand.length, CARDS_PER_TURN);
  assert.equal(after.heroes[0]?.moveIndex, 1);
});

void test('heroes act fastest first, ties by uid, beat by beat', () => {
  const state = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['backhand'],
    heroIds: ['squire', 'rogue', 'archer', 'shieldmaiden'],
    might: 1,
    seed: 3,
  });
  const order = heroTurnOrder(state.heroes).map((unit) => unit.heroId);
  assert.deepEqual(order, ['rogue', 'archer', 'squire', 'shieldmaiden']);
  const steps = endTurnSteps(state);
  const actors = steps.flatMap(({ actorUid }) =>
    actorUid === null
      ? []
      : [state.heroes.find((unit) => unit.uid === actorUid)?.heroId]
  );
  assert.deepEqual(actors, order);
  assert.deepEqual(steps.at(-1)?.state, endTurn(state));
});

// --- BUFFS ---
/** The Squire's uid in a fightWith() fight. */
const squireUid = (state: CombatState): number => state.heroes[0]?.uid ?? -1;

/** HP the Squire lost when `cardId` is played with the given buffs. */
const damageWith = (cardId: CardId, buffs: Partial<typeof NO_STATUSES>) => {
  const start = withHand(fightWith(['backhand']), [cardId]);
  const buffed = {
    ...start,
    player: { ...start.player, statuses: { ...NO_STATUSES, ...buffs } },
  };
  const before = buffed.heroes[0]?.hp ?? 0;
  const after = playCard(buffed, 0, squireUid(buffed));
  return before - (after.heroes[0]?.hp ?? 0);
};

void test('Might, Surge and Piercing each power up only their own card type', () => {
  assert.equal(damageWith('backhand', { might: 2 }), 8);
  assert.equal(damageWith('backhand', { surge: 2, piercing: 2 }), 6);
  assert.equal(damageWith('spiteBolt', { piercing: 3 }), 9);
  assert.equal(damageWith('hexfire', { surge: 1 }), 7);
  assert.equal(damageWith('mourningCurse', { might: 5, surge: 5 }), 4);
});

void test('a type buff adds to every hit of a multi-hit card', () => {
  assert.equal(damageWith('flurry', { might: 1 }), 12);
});

void test('Protection adds to every Guard (shroud) a card gives', () => {
  const start = withHand(fightWith(['backhand']), ['darkCloak']);
  const guarded = {
    ...start,
    player: { ...start.player, statuses: { ...NO_STATUSES, protection: 2 } },
  };
  assert.equal(playCard(guarded, 0, -1).player.shroud, 7);
});

void test('buff cards grant their buff for the rest of the fight', () => {
  const start = withHand(fightWith(['backhand']), ['bloodlust']);
  const after = playCard(start, 0, -1);
  assert.equal(after.player.statuses.might, 2);
  assert.equal(endTurn(after).player.statuses.might, 2);
});

void test('playCardSteps shows each hit and ends on the real play', () => {
  const start = withHand(fightWith(['backhand']), ['flurry']);
  const steps = playCardSteps(start, 0, squireUid(start));
  assert.equal(steps.length, 3);
  assert.deepEqual(steps.at(-1), playCard(start, 0, squireUid(start)));
  const hpOf = (state: CombatState) => state.heroes[0]?.hp ?? 0;
  assert.ok(hpOf(steps[0] as CombatState) > hpOf(steps[1] as CombatState));
});

// --- TARGET N ---
/** A fight against a Squire (front) and an Archer (back). */
const squireAndArcher = (hand: CardId[]): CombatState =>
  withHand(
    startCombat({
      hp: 60,
      maxHp: 60,
      deck: ['backhand'],
      heroIds: ['squire', 'archer'],
      might: 1,
      seed: 7,
    }),
    hand
  );

/** HP lost by each hero (by uid) between two states. */
const hpLost = (before: CombatState, after: CombatState) =>
  before.heroes.map(
    (unit) =>
      unit.hp - (after.heroes.find((now) => now.uid === unit.uid)?.hp ?? 0)
  );

void test('a Target N card can pick the same hero more than once', () => {
  const start = squireAndArcher(['scatterShot']);
  const [squire, archer] = start.heroes.map((unit) => unit.uid);
  const picks = [archer ?? -1, archer ?? -1, squire ?? -1];
  const after = playCard(start, 0, picks[0] ?? -1, picks);
  assert.deepEqual(hpLost(start, after), [3, 6]);
});

void test('every pick follows reach: a melee pick at the back row hits the front', () => {
  const start = squireAndArcher(['reapingCuts']);
  const [squire, archer] = start.heroes.map((unit) => unit.uid);
  const picks = [squire ?? -1, archer ?? -1];
  const after = playCard(start, 0, picks[0] ?? -1, picks);
  assert.deepEqual(hpLost(start, after), [8, 0]);
});

void test('a Target N card shows one beat per pick and ends on the real play', () => {
  const start = squireAndArcher(['forkedBolt']);
  const [squire, archer] = start.heroes.map((unit) => unit.uid);
  const picks = [squire ?? -1, archer ?? -1];
  const steps = playCardSteps(start, 0, picks[0] ?? -1, picks);
  assert.equal(steps.length, 2);
  assert.deepEqual(steps.at(-1), playCard(start, 0, picks[0] ?? -1, picks));
});

// --- PREVIEW MATCHES THE ENGINE ---
void test('card text damage always equals the damage the engine deals', () => {
  const buffSets: Partial<typeof NO_STATUSES>[] = [
    {},
    { wrath: 2 },
    { might: 3 },
    { surge: 2, piercing: 1 },
    { momentum: 1, might: 1 },
    { wrath: 1, dread: 1 },
  ];
  const cards: CardId[] = ['backhand', 'spiteBolt', 'hexfire', 'twinDaggers'];
  for (const buffs of buffSets) {
    for (const cardId of cards) {
      const start = withHand(fightWith(['backhand']), [cardId]);
      const player = {
        ...start.player,
        statuses: { ...NO_STATUSES, ...buffs },
      };
      const [line = ''] = describeCard(cardId, player);
      const perHit = Number(/Deal (\d+)/.exec(line)?.[1]);
      const hits = Number(/(\d+) times/.exec(line)?.[1] ?? 1);
      const dealt = damageWith(cardId, buffs);
      assert.equal(dealt, Math.min(perHit * hits, 14), `${cardId} ${line}`);
    }
  }
});
