import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  characterBonuses,
  createCharacter,
  equipItem,
  traitNodeArms,
  traitNodeIds,
} from './character.ts';
import { combatantBonuses } from './combatant.ts';
import { replayForScore } from './replayForScore.ts';
import {
  applyCharacterAction,
  createRun,
  isRunAction,
  replayRun,
  runReducer,
  type RunAction,
} from './run.ts';
import { createSandboxWith, retryTrainingFight } from './sandbox.ts';

const chooseNode = (
  trait: 'strength' | 'vigor' | 'endurance',
  node: number,
  owned: boolean
) => ({ type: 'setTraitNode', trait, node, owned }) as const;
const enter = { type: 'chooseStop', option: 0 } as const;

void test('live buys start at the paid star, advance one node along a chosen arm and only refund its tip', () => {
  const day = 'connected-ranks';
  const [first, second, third] = traitNodeArms('strength').left;
  assert.ok(first && second && third);
  const fresh = createRun(day, undefined, 0, 1);
  assert.equal(runReducer(fresh, chooseNode('strength', first, true)), fresh);
  const root = chooseNode('strength', 1, true);
  const start = runReducer(fresh, root);
  assert.equal(runReducer(start, chooseNode('strength', second, true)), start);
  const actions: RunAction[] = [
    root,
    chooseNode('strength', first, true),
    chooseNode('strength', second, true),
    enter,
  ];
  const playing = replayRun(day, actions, undefined, 0, 1);
  assert.ok(playing.phase.kind === 'combat');
  assert.equal(playing.character.traits.strength, 3);
  assert.equal(
    runReducer(playing, chooseNode('strength', first, false)),
    playing
  );
  assert.equal(runReducer(playing, chooseNode('strength', 1, false)), playing);
  const refund = chooseNode('strength', second, false);
  const changed = runReducer(playing, refund);
  assert.ok(changed.phase.kind === 'combat');
  assert.deepEqual(
    traitNodeIds(
      changed.character.traits,
      changed.character.traitNodes,
      'strength'
    ),
    [1, first].sort((a, b) => a - b)
  );
  assert.deepEqual(
    combatantBonuses(changed.phase.combat.player),
    characterBonuses(
      changed.character.traits,
      changed.character.equipment,
      changed.character.traitNodes
    )
  );
  assert.deepEqual(
    replayForScore(day, [...actions, refund], 1).phase,
    changed.phase
  );
  for (const invalid of [0, -1, 65, 2.5])
    assert.equal(isRunAction(chooseNode('strength', invalid, true)), false);
});
void test('each arm can reach its final node without spending points in the other arms', () => {
  const arms = traitNodeArms('vigor');
  for (const arm of Object.values(arms)) {
    assert.equal(arm.length, 21);
    let character = { ...createCharacter(), level: 70 };
    for (const id of [1, ...arm])
      character = applyCharacterAction(
        character,
        chooseNode('vigor', id, true)
      );
    assert.equal(character.traits.vigor, 22);
    for (const id of [...arm].reverse())
      character = applyCharacterAction(
        character,
        chooseNode('vigor', id, false)
      );
    assert.deepEqual(
      traitNodeIds(character.traits, character.traitNodes, 'vigor'),
      [1]
    );
  }
});

void test('refunding then selecting a health node again preserves story and live combat wounds', () => {
  const fresh = createRun('node-wounds');
  const node = Array.from({ length: 64 }, (_, i) => i + 1).find(
    (id) => runReducer(fresh, chooseNode('vigor', id, true)).maxHp > fresh.maxHp
  );
  assert.ok(node);
  const buy = chooseNode('vigor', node, true);
  const start = runReducer(runReducer(fresh, buy), enter);
  assert.ok(start.phase.kind === 'combat');
  const wounded = {
    ...start,
    hp: 3,
    phase: {
      ...start.phase,
      combat: {
        ...start.phase.combat,
        player: { ...start.phase.combat.player, hp: 3 },
      },
    },
  };
  const result = runReducer(
    runReducer(wounded, chooseNode('vigor', node, false)),
    buy
  );
  assert.ok(result.phase.kind === 'combat');
  assert.equal(result.hp, 3);
  assert.equal(result.phase.combat.player.hp, 3);
  assert.equal(result.maxHp, start.maxHp);
});

void test('training retries use current node choices while retaining equipment and the starting deck', () => {
  const initial = equipItem(createCharacter(), 'amulet', 'travelers-amulet');
  const character = applyCharacterAction(
    initial,
    chooseNode('endurance', 1, true)
  );
  const game = createSandboxWith(
    3,
    ['squire'],
    true,
    'all',
    character.traits,
    character.equipment,
    character.traitNodes
  );
  assert.deepEqual(game.player.traitNodes, character.traitNodes);
  const refunded = applyCharacterAction(
    character,
    chooseNode('endurance', 1, false)
  );
  const retry = retryTrainingFight(game, refunded);
  assert.deepEqual(
    combatantBonuses(retry.player),
    characterBonuses(refunded.traits, refunded.equipment, refunded.traitNodes)
  );
  assert.deepEqual(retry.hand, game.hand);
  assert.equal(retry.player.equipment?.amulet, 'travelers-amulet');
});
