// ===================================================================
// RUN (CONQUEST) TESTS
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChampionStop, mightAt, routeOptions } from './kingdom.ts';
import {
  computeScore,
  createRun,
  isRunAction,
  isRunOver,
  replayRun,
  runReducer,
} from './run.ts';
import { playBotRun } from './testBot.ts';
import type { RunState } from './run.ts';
import type { CombatState } from './types.ts';
import { EXHAUST_USES } from './rules.ts';

const DAY = '2026-11-23';

// --- ROUTES ---
void test('everyone gets the same route on the same day', () => {
  assert.deepEqual(routeOptions(DAY, 3), routeOptions(DAY, 3));
});

void test('every fifth stop is a lone champion', () => {
  assert.ok(isChampionStop(5));
  const options = routeOptions(DAY, 5);
  assert.equal(options.length, 1);
  assert.equal(options[0]?.kind, 'champion');
});

void test('the first path is always a horde', () => {
  for (let stop = 1; stop < 30; stop += 1) {
    if (!isChampionStop(stop))
      assert.equal(routeOptions(DAY, stop)[0]?.kind, 'horde');
  }
});

void test('heroes grow stronger deeper in the kingdom', () => {
  assert.ok(mightAt(12) > mightAt(2));
});

// --- REDUCER ---
void test('a run starts at the first crossroads with the starter deck', () => {
  const run = createRun(DAY);
  assert.equal(run.phase.kind, 'route');
  assert.equal(run.deck.length, 11);
  assert.ok(run.deck.includes('healingPotion'), 'one Healing Potion');
});

void test('actions that do not fit the phase are ignored', () => {
  const run = createRun(DAY);
  assert.equal(runReducer(run, { type: 'endTurn' }), run);
  assert.equal(runReducer(run, { type: 'chooseStop', option: 9 }), run);
});

void test('choosing a horde starts a fight', () => {
  const run = runReducer(createRun(DAY), { type: 'chooseStop', option: 0 });
  assert.equal(run.phase.kind, 'combat');
});

// --- FULL RUNS ---
void test('a bot run ends with the villain fallen and a positive score', () => {
  const { state } = playBotRun(DAY);
  assert.equal(state.phase.kind, 'fallen');
  assert.ok(computeScore(state.stats) > 0);
});

void test('replaying the action log rebuilds the exact same run', () => {
  const { state, actions } = playBotRun(DAY);
  assert.deepEqual(replayRun(DAY, actions), state);
});

// --- VALIDATION ---
void test('isRunAction accepts real actions and rejects junk', () => {
  assert.ok(isRunAction({ type: 'playCard', handIndex: 0, targetUid: 1 }));
  assert.ok(isRunAction({ type: 'pickCard', offerIndex: null }));
  assert.ok(isRunAction({ type: 'move', move: 'charge' }));
  assert.ok(isRunAction({ type: 'charge' })); // legacy logs still replay
  assert.equal(isRunAction({ type: 'move', move: 'teleport' }), false);
  assert.equal(
    isRunAction({ type: 'playCard', handIndex: -1, targetUid: 1 }),
    false
  );
  assert.equal(isRunAction({ type: 'graveChoice', choice: 'cry' }), false);
  assert.equal(isRunAction('endTurn'), false);
});

void test('abandoning ends the run and keeps the score so far', () => {
  const run = replayRun('2026-11-23', [{ type: 'chooseStop', option: 0 }]);
  const abandoned = runReducer(run, { type: 'abandon' });
  assert.equal(abandoned.phase.kind, 'fallen');
  assert.ok(isRunOver(abandoned));
  assert.deepEqual(abandoned.stats, run.stats);
  assert.ok(isRunAction({ type: 'abandon' }));
});

// --- EXHAUST ---
/** A first fight against one hero on 1 HP, with `hand` in hand. */
const lastHeroFight = (hand: CombatState['hand']): RunState => {
  const run = runReducer(createRun(DAY), { type: 'chooseStop', option: 0 });
  if (run.phase.kind !== 'combat') throw new Error('no fight');
  const { combat } = run.phase;
  const [hero] = combat.heroes;
  if (!hero) throw new Error('no hero');
  const lastHero = { ...hero, hp: 1, row: 'front' as const };
  return {
    ...run,
    phase: {
      ...run.phase,
      combat: { ...combat, heroes: [lastHero], hand, energy: 5 },
    },
  };
};

/** Plays the potion (when `drink`), then the Backhand to win the fight. */
const winWith = (run: RunState, drink: boolean): RunState => {
  const uid = run.phase.kind === 'combat' ? run.phase.combat.heroes[0]?.uid : 0;
  const drank = drink
    ? runReducer(run, { type: 'playCard', handIndex: 0, targetUid: -1 })
    : run;
  const backhand = drink ? 0 : 1;
  return runReducer(drank, {
    type: 'playCard',
    handIndex: backhand,
    targetUid: uid ?? 0,
  });
};

void test('an Exhaust card counts its uses across fights', () => {
  const run = lastHeroFight(['healingPotion', 'backhand']);
  const won = winWith(run, true);
  assert.equal(won.phase.kind, 'reward');
  assert.deepEqual(won.deck, run.deck, 'one use spent: still in the deck');
  assert.equal(won.usesSpent.healingPotion, 1);
});

void test('its last use takes it out of the deck for the run', () => {
  const fresh = lastHeroFight(['healingPotion', 'backhand']);
  if (fresh.phase.kind !== 'combat') throw new Error('no fight');
  const usesSpent = { healingPotion: EXHAUST_USES - 1 };
  const run: RunState = {
    ...fresh,
    usesSpent,
    phase: { ...fresh.phase, combat: { ...fresh.phase.combat, usesSpent } },
  };
  const won = winWith(run, true);
  assert.equal(won.phase.kind, 'reward');
  assert.ok(!won.deck.includes('healingPotion'));
  assert.equal(won.deck.length, run.deck.length - 1);
  assert.equal(won.usesSpent.healingPotion, undefined);
});

void test('an Exhaust card not played is untouched', () => {
  const run = lastHeroFight(['healingPotion', 'backhand']);
  const won = winWith(run, false);
  assert.equal(won.phase.kind, 'reward');
  assert.deepEqual(won.deck, run.deck);
  assert.deepEqual(won.usesSpent, {});
});
