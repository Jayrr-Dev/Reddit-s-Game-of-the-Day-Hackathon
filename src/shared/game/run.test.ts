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
  assert.ok(isRunAction({ type: 'playCard', handIndex: 0, targetUid: -2 }));
  assert.ok(isRunAction({ type: 'playCard', handIndex: 0, targetUid: -2, targetUids: [-2] }));
  assert.equal(isRunAction({ type: 'playCard', handIndex: 0, targetUid: -3 }), false);
  assert.equal(isRunAction({ type: 'playCard', handIndex: 0, targetUid: 1, targetUids: [-2] }), false);
  assert.equal(isRunAction({ type: 'playCard', handIndex: 0, targetUid: -2, targetUids: [1, -2] }), false);
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

void test('a Conquest win records its encounter once, independent of card rewards', () => {
  const won = winWith(lastHeroFight(['rushPotion', 'backhand']), false);
  assert.equal(won.phase.kind, 'reward');
  assert.deepEqual(won.goldVictories, [{ stop: 1, encounter: 'horde' }]);
  const rerolled = runReducer(won, { type: 'rerollReward' });
  assert.deepEqual(rerolled.goldVictories, won.goldVictories);
  const movedOn = runReducer(rerolled, { type: 'pickCard', offerIndex: null });
  assert.deepEqual(movedOn.goldVictories, won.goldVictories);
});


void test('an Exhaust card counts its uses across fights', () => {
  const fight = lastHeroFight(['rushPotion', 'backhand']);
  const run: RunState = { ...fight, deck: [...fight.deck, 'rushPotion'] };
  const won = winWith(run, true);
  assert.equal(won.phase.kind, 'reward');
  assert.deepEqual(won.deck, run.deck, 'one use spent: still in the deck');
  assert.equal(won.usesSpent.rushPotion, 1);
  const route = runReducer(won, { type: 'pickCard', offerIndex: null });
  if (route.phase.kind !== 'route') throw new Error('no route');
  const next = route.phase.options.map((_, option) =>
    runReducer(route, { type: 'chooseStop', option })
  ).find(state => state.phase.kind === 'combat');
  assert.ok(next?.phase.kind === 'combat');
  assert.equal(next.phase.combat.usesSpent.rushPotion, 1);
});

void test('its last use takes it out of the deck for the run', () => {
  const fresh = lastHeroFight(['healingPotion', 'backhand']);
  if (fresh.phase.kind !== 'combat') throw new Error('no fight');
  const usesSpent = { healingPotion: 1 }; // A copy used before Healing Potion became single-use.
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
void test('story champions unlock slots 1 through 5 across cumulative victories', () => {
  const base = lastHeroFight(['healingPotion', 'backhand']);
  assert.equal(winWith(base, false).character.ringProgress.bossWins, 0);
  if (base.phase.kind !== 'combat') throw Error('missing combat');
  const champion = routeOptions(DAY, 5)[0]!;
  for (let wins = 0; wins <= 5; wins++) {
    const won = winWith({ ...base, character: { ...base.character, ringProgress: { bossWins: wins, rareSlots: [] } },
      phase: { ...base.phase, stop: champion } }, false);
    assert.equal(won.character.ringProgress.bossWins, wins + 1);
    assert.equal(won.storyRingUnlocked, wins < 5 ? wins + 1 : undefined);
  }
});

void test('ending a run cannot unlock extra ring slots', () => {
  const fresh = createRun(DAY);
  const result = runReducer({...fresh,stats:{...fresh.stats,wavesCleared:1}}, {type:'abandon'});
  assert.deepEqual(result.ringDrops,[]);
  assert.equal(result.character.equipment.rings.length,5);
});
void test('only lethal battles retain the final field for the story defeat screen', () => {
  const first = createRun(DAY);
  const battle = runReducer(first, { type: 'chooseStop', option: 0 });
  assert.ok(battle.phase.kind === 'combat');
  const combat = battle.phase.combat;
  const poisoned = { ...combat, player: { ...combat.player, hp: 1, statuses: { ...combat.player.statuses, poison: 100 } } };
  const lost = runReducer({ ...battle, phase: { ...battle.phase, combat: poisoned } }, { type: 'endTurn' });
  assert.ok(lost.phase.kind === 'fallen');
  assert.equal(lost.phase.battlefield?.combat.player.hp, 0);
  assert.deepEqual(lost.phase.battlefield?.stop, battle.phase.stop);
  const abandoned = runReducer(battle, { type: 'abandon' });
  assert.ok(abandoned.phase.kind === 'fallen');
  assert.equal(abandoned.phase.battlefield, undefined);
});

void test('Hell artifacts affect only the chosen conquest and replay the same way', () => {
  const fresh = createRun(DAY);
  const ward = { type: 'chooseStop', option: 0, hellArtifact: 'bone-sigil' } as const;
  const withWard = runReducer(fresh, ward);
  assert.deepEqual(withWard.deck, [...fresh.deck, 'boneWard']);
  assert.deepEqual(replayRun(DAY, [ward]), withWard);
  assert.equal(runReducer(withWard, ward), withWard);
  assert.equal(isRunAction(ward), true);
  assert.equal(isRunAction({ ...ward, hellArtifact: 'not-an-artifact' }), false);
  const withHeart = runReducer(fresh, { ...ward, hellArtifact: 'ember-heart' });
  assert.equal(withHeart.maxHp, fresh.maxHp + 10);
  assert.equal(withHeart.hp, fresh.hp + 10);
  const withVial = runReducer(fresh, { ...ward, hellArtifact: 'ashen-vial' });
  assert.deepEqual(withVial.deck, [...fresh.deck, 'antidote']);
  assert.deepEqual(createRun(DAY).deck, fresh.deck);
  const later = { ...fresh, stop: 2 };
  assert.deepEqual(runReducer(later, ward), runReducer(later, { type: 'chooseStop', option: 0 }));
});
