import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocateTrait,
  setTraitRank,
  setTraitPathRank,
  setTraitNode,
  traitNodeArms,
  armRewardWeight,
  normalizeTraitNodeIds,
  traitNodeBlocker,
  traitNodeIds,
  traitNodeGains,
  syncCharacterCombat,
  awardCharacterVictory,
  characterBonuses,
  createCharacter,
  equipItem,
  restoreCharacter,
  traitPointsAvailable,
  TRAITS,
  LEVEL_CAP,
  type CharacterState,
} from './character.ts';
import { createSandbox } from './sandbox.ts';
import { createRun, isRunAction, replayRun, runReducer } from './run.ts';
import { PLAYER_HP_CAP, PLAYER_MAX_HP } from './rules.ts';

void test('70 levels fund 210 points while each of six traits caps at 64', () => {
  let character = createCharacter();
  assert.equal(traitPointsAvailable(character), 3);
  while (character.level < LEVEL_CAP) character = awardCharacterVictory(character);
  assert.equal(traitPointsAvailable(character), 210);
  assert.equal(awardCharacterVictory(character), character);
  for (const trait of TRAITS) {
    for (let i = 0; i < 65; i++) character = allocateTrait(character, trait);
    assert.ok(character.traits[trait] <= 64);
  }
  assert.equal(traitPointsAvailable(character), 0);
  assert.deepEqual(Object.values(character.traits), [64, 64, 64, 18, 0, 0]);
});

void test('full traits keep every endpoint after the 1-1-1-5 arm payout', () => {
  const max = createCharacter().traits;
  for (const t of TRAITS) max[t] = 64;
  assert.deepEqual(characterBonuses(max), {
    maxHp: PLAYER_HP_CAP,
    shieldPercent: 100,
    meleePercent: 100,
    meleeFlat: 30,
    rangePercent: 100,
    rangeFlat: 30,
    accuracyPercent: 50,
    magicPercent: 100,
    magicFlat: 30,
    afflictionFlat: 10,
    afflictionDamagePercent: 60,
    healingPercent: 50,
    shieldFlat: 30,
    startingEnergy: 6,
    retainEnergy: 11,
    cardsPerTurn: 5,
    maxEnergy: 20,
  });
});

void test('equipment validates slot ownership and restores independently of point allocation', () => {
  let c: CharacterState = createCharacter({bossWins: 1, rareSlots: []});
  const ring = c.inventory.find((item) => item.slot === 'ring')!;
  assert.equal(equipItem(c, 'amulet', ring.id), c);
  c = equipItem(c, 'ring', ring.id);
  assert.deepEqual(restoreCharacter(JSON.parse(JSON.stringify(c))), c);
  assert.equal(equipItem(c, 'ring', null).equipment.rings[0], null);
  assert.deepEqual(
    restoreCharacter({ ...c, traits: { ...c.traits, vigor: 5 } }),
    createCharacter()
  );
});

void test('ranked allocation and equipment can be replayed and validated', () => {
  const start = createRun('character-test');
  const action = { type: 'allocateTrait', trait: 'vigor' } as const;
  assert.ok(isRunAction(action));
  assert.equal(isRunAction({ ...action, trait: 'unknown' }), false);
  const state = runReducer(start, action);
  assert.equal(state.maxHp, characterBonuses({ vigor: 1 }).maxHp);
  assert.deepEqual(replayRun('character-test', [action]), state);
});

void test('five rings equip independently and legacy single-ring saves restore to slot one', () => {
  let c = createCharacter({bossWins: 5, rareSlots: [6,7,8,9,10]});
  const owned = Array.from({ length: 10 }, (_, i) => ({
    id: 'ring-' + i,
    name: 'Ring ' + i,
    slot: 'ring' as const,
  }));
  c.inventory.push(...owned);
  for (const [i, item] of owned.entries()) c = equipItem(c, 'ring', item.id, i);
  assert.deepEqual(
    c.equipment.rings,
    owned.slice(0,5).map((item) => item.id)
  );
  assert.deepEqual(restoreCharacter(c), c);
  const oldSave = restoreCharacter({...c,equipment:{...c.equipment,rings:owned.map(item=>item.id)}});
  assert.deepEqual(oldSave.equipment.rings,c.equipment.rings);
  assert.deepEqual(oldSave.inventory,c.inventory);
  assert.equal(equipItem(c,'ring','iron-ring',5),c);
  c = equipItem(c, 'ring', owned[0]!.id, 4);
  assert.equal(c.equipment.rings[0], null);
  assert.equal(c.equipment.rings[4], owned[0]!.id);
  const legacy = restoreCharacter({
    ...c,
    equipment: { ring: 'iron-ring', amulet: 'travelers-amulet' },
  });
  assert.deepEqual(legacy.equipment.rings, [
    'iron-ring',
    ...Array(4).fill(null),
  ]);
  assert.equal(legacy.equipment.amulet, 'travelers-amulet');
  const action = {
    type: 'equipItem',
    slot: 'ring',
    itemId: 'iron-ring',
    ringIndex: 4,
  } as const;
  assert.ok(isRunAction(action));
  assert.equal(
    replayRun('rings', [action], c.ringProgress).character.equipment.rings[4],
    'iron-ring'
  );
  assert.equal(isRunAction({ ...action, ringIndex: 10 }), false);
});

void test('direct rank edits refund points and reject invalid targets atomically', () => {
  const c = createCharacter();
  const action = { type: 'setTraitRank', trait: 'strength', rank: 3 } as const;
  assert.ok(isRunAction(action));
  for (const rank of [-1, 65, 1.5, NaN, Infinity]) {
    assert.equal(isRunAction({ ...action, rank }), false);
    assert.equal(setTraitRank(c, 'strength', rank), c);
  }
  const spent = setTraitRank(c, 'strength', 3);
  assert.equal(traitPointsAvailable(spent), 0);
  assert.equal(setTraitRank(spent, 'vigor', 1), spent);
  assert.equal(setTraitRank(spent, 'strength', 3), spent);
  const partial = setTraitRank(spent, 'strength', 1);
  assert.equal(traitPointsAvailable(partial), 2);
  assert.equal(setTraitRank(partial, 'dexterity', 2).traits.dexterity, 2);
  assert.deepEqual(replayRun('spiral', [action]).character, spent);
});

void test('refunding and rebuying Vigor cannot heal in camp or combat', () => {
  const start = createRun('vigor-refund');
  const buy = { type: 'setTraitRank', trait: 'vigor', rank: 3 } as const;
  const refund = { ...buy, rank: 0 };
  const trained = runReducer(start, buy);
  const wounded = { ...trained, hp: 1 };
  const lowered = runReducer(wounded, refund);
  assert.equal(lowered.hp, 1);
  const rebought = runReducer(lowered, buy);
  assert.equal(rebought.hp, 1);
  assert.equal(rebought.maxHp, trained.maxHp);
  assert.deepEqual(restoreCharacter(lowered.character), lowered.character);
  const opening = createSandbox(7);
  const battle = { ...trained, phase: { kind: 'combat' as const, stop: { kind: 'horde' as const, heroIds: [] },
    combat: { ...opening, player: { ...opening.player, traits: trained.character.traits, maxHp: trained.maxHp, hp: 1 } } } };
  const back = runReducer(runReducer(battle, refund), buy);
  assert.ok(back.phase.kind === 'combat');
  assert.equal(back.phase.combat.player.hp, 1);
  assert.equal(back.phase.combat.player.maxHp, trained.maxHp);
});

void test('lower Endurance clamps active and reserved energy; dead players stay dead', () => {
  const high = setTraitRank({ ...createCharacter(), level: LEVEL_CAP }, 'endurance', 64);
  const combat = createSandbox(8, undefined, high.traits);
  const low = setTraitRank(high, 'endurance', 0);
  const changed = syncCharacterCombat({ ...combat, energy: 20, reserve: 12, player: { ...combat.player, hp: 0 } }, low);
  assert.equal(changed.energy, 10);
  assert.equal(changed.reserve, 1);
  assert.equal(changed.player.hp, 0);
});
void test('all six traits grow across 64 ranks without changing equipment bonuses', () => {
  const character = createCharacter();
  const equipped = { ...character.equipment, amulet: 'travelers-amulet' };
  for (const trait of TRAITS) {
    let previous = characterBonuses({}, equipped);
    for (let rank = 1; rank <= 64; rank++) {
      const current = characterBonuses({ [trait]: rank }, equipped);
      for (const key of Object.keys(current) as (keyof typeof current)[])
        assert.ok(Number.isInteger(current[key]) && current[key] >= previous[key], trait + ' rank ' + rank + ' ' + key);
      assert.equal(current.cardsPerTurn, 6);
      assert.equal(current.retainEnergy, 1 + characterBonuses({ [trait]: rank }).retainEnergy);
      previous = current;
    }
  }
  // Full traits keep the totals of the original schedule.
  assert.equal(characterBonuses({ scorn: 64 }).afflictionFlat, 10);
  assert.equal(characterBonuses({ endurance: 64 }).startingEnergy, 6);
  assert.equal(characterBonuses().afflictionDamagePercent, 0);
});
void test('old level-100 saves retain equipment and unlocks and fit 300 spent points into 210', () => {
  const original = createCharacter({ bossWins: 3, rareSlots: [8] });
  const saved = {
    ...equipItem(original, 'amulet', 'travelers-amulet'),
    level: 100,
    traits: { vigor: 64, strength: 64, dexterity: 64, intelligence: 64, scorn: 44, endurance: 0 },
  };
  const restored = restoreCharacter(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.level, 70);
  assert.equal(restored.xp, 0);
  assert.deepEqual(restored.traits,
    { vigor: 45, strength: 45, dexterity: 45, intelligence: 45, scorn: 30, endurance: 0 });
  assert.equal(traitPointsAvailable(restored), 0);
  assert.equal(restored.highestVigor, 64);
  assert.deepEqual(restored.equipment, saved.equipment);
  assert.deepEqual(restored.inventory, saved.inventory);
  assert.deepEqual(restored.ringProgress, saved.ringProgress);
  assert.deepEqual(restoreCharacter(restored), restored);
});

void test('legacy builds within budget keep every rank and drop obsolete XP at the new cap', () => {
  const character = { ...createCharacter(), level: 85, xp: 37 };
  character.traits.dexterity = 64;
  character.traits.scorn = 30;
  const saved = equipItem(character, 'ring', null);
  const restored = restoreCharacter(JSON.parse(JSON.stringify(saved)), true);
  assert.equal(restored.level, 70);
  assert.equal(restored.xp, 0);
  assert.deepEqual(restored.traits, saved.traits);
  assert.deepEqual(restored.equipment, saved.equipment);
  assert.equal(traitPointsAvailable(restored), 116);
  assert.equal(restoreCharacter({ ...saved, level: 70, xp: 200 }).xp, 0);
});
void test('all three curls preserve each of the 64 original node gains', () => {
  const fresh = { ...createCharacter(), level: LEVEL_CAP };
  for (const trait of TRAITS) {
    let character = fresh;
    const arms = Object.values(traitNodeArms(trait));
    assert.ok(arms.every(arm => arm.length === 21));
    const sequence = [1, ...Array.from({ length: 21 }, (_, step) => arms.map(arm => arm[step]!)).flat()];
    assert.equal(new Set(sequence).size, 64);
    for (const node of sequence) {
      const before = characterBonuses(character.traits, undefined, character.traitNodes);
      character = setTraitNode(character, trait, node, true);
      const after = characterBonuses(character.traits, undefined, character.traitNodes);
      const gain = traitNodeGains(trait, node);
      const original = characterBonuses({ [trait]: node });
      const previous = characterBonuses({ [trait]: node - 1 });
      for (const key of Object.keys(after) as (keyof typeof after)[]) {
        assert.equal(after[key] - before[key], gain[key] ?? 0);
        assert.equal(after[key] - before[key], original[key] - previous[key]);
      }
      assert.equal(setTraitNode(character, trait, node, true), character);
    }
    assert.deepEqual(characterBonuses(character.traits, undefined, character.traitNodes), characterBonuses({ [trait]: 64 }));
    const refund = setTraitNode(character, trait, 64, false);
    assert.equal(traitNodeIds(refund.traits, refund.traitNodes, trait).length, 63);
    assert.equal(traitNodeIds(refund.traits, refund.traitNodes, trait).includes(64), false);
    assert.equal(setTraitNode(refund, trait, 64, false), refund);
    assert.equal(traitPointsAvailable(refund), 147);
  }
});

void test('sparse board saves round-trip and reject invalid or overbudget purchases', () => {
  let character = createCharacter();
  const { left, mixed } = traitNodeArms('vigor');
  for (const id of [1, left[0]!, mixed[0]!]) character = setTraitNode(character, 'vigor', id, true);
  assert.deepEqual(traitNodeIds(character.traits, character.traitNodes, 'vigor'), [1, left[0]!, mixed[0]!].sort((a,b) => a-b));
  assert.equal(setTraitNode(character, 'strength', 1, true), character);
  for (const id of [-1,0,65,1.2,NaN]) assert.equal(setTraitNode(character, 'vigor', id, false), character);
  assert.deepEqual(restoreCharacter(JSON.parse(JSON.stringify(character))), character);
  const legacy = restoreCharacter({ ...createCharacter(), traits: { ...createCharacter().traits, vigor: 3 } });
  assert.deepEqual(traitNodeIds(legacy.traits, legacy.traitNodes, 'vigor'), normalizeTraitNodeIds('vigor', [1,2,3]));
});

void test('prior specialist saves and actions preserve counts and favor their original stats', () => {
  const base = { ...createCharacter(), level: LEVEL_CAP };
  const old = { ...base, traits: { ...base.traits, vigor: 12 }, traitPaths: { vigor: { left: 0, hybrid: 2, right: 10 } } };
  const migrated = restoreCharacter(old);
  assert.equal(migrated.traits.vigor, 12);
  assert.equal(migrated.traitPaths, undefined);
  const ids = traitNodeIds(migrated.traits, migrated.traitNodes, 'vigor');
  assert.deepEqual(ids, normalizeTraitNodeIds('vigor', ids));
  assert.ok(traitNodeArms('vigor').right.filter(id => ids.includes(id)).length >= 8);
  const replay = setTraitPathRank(setTraitPathRank(base, 'vigor', 'hybrid', 2), 'vigor', 'right', 10);
  assert.deepEqual(replay.traitNodes, migrated.traitNodes);
  assert.deepEqual(restoreCharacter(migrated), migrated);
});

void test('refunding a chosen HP node and purchasing it again does not heal wounds', () => {
  const start = createRun('nonlinear-hp');
  const purchase = { type: 'setTraitNode' as const, trait: 'vigor' as const, node: 1, owned: true };
  const trained = runReducer(start, purchase);
  const max = PLAYER_MAX_HP + (traitNodeGains('vigor', 1).maxHp ?? 0);
  assert.equal(trained.maxHp, max);
  const refunded = runReducer({ ...trained, hp: 1 }, { ...purchase, owned: false });
  assert.equal(refunded.maxHp, PLAYER_MAX_HP);
  const rebuilt = runReducer(refunded, purchase);
  assert.equal(rebuilt.hp, 1);
  assert.equal(rebuilt.maxHp, max);
});
void test('buy the shared starter, progress curls independently, and refund only their tips', () => {
  const fresh = { ...createCharacter(), level: LEVEL_CAP };
  const { left, right, mixed } = traitNodeArms('vigor');
  assert.equal(setTraitNode(fresh, 'vigor', left[0]!, true), fresh);
  let character = setTraitNode(fresh, 'vigor', 1, true);
  for (const id of [left[0]!, right[0]!, right[1]!, mixed[0]!])
    character = setTraitNode(character, 'vigor', id, true);
  assert.equal(character.traits.vigor, 5);
  assert.equal(setTraitNode(character, 'vigor', 1, false), character);
  assert.deepEqual(traitNodeBlocker(character, 'vigor', right[0]!, false), { kind: 'dependent', node: right[1] });
  assert.deepEqual(traitNodeBlocker(character, 'vigor', mixed[2]!, true), { kind: 'prerequisite', node: mixed[1] });
  for (const id of [mixed[0]!, right[1]!, left[0]!, right[0]!, 1])
    character = setTraitNode(character, 'vigor', id, false);
  assert.equal(character.traits.vigor, 0);
  assert.equal(traitPointsAvailable(character), 210);
});

void test('sparse saves receive the shared star and contiguous rewards on the invested curls', () => {
  const base = createCharacter();
  const { left, right } = traitNodeArms('vigor');
  const original = [left[6]!, left[19]!, right[11]!];
  const old = { ...base, traits: { ...base.traits, vigor: 3 }, traitNodes: { vigor: original } };
  const migrated = restoreCharacter(old);
  assert.deepEqual(traitNodeIds(migrated.traits, migrated.traitNodes, 'vigor'),
    [1, left[0]!, right[0]!].sort((a,b) => a-b));
  assert.equal(traitPointsAvailable(migrated), 0);
  assert.deepEqual(restoreCharacter(migrated), migrated);
  assert.deepEqual(normalizeTraitNodeIds('vigor', [64]), [1]);
});
void test('all 18 curls pay small circles, bigger 5x circles, and the biggest at the tip', () => {
  const base = characterBonuses();
  // WHOLE-NUMBER LIMIT: an arm paid only in +1% units can't make a 5x circle
  // bigger without raising its total, so only most arms must step up.
  const stepped: string[] = [];
  for (const trait of TRAITS) {
    const full = characterBonuses({ [trait]: 64 });
    for (const [arm, ids] of Object.entries(traitNodeArms(trait))) {
      const shares = ids.map(id => Object.entries(traitNodeGains(trait, id)).reduce((sum, [key, delta]) =>
        sum + delta / (full[key as keyof typeof full] - base[key as keyof typeof base]), 0));
      const label = trait + '/' + arm;
      const weights = ids.map((_, i) => armRewardWeight(i, ids.length));
      const average = (weight: number) => {
        const picked = shares.filter((_, i) => weights[i] === weight);
        return picked.reduce((a, b) => a + b, 0) / picked.length;
      };
      assert.ok(shares.every(share => share > 0), label + ' empty circle');
      assert.ok(average(5) >= average(1), label + ' steps');
      if (average(5) > average(1)) stepped.push(label);
      assert.ok(shares.slice(0, -1).every(share => share <= shares.at(-1)!), label + ' tip');
    }
  }
  assert.ok(stepped.length >= 17, 'stepped arms ' + stepped.join(' '));
});

void test('arm reward weights run 1-1-1-5 and end on a 10x tip', () => {
  const weights = Array.from({ length: 21 }, (_, i) => armRewardWeight(i, 21));
  assert.deepEqual(weights.slice(0, 8), [1, 1, 1, 5, 1, 1, 1, 5]);
  assert.equal(weights.at(-1), 10);
});
