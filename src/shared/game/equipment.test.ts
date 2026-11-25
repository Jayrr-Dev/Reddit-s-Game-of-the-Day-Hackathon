import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, equipItem, restoreCharacter } from './character.ts';
import { endTurnSteps, startCombat } from './combat.ts';
import { CARDS_PER_TURN, ENERGY_PER_TURN } from './rules.ts';
import { createRun, replayRun, runReducer, type RunAction, type RunState } from './run.ts';
import { replayForScore } from './replayForScore.ts';
import { retryTrainingFight } from './sandbox.ts';
import type { CardId } from './cards.ts';

const day = '2031-05-14';
const ring = 'iron-ring';
const amulet = 'travelers-amulet';
const plainDeck = Array<CardId>(16).fill('backhand');
const setup = { hp: 100, maxHp: 100, heroIds: ['squire'] as const, deck: plainDeck, might: 1, seed: 99 };
const enter: RunAction = { type: 'chooseStop', option: 0 };
const turn: RunAction = { type: 'endTurn' };
const equipRing = (itemId: string | null, ringIndex = 0): RunAction =>
  ({ type: 'equipItem', slot: 'ring', itemId, ringIndex });
const equipAmulet = (itemId: string | null): RunAction => ({ type: 'equipItem', slot: 'amulet', itemId });

const battleOf = (run: RunState) => {
  assert.ok(run.phase.kind === 'combat');
  return run.phase.combat;
};

void test('starter Iron Ring retains one energy through end turn and can be removed or restored in the first slot', () => {
  const fresh = createRun(day);
  assert.equal(fresh.character.equipment.rings[0], ring);
  assert.equal(fresh.character.equipment.amulet, null);
  const battle = runReducer(fresh, enter);
  const unequipped = runReducer(battle, equipRing(null));
  const reequipped = runReducer(unequipped, equipRing(ring));
  assert.equal(battleOf(runReducer(battle, turn)).energy, ENERGY_PER_TURN + 1);
  assert.equal(battleOf(runReducer(unequipped, turn)).energy, ENERGY_PER_TURN);
  assert.equal(battleOf(runReducer(reequipped, turn)).energy, ENERGY_PER_TURN + 1);
  assert.equal(reequipped.character.ringProgress.bossWins, 0);
});

void test('Endurance reserve and Iron Ring add independently, including old characters with explicitly empty slots', () => {
  const base = createCharacter();
  const traits = { ...base.traits, endurance: 64 };
  const equipped = startCombat({ ...setup, traits });
  const legacyEmpty = restoreCharacter({ ...base, equipment: { ring: null, amulet: null } });
  const arrayEmpty = restoreCharacter({ ...base, equipment: { rings: Array(10).fill(null), amulet: null } });
  const legacyEquipped = restoreCharacter({ ...base, equipment: { ring, amulet } });
  assert.equal(legacyEmpty.equipment.rings[0], null);
  assert.deepEqual(arrayEmpty.equipment, legacyEmpty.equipment);
  assert.equal(legacyEquipped.equipment.rings[0], ring);
  assert.equal(legacyEquipped.equipment.amulet, amulet);
  const naked = startCombat({ ...setup, traits, equipment: legacyEmpty.equipment });
  for (const [fight, reserve] of [[equipped, 12], [naked, 11]] as const) {
    const steps = endTurnSteps({ ...fight, energy: 20 });
    assert.equal(steps[0]?.state.reserve, reserve);
    assert.equal(steps.at(-1)?.state.energy, 6 + reserve);
  }
});

void test('Traveler’s Amulet changes the opening and later draws without retroactively changing the current hand', () => {
  const fresh = { ...createRun(day), deck: plainDeck };
  const battle = runReducer(fresh, enter);
  const equippedAtStart = runReducer(runReducer(fresh, equipAmulet(amulet)), enter);
  assert.equal(battleOf(battle).hand.length, CARDS_PER_TURN);
  assert.equal(battleOf(equippedAtStart).hand.length, CARDS_PER_TURN + 1);
  const equipped = runReducer(battle, equipAmulet(amulet));
  assert.deepEqual(battleOf(equipped).hand, battleOf(battle).hand);
  const next = runReducer(equipped, turn);
  assert.equal(battleOf(next).hand.length, CARDS_PER_TURN + 1);
  const removed = runReducer(next, equipAmulet(null));
  assert.deepEqual(battleOf(removed).hand, battleOf(next).hand);
  assert.equal(battleOf(runReducer(removed, turn)).hand.length, CARDS_PER_TURN);
});

void test('training retry uses the current amulet, preserving every card when enlarging or reducing its opening hand', () => {
  const original = createCharacter();
  const withAmulet = equipItem(original, 'amulet', amulet);
  const base = startCombat({ ...setup, equipment: original.equipment });
  const larger = retryTrainingFight(base, withAmulet);
  assert.deepEqual(larger.hand, [...base.hand, base.drawPile[0]]);
  assert.deepEqual(larger.drawPile, base.drawPile.slice(1));
  const smaller = retryTrainingFight(larger, original);
  assert.deepEqual(smaller.hand, base.hand);
  assert.deepEqual(smaller.drawPile, base.drawPile);
});

void test('ranked verification reproduces retained energy when a carried unlock receives the unequipped starter ring', () => {
  const actions = [equipRing(null), equipRing(ring, 4), enter, turn];
  const local = replayRun(day, actions, { bossWins: 5, rareSlots: [] }, 2);
  const verified = replayForScore(day, actions);
  assert.equal(battleOf(local).energy, ENERGY_PER_TURN + 1);
  assert.deepEqual(battleOf(verified), battleOf(local));
  assert.equal(createRun(day).character.ringProgress.rareSlots.length, 0);
});
