import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, replayRun, type RunAction } from './run.ts';
import {
  normalizeTraitNodeIds,
  traitNodeArms,
  traitNodeIds,
} from './character.ts';
import { replayForScore } from './replayForScore.ts';
import { playBotRun } from './testBot.ts';
import {
  restartLoggedRun,
  restoreLoggedRun,
  saveLoggedRun,
  type LoggedRun,
} from './runSave.ts';

const store = () => {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    key: (i: number) => [...data.keys()][i] ?? null,
  };
};
const earn = (
  state: LoggedRun,
  bossWins: number,
  rareSlots: number[]
): LoggedRun => ({
  ...state,
  actions: [{ type: 'abandon' }],
  run: {
    ...state.run,
    character: {
      ...state.run.character,
      ringProgress: { bossWins, rareSlots },
    },
  },
});

void test('earned ring slots survive attempts and days, including slot ten, without duplicating wins', () => {
  const storage = store();
  const first = earn(restoreLoggedRun('day1', storage), 2, [10]);
  saveLoggedRun(first, storage);
  saveLoggedRun(first, storage);
  const second = restartLoggedRun(first, storage);
  assert.equal(second.attempt, 1);
  assert.deepEqual(second.initialRings, { bossWins: 2, rareSlots: [10] });
  const played = earn(second, 3, [6, 10]);
  saveLoggedRun(played, storage);
  saveLoggedRun(first, storage);
  const nextDay = restoreLoggedRun('day2', storage);
  assert.equal(nextDay.attempt, 0);
  assert.deepEqual(nextDay.initialRings, { bossWins: 3, rareSlots: [6, 10] });
  const reloaded = restoreLoggedRun('day1', storage);
  assert.equal(reloaded.attempt, 1);
  assert.deepEqual(
    reloaded.run,
    replayRun('day1', played.actions, second.initialRings, 1)
  );
});

void test('legacy action-only saves still replay, and an untouched start keeps attempt zero', () => {
  const storage = store();
  storage.setItem(
    'villain-arc:run:old',
    JSON.stringify([{ type: 'allocateTrait', trait: 'strength' }])
  );
  const restored = restoreLoggedRun('old', storage);
  assert.equal(restored.run.character.traits.strength, 1);
  assert.equal(restored.attempt, 0);
  const fresh = restoreLoggedRun('new', storage);
  assert.equal(restartLoggedRun(fresh, storage).attempt, 0);
});

void test('unlocked gear preserves the score from the public action log', () => {
  const day = '2030-09-01';
  const { actions } = playBotRun(day);
  const log: RunAction[] = [
    { type: 'equipItem', slot: 'ring', ringIndex: 1, itemId: 'iron-ring' },
    ...actions,
  ];
  const local = replayRun(day, log, { bossWins: 2, rareSlots: [10] }, 3);
  const ranked = replayForScore(day, log);
  assert.deepEqual(local.stats, ranked.stats);
  assert.equal(computeScore(local.stats), computeScore(ranked.stats));
  assert.equal(local.character.equipment.rings[1], 'iron-ring');
});
void test('saved logs restore a mix of old rank edits and new individual node selections', () => {
  const storage = store();
  const actions: RunAction[] = [
    { type: 'setTraitRank', trait: 'vigor', rank: 1 },
    { type: 'setTraitPathRank', trait: 'strength', path: 'right', rank: 1 },
    { type: 'setTraitNode', trait: 'dexterity', node: 63, owned: true },
    { type: 'chooseStop', option: 0 },
  ];
  storage.setItem('villain-arc:run:rank-migration', JSON.stringify(actions));
  const restored = restoreLoggedRun('rank-migration', storage);
  assert.deepEqual(restored.actions.slice(0, 2), actions.slice(0, 2));
  assert.deepEqual(
    traitNodeIds(
      restored.run.character.traits,
      restored.run.character.traitNodes,
      'dexterity'
    ),
    [1]
  );
  assert.deepEqual(restored.run, replayRun('rank-migration', restored.actions));
  saveLoggedRun(restored, storage);
  assert.deepEqual(
    restoreLoggedRun('rank-migration', storage).run,
    restored.run
  );
});

void test('legacy disconnected buys and an interior refund migrate once, while new logs strictly reject skips', () => {
  const storage = store();
  const { left, right } = traitNodeArms('strength');
  const [a, b, c] = [left[9]!, left[15]!, right[15]!];
  const node = (id: number, owned: boolean): RunAction => ({
    type: 'setTraitNode',
    trait: 'strength',
    node: id,
    owned,
  });
  const oldLog = [node(a, true), node(c, true), node(b, true), node(a, false)];
  const key = 'villain-arc:run:legacy-arms';
  storage.setItem(
    key,
    JSON.stringify({
      attempt: 0,
      initialRings: { bossWins: 0, rareSlots: [] },
      actions: oldLog,
    })
  );
  const migrated = restoreLoggedRun('legacy-arms', storage);
  const ids = traitNodeIds(
    migrated.run.character.traits,
    migrated.run.character.traitNodes,
    'strength'
  );
  assert.deepEqual(ids, normalizeTraitNodeIds('strength', [b, c]));
  assert.deepEqual(migrated.run, replayRun('legacy-arms', migrated.actions));
  saveLoggedRun(migrated, storage);
  assert.deepEqual(restoreLoggedRun('legacy-arms', storage), migrated);
  const saved = JSON.parse(storage.getItem(key)!);
  storage.setItem(key, JSON.stringify({ ...saved, actions: [node(c, true)] }));
  assert.equal(
    restoreLoggedRun('legacy-arms', storage).run.character.traits.strength,
    0
  );
});

