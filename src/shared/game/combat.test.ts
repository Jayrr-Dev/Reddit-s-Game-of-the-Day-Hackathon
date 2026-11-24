// ===================================================================
// COMBAT ENGINE TESTS
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceMelee } from './battlefield.ts';
import { ALL_CARD_IDS, getCard, type CardId } from './cards.ts';
import { canMove, move, movementCost } from './movement.ts';
import {
  attackDamage,
  endOfTurnUpkeep,
  burnTick,
  frostThaw,
  hexBurn,
  hexBurnAmount,
  castProtection,
  cleanseOne,
  takeDamage,
  takeHit,
  addStatus,
  createCombatant,
  expireGuard,
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
  wouldFell,
  autoTargets,
  playDamageFactor,
  plannedHeroMoves,
} from './combat.ts';
import { describeCard, describeHeroIntent } from './describe.ts';
import { getHero } from './heroes.ts';
import {
  BACK_STEP_COST,
  CARDS_PER_TURN,
  ENERGY_PER_TURN,
  STATUS_IS_AFFLICTION,
} from './rules.ts';
import type { CombatState, HeroUnit } from './types.ts';

// --- FIXTURES ---
/** A fight's lines once settled: melee heroes have stepped up. */
const settled = (state: CombatState): CombatState => ({
  ...state,
  heroes: advanceMelee(state.heroes),
});

/** A fight against one Squire (in the front row) with the given deck. */
const fightWith = (deck: CardId[]): CombatState =>
  settled(
    startCombat({
      hp: 60,
      maxHp: 60,
      deck,
      heroIds: ['squire'],
      might: 1,
      seed: 7,
    })
  );

/** Puts a specific card in hand slot 0 so a test controls what is played. */
const withHand = (state: CombatState, hand: CardId[]): CombatState => ({
  ...state,
  hand,
});

// --- COMBATANT RULES ---
void test('guard absorbs damage before HP', () => {
  const guarded = { ...createCombatant(20, 20), guard: 5 };
  const hit = takeDamage(guarded, 8);
  assert.equal(hit.guard, 0);
  assert.equal(hit.hp, 17);
});

void test('wrath adds to each hit and weaken cuts damage by 25%', () => {
  const base = createCombatant(10, 10);
  assert.equal(
    attackDamage(6, { ...base, statuses: { ...NO_STATUSES, wrath: 2 } }),
    8
  );
  assert.equal(
    attackDamage(8, { ...base, statuses: { ...NO_STATUSES, weaken: 1 } }),
    6
  );
});

void test('poison deals its damage at end of turn and then drops by one', () => {
  const poisoned = {
    ...createCombatant(20, 20),
    statuses: { ...NO_STATUSES, poison: 3, weaken: 1 },
  };
  const after = endOfTurnUpkeep(poisoned);
  assert.equal(after.hp, 17);
  assert.deepEqual(after.statuses, { ...NO_STATUSES, poison: 2 });
});

void test('hex is left alone by end-of-turn upkeep', () => {
  const hexed = {
    ...createCombatant(20, 20),
    statuses: { ...NO_STATUSES, hex: 3 },
  };
  const after = endOfTurnUpkeep(hexed);
  assert.equal(after.hp, 20);
  assert.equal(after.statuses.hex, 3);
});

/** The HP a unit loses to Hex on each of its next `turns` turns. */
const hexLosses = (hex: number, turns: number): number[] => {
  let unit = {
    ...createCombatant(100, 100),
    statuses: { ...NO_STATUSES, hex },
  };
  const losses: number[] = [];
  for (let turn = 0; turn < turns; turn += 1) {
    const next = hexBurn(unit);
    losses.push(unit.hp - next.hp);
    unit = next;
  }
  return losses;
};

void test('an even hex does not burn, it grows by 1', () => {
  for (const hex of [2, 4, 10]) {
    const after = hexBurn({
      ...createCombatant(100, 100),
      statuses: { ...NO_STATUSES, hex },
    });
    assert.equal(after.hp, 100, `hex ${hex} waits`);
    assert.equal(after.statuses.hex, hex + 1, `hex ${hex} grows`);
  }
});

void test('an odd hex burns for its value, then loses a third (rounded up)', () => {
  const thirds: [number, number][] = [
    [1, 0],
    [5, 3],
    [7, 4],
    [9, 6],
    [11, 7],
  ];
  for (const [hex, left] of thirds) {
    const burned = hexBurn({
      ...createCombatant(100, 100),
      statuses: { ...NO_STATUSES, hex },
    });
    assert.equal(burned.hp, 100 - hex, `hex ${hex} burns ${hex}`);
    assert.equal(burned.statuses.hex, left, `hex ${hex} drops to ${left}`);
  }
});

void test('an odd hex ending in 3 burns double, then clears', () => {
  for (const [hex, loss] of [
    [3, 6],
    [13, 26],
    [23, 46],
  ] as const) {
    assert.equal(hexBurnAmount(hex), loss, `hex ${hex} reads ${loss}`);
    const burned = hexBurn({
      ...createCombatant(100, 100),
      statuses: { ...NO_STATUSES, hex },
    });
    assert.equal(burned.hp, 100 - loss, `hex ${hex} burns ${loss}`);
    assert.equal(burned.statuses.hex, 0, `hex ${hex} clears`);
  }
  assert.equal(hexBurnAmount(4), 0, 'even hex never burns');
  assert.equal(hexBurnAmount(11), 11, 'only a last digit of 3 doubles');
});

void test('hex runs its course: 7 burns, grows, burns, then doubles out', () => {
  // 7 -> 4 (grows) -> 5 -> 3 (doubled) -> gone.
  assert.deepEqual(hexLosses(7, 5), [7, 0, 5, 6, 0]);
  assert.deepEqual(hexLosses(4, 4), [0, 5, 6, 0]);
});

void test('a hexed hero burns before it acts, and its hex drops', () => {
  // Settled, so the Squire stands in the front row and can swing.
  const fight = settled(
    startCombat({
      hp: 999,
      maxHp: 999,
      deck: ['backhand'],
      heroIds: ['squire'],
      might: 1,
      seed: 7,
    })
  );
  const hexed: CombatState = {
    ...fight,
    heroes: fight.heroes.map((unit) => ({
      ...unit,
      statuses: { ...unit.statuses, hex: 3 },
    })),
  };
  const steps = endTurnSteps(hexed);
  const squireUid = hexed.heroes[0]!.uid;
  const burnIndex = steps.findIndex(
    (step) =>
      step.actorUid === null &&
      step.state.heroes[0]?.hp === hexed.heroes[0]!.hp - 6 // Hex 3 ends in 3: doubled, then cleared
  );
  const actIndex = steps.findIndex((step) => step.actorUid === squireUid);
  assert.ok(burnIndex > 0 && burnIndex < actIndex, 'burns, then acts');
  assert.equal(steps.at(-1)!.state.heroes[0]!.statuses.hex, 0);
});

void test('a hexed villain burns at the start of its turn', () => {
  const fight = startCombat({
    hp: 50,
    maxHp: 50,
    deck: ['backhand'],
    heroIds: ['bard'],
    might: 1,
    seed: 7,
  });
  const hexed: CombatState = {
    ...fight,
    player: { ...fight.player, statuses: { ...NO_STATUSES, hex: 5 } },
  };
  const next = endTurn(hexed);
  // The Bard only sings (Wrath to allies): the 5 lost is the hex.
  assert.equal(next.player.hp, 45);
  // 5 loses a third, rounded up: 3 left.
  assert.equal(next.player.statuses.hex, 3);
  // 3 ends in 3: it burns double (6, at least; the heroes may hit too), then clears.
  const after = endTurn(next);
  assert.ok(next.player.hp - after.player.hp >= 6);
  assert.equal(after.player.statuses.hex, 0);
});

void test('burn deals its value, then halves (a half rounds down)', () => {
  const halves: [number, number][] = [
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [9, 4],
  ];
  for (const [burn, after] of halves) {
    const burning = burnTick({
      ...createCombatant(20, 20),
      statuses: { ...NO_STATUSES, burn },
    });
    assert.equal(burning.hp, 20 - burn);
    assert.equal(burning.statuses.burn, after, `burn ${burn}`);
  }
});

void test('a burning hero burns right after its action', () => {
  const fight = settled(
    startCombat({
      hp: 999,
      maxHp: 999,
      deck: ['backhand'],
      heroIds: ['squire'],
      might: 1,
      seed: 7,
    })
  );
  const burning: CombatState = {
    ...fight,
    heroes: fight.heroes.map((unit) => ({
      ...unit,
      statuses: { ...unit.statuses, burn: 3 },
    })),
  };
  const squire = burning.heroes[0]!;
  const acted = endTurnSteps(burning).find(
    (step) => step.actorUid === squire.uid
  )!;
  const after = acted.state.heroes.find((unit) => unit.uid === squire.uid)!;
  assert.equal(after.hp, squire.hp - 3);
  assert.equal(after.statuses.burn, 1);
});

void test('a burning villain burns at the end of its turn', () => {
  const fight = startCombat({
    hp: 50,
    maxHp: 50,
    deck: ['backhand'],
    heroIds: ['bard'],
    might: 1,
    seed: 7,
  });
  const burning: CombatState = {
    ...fight,
    player: { ...fight.player, statuses: { ...NO_STATUSES, burn: 4 } },
  };
  const [ended] = endTurnSteps(burning);
  assert.equal(ended!.state.player.hp, 46);
  assert.equal(ended!.state.player.statuses.burn, 2);
});

void test('frost takes 1 per stack off every hit, never below 0', () => {
  const frozen = (frost: number) => ({
    ...createCombatant(20, 20),
    statuses: { ...NO_STATUSES, frost },
  });
  assert.equal(attackDamage(8, frozen(3)), 5);
  assert.equal(attackDamage(8, frozen(10)), 0);
});

void test('frost halves (rounding down) after the unit acts', () => {
  const thawed = frostThaw({
    ...createCombatant(20, 20),
    statuses: { ...NO_STATUSES, frost: 5 },
  });
  assert.equal(thawed.statuses.frost, 2);
  assert.equal(thawed.hp, 20);
});

void test('a frosted hero hits softer, then its frost halves', () => {
  const fight = settled(
    startCombat({
      hp: 999,
      maxHp: 999,
      deck: ['backhand'],
      heroIds: ['squire'],
      might: 1,
      seed: 7,
    })
  );
  const frosted: CombatState = {
    ...fight,
    heroes: fight.heroes.map((unit) => ({
      ...unit,
      statuses: { ...unit.statuses, frost: 3 },
    })),
  };
  const squire = frosted.heroes[0]!;
  const acted = endTurnSteps(frosted).find(
    (step) => step.actorUid === squire.uid
  )!;
  // Swing is 5 damage: Frost 3 takes it to 2.
  assert.equal(frosted.player.hp - acted.state.player.hp, 2);
  const after = acted.state.heroes.find((unit) => unit.uid === squire.uid)!;
  assert.equal(after.statuses.frost, 1);
});

void test('bleed bursts and clears on the 3rd non-magic hit in a row', () => {
  const bleeding = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, bleed: 6 },
  };
  const once = takeHit(bleeding, 2, 'melee');
  const twice = takeHit(once, 2, 'range');
  assert.equal(twice.bleedHits, 2);
  assert.equal(twice.hp, 46);
  const thrice = takeHit(twice, 2, 'melee');
  // Three hits of 2, then the bleed (6).
  assert.equal(thrice.hp, 38);
  assert.equal(thrice.statuses.bleed, 0);
  assert.equal(thrice.bleedHits ?? 0, 0);
});

void test('new bleed stacks on top and keeps the count', () => {
  const bleeding = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, bleed: 2 },
  };
  const hit = takeHit(takeHit(bleeding, 1, 'melee'), 1, 'melee');
  const stacked = addStatus(hit, 'bleed', 4);
  assert.equal(stacked.bleedHits, 2);
  const burst = takeHit(stacked, 1, 'melee');
  assert.equal(burst.hp, 50 - 3 - 6);
});

void test('a magic hit resets the bleed count', () => {
  const bleeding = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, bleed: 6 },
  };
  const hit = takeHit(takeHit(bleeding, 1, 'melee'), 1, 'melee');
  const zapped = takeHit(hit, 1, 'magic');
  assert.equal(zapped.bleedHits ?? 0, 0);
  const again = takeHit(takeHit(zapped, 1, 'melee'), 1, 'melee');
  assert.equal(again.statuses.bleed, 6, 'only 2 in a row since the zap');
});

void test('a hero bleeding out from the villain: three melee hits', () => {
  const fight = settled(
    startCombat({
      hp: 999,
      maxHp: 999,
      deck: ['backhand'],
      heroIds: ['shieldmaiden'],
      might: 1,
      seed: 7,
    })
  );
  const bleeding: CombatState = {
    ...fight,
    hand: ['backhand', 'backhand', 'backhand'],
    energy: 3,
    heroes: fight.heroes.map((unit) => ({
      ...unit,
      hp: 99,
      maxHp: 99,
      statuses: { ...unit.statuses, bleed: 5 },
    })),
  };
  const uid = bleeding.heroes[0]!.uid;
  const after = [0, 0, 0].reduce((state) => playCard(state, 0, uid), bleeding);
  const maiden = after.heroes.find((unit) => unit.uid === uid)!;
  assert.equal(maiden.hp, 99 - 6 * 3 - 5);
  assert.equal(maiden.statuses.bleed, 0);
});

void test("the Rogue's Poisoned Dart poisons instead of hexing", () => {
  const dart = getHero('rogue').moves[0]!;
  assert.equal(dart.name, 'Poisoned Dart');
  assert.ok(dart.effects.some((effect) => effect.kind === 'poison'));
  assert.ok(!dart.effects.some((effect) => effect.kind === 'hex'));
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

void test('wouldFell counts Guard and leaves the state untouched', () => {
  const base = withHand(fightWith(['backhand']), ['backhand']);
  /** The squire (uid 1) set to `hp` HP behind `guard` Guard. */
  const squireAt = (hp: number, guard: number): CombatState => ({
    ...base,
    heroes: base.heroes.map((unit) =>
      unit.uid === 1 ? { ...unit, hp, guard } : unit
    ),
  });
  assert.equal(wouldFell(squireAt(14, 0), 0, [1], 1), false);
  assert.equal(wouldFell(squireAt(6, 0), 0, [1], 1), true);
  assert.equal(wouldFell(squireAt(6, 1), 0, [1], 1), false);
});

void test('autoTargets kills the toughest it can, else hits the weakest', () => {
  const base = withHand(
    settled(
      startCombat({
        hp: 60,
        maxHp: 60,
        deck: ['backhand'],
        heroIds: ['squire', 'squire', 'squire'],
        might: 1,
        seed: 7,
      })
    ),
    ['backhand']
  );
  /** The field with each hero (by board order) set to these HP. */
  const withHp = (...hps: number[]): CombatState => ({
    ...base,
    heroes: base.heroes.map((unit, index) => ({
      ...unit,
      hp: hps[index] ?? unit.hp,
      guard: 0,
    })),
  });
  const uidAt = (state: CombatState, index: number) =>
    state.heroes[index]?.uid ?? -1;
  // Backhand deals 6: no kill possible -> lowest HP.
  const noKill = withHp(14, 9, 12);
  assert.deepEqual(autoTargets(noKill, 0), [uidAt(noKill, 1)]);
  // Two killable (5 and 6 HP) -> the tougher of them, 6.
  const kills = withHp(5, 14, 6);
  assert.deepEqual(autoTargets(kills, 0), [uidAt(kills, 2)]);
});

void test('autoTargets fills a Target N card with distinct best heroes', () => {
  const base = withHand(
    settled(
      startCombat({
        hp: 60,
        maxHp: 60,
        deck: ['reapingCuts'],
        heroIds: ['squire', 'squire', 'squire'],
        might: 1,
        seed: 7,
      })
    ),
    ['reapingCuts']
  );
  const state: CombatState = {
    ...base,
    heroes: base.heroes.map((unit, index) => ({
      ...unit,
      hp: [14, 3, 9][index] ?? unit.hp,
      guard: 0,
    })),
  };
  const uids = state.heroes.map((unit) => unit.uid);
  // Reaping Cuts (4 each, Target 2): kills the 3 HP one, then the
  // weakest of the rest (9 HP).
  assert.deepEqual(autoTargets(state, 0), [uids[1], uids[2]]);
  // A pick already made stays first; the fill skips it.
  assert.deepEqual(autoTargets(state, 0, [uids[0] ?? -1]), [uids[0], uids[1]]);
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
  const state = settled(
    startCombat({
      hp: 60,
      maxHp: 60,
      deck: ['backhand'],
      heroIds: ['squire', 'rogue', 'archer', 'shieldmaiden'],
      might: 1,
      seed: 3,
    })
  );
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

void test('Might, Surge and Hone each power up only their own card type', () => {
  assert.equal(damageWith('backhand', { might: 2 }), 8);
  assert.equal(damageWith('backhand', { surge: 2, hone: 2 }), 6);
  // The Squire is in front: no long-range bonus.
  assert.equal(damageWith('spiteBolt', { hone: 3 }), 9);
  assert.equal(damageWith('hexfire', { surge: 1 }), 7);
  // A curse lays Hex and strikes for nothing, buffed or not.
  assert.equal(damageWith('mourningCurse', { might: 5, surge: 5 }), 0);
});

void test('a type buff adds to every hit of a multi-hit card', () => {
  assert.equal(damageWith('flurry', { might: 1 }), 12);
});

void test('Reinforce adds to every Guard a card gives', () => {
  const start = withHand(fightWith(['backhand']), ['darkCloak']);
  const guarded = {
    ...start,
    player: { ...start.player, statuses: { ...NO_STATUSES, reinforce: 2 } },
  };
  assert.equal(playCard(guarded, 0, -1).player.guard, 7);
});

void test('Protection cuts each hit by its tier: I 25%, II 50%, III 75%', () => {
  const shielded = (tier: number) => ({
    ...createCombatant(100, 100),
    statuses: { ...NO_STATUSES, protection: tier },
  });
  const lost = (tier: number) => 100 - takeHit(shielded(tier), 20, 'melee').hp;
  assert.deepEqual([0, 1, 2, 3].map(lost), [20, 15, 10, 5]);
});

void test('Protection tiers up when cast on back-to-back turns, to III at most', () => {
  let unit = createCombatant(100, 100);
  const tiers: number[] = [];
  for (let turn = 0; turn < 4; turn += 1) {
    unit = endOfTurnUpkeep(castProtection(unit));
    tiers.push(unit.statuses.protection);
  }
  assert.deepEqual(tiers, [1, 2, 3, 3]);
});

void test('Protection drops at the end of a turn it was not recast', () => {
  const cast = endOfTurnUpkeep(castProtection(createCombatant(100, 100)));
  assert.equal(cast.statuses.protection, 1, 'it covers the heroes turn');
  assert.equal(endOfTurnUpkeep(cast).statuses.protection, 0, 'then lapses');
  // Recast after a lapse starts over at I.
  const again = endOfTurnUpkeep(castProtection(endOfTurnUpkeep(cast)));
  assert.equal(again.statuses.protection, 1);
});

void test('the Bulwark card casts Protection', () => {
  const start = withHand(fightWith(['backhand']), ['bulwark']);
  const after = playCard(start, 0, -1);
  assert.equal(after.player.statuses.protection, 1);
  // Still up through the heroes' turn.
  assert.equal(endTurn(after).player.statuses.protection, 1);
});

void test('afflictions are the harmful statuses, flagged in one table', () => {
  const afflictions = Object.entries(STATUS_IS_AFFLICTION)
    .filter(([, isAffliction]) => isAffliction)
    .map(([id]) => id)
    .sort();
  assert.deepEqual(afflictions, [
    'bleed',
    'burn',
    'enfeeble',
    'frost',
    'hex',
    'poison',
    'weaken',
  ]);
});

void test('cleanse removes one random affliction and leaves buffs alone', () => {
  const sick = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, poison: 3, burn: 2, wrath: 2 },
  };
  const [cleansed, rng] = cleanseOne(sick, 7);
  const left = [cleansed.statuses.poison, cleansed.statuses.burn];
  assert.equal(left.filter((value) => value === 0).length, 1, 'one is gone');
  assert.ok(left.includes(3) || left.includes(2), 'the other stays');
  assert.equal(cleansed.statuses.wrath, 2);
  assert.notEqual(rng, 7, 'it drew from the rng');
  // Same rng, same pick: replays stay deterministic.
  assert.deepEqual(cleanseOne(sick, 7), [cleansed, rng]);
  // Nothing to cleanse: untouched, and the rng is not used.
  const healthy = createCombatant(50, 50);
  assert.deepEqual(cleanseOne(healthy, 7), [healthy, 7]);
});

void test('the Purge card cleanses one of your afflictions', () => {
  const start = withHand(fightWith(['backhand']), ['purge']);
  const sick = {
    ...start,
    player: {
      ...start.player,
      statuses: { ...NO_STATUSES, hex: 4, weaken: 2 },
    },
  };
  const after = playCard(sick, 0, -1).player.statuses;
  assert.equal([after.hex, after.weaken].filter((v) => v === 0).length, 1);
});

void test("the Priest's Mend also cleanses an affliction from each ally", () => {
  const fight = startCombat({
    hp: 999,
    maxHp: 999,
    deck: ['backhand'],
    heroIds: ['priest'],
    might: 1,
    seed: 7,
  });
  const weakenedHero: CombatState = {
    ...fight,
    heroes: fight.heroes.map((unit) => ({
      ...unit,
      moveIndex: 1,
      statuses: { ...unit.statuses, weaken: 2 },
    })),
  };
  // Without the cleanse, Weaken 2 would only tick down to 1.
  assert.equal(endTurn(weakenedHero).heroes[0]?.statuses.weaken, 0);
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
  // One beat per hit, then the real play.
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.at(-1), playCard(start, 0, squireUid(start)));
  const hpOf = (state: CombatState) => state.heroes[0]?.hp ?? 0;
  assert.ok(hpOf(steps[0] as CombatState) > hpOf(steps[1] as CombatState));
});

void test('a volley keeps landing on a hero it fells, for the numbers', () => {
  const fresh = withHand(fightWith(['backhand']), ['flurry']);
  // A 1 HP Squire: Flurry's first hit fells it; hits 2 and 3 still land.
  const start = {
    ...fresh,
    heroes: fresh.heroes.map((unit) => ({ ...unit, hp: 1, guard: 0 })),
  };
  const steps = playCardSteps(start, 0, squireUid(start));
  const taken = steps
    .slice(0, 3)
    .map((state) => state.heroes[0]?.damageTaken ?? 0);
  assert.deepEqual(taken, [3, 6, 9]);
  // HP never goes below 0, and the hero leaves once the card resolves.
  assert.equal(steps[2]?.heroes[0]?.hp, 0);
  assert.equal(steps.at(-1)?.heroes.length, 0);
  assert.equal(steps.at(-1)?.slain, 1);
});

// --- TARGET N ---
/** A fight against a Squire (front) and an Archer (back). */
const squireAndArcher = (hand: CardId[]): CombatState =>
  withHand(
    settled(
      startCombat({
        hp: 60,
        maxHp: 60,
        deck: ['backhand'],
        heroIds: ['squire', 'archer'],
        might: 1,
        seed: 7,
      })
    ),
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
  // The Squire (front) takes 3; the back-row Archer takes 130% of 3
  // (rounded to 4) twice.
  assert.deepEqual(hpLost(start, after), [3, 8]);
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
  assert.equal(steps.length, 3);
  assert.deepEqual(steps.at(-1), playCard(start, 0, picks[0] ?? -1, picks));
});

// --- PREVIEW MATCHES THE ENGINE ---
void test('card text damage always equals the damage the engine deals', () => {
  const buffSets: Partial<typeof NO_STATUSES>[] = [
    {},
    { wrath: 2 },
    { might: 3 },
    { surge: 2, hone: 1 },
    { momentum: 1, might: 1 },
    { wrath: 1, weaken: 1 },
  ];
  const cards: CardId[] = ['backhand', 'spiteBolt', 'hexfire', 'twinDaggers'];
  for (const buffs of buffSets) {
    for (const cardId of cards) {
      const start = withHand(fightWith(['backhand']), [cardId]);
      const player = {
        ...start.player,
        statuses: { ...NO_STATUSES, ...buffs },
      };
      // Aimed at the Squire, so Weaken counts too.
      const squire = start.heroes[0];
      const [line = ''] = describeCard(cardId, player, squire);
      const perHit = Number(/Deal (\d+)/.exec(line)?.[1]);
      const hits = Number(/(\d+) times/.exec(line)?.[1] ?? 1);
      // The Squire stands in front, so no Range card gets its bonus.
      const dealt = damageWith(cardId, buffs);
      assert.equal(dealt, Math.min(perHit * hits, 14), `${cardId} ${line}`);
    }
  }
});

// --- DISTANCE ---
/** The hero with `heroId` in a state. */
const heroNamed = (state: CombatState, heroId: string) =>
  state.heroes.find((unit) => unit.heroId === heroId);

void test('a melee hero in the back row skips to a move it can make, or advances', () => {
  const fresh = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['backhand'],
    heroIds: ['squire', 'shieldmaiden'],
    might: 1,
    seed: 3,
  });
  const maiden = heroNamed(fresh, 'shieldmaiden');
  const squire = heroNamed(fresh, 'squire');
  assert.equal(maiden?.row, 'back');
  // Brace (Guard only) works from the back; the Squire's moves all melee.
  assert.equal(
    describeHeroIntent(maiden as HeroUnit, fresh.heroes).name,
    'Brace'
  );
  assert.equal(
    describeHeroIntent(squire as HeroUnit, fresh.heroes).name,
    'Advance'
  );
  const after = endTurn(fresh);
  assert.equal(after.player.hp, 60);
  assert.equal(heroNamed(after, 'squire')?.row, 'front');
  assert.equal(heroNamed(after, 'squire')?.moveIndex, 0);
});

void test('a Range hero shoots harder from the back, and plainly (still Range) up close', () => {
  const fresh = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['backhand'],
    heroIds: ['archer'],
    might: 1,
    seed: 3,
  });
  const archer = heroNamed(fresh, 'archer') as HeroUnit;
  // Volley 2x3 from the back: Range at 130% (2.6 rounds to 3).
  const [shot] = describeHeroIntent(archer, fresh.heroes).intents;
  assert.deepEqual([shot?.kind, shot?.text], ['range', '3×3']);
  // Up close it loses the bonus but is still a Range shot.
  const upClose = { ...archer, row: 'front' as const };
  const [strike] = describeHeroIntent(upClose, fresh.heroes).intents;
  assert.deepEqual([strike?.kind, strike?.text], ['range', '2×3']);
});

void test('Back Step pushes a full front row back for 1 energy', () => {
  const state = fightWith(['backhand']);
  assert.ok(canMove(state, 'backStep'));
  const after = move(state, 'backStep');
  assert.ok(after.heroes.every((unit) => unit.row === 'back'));
  assert.equal(after.energy, state.energy - BACK_STEP_COST);
  assert.equal(canMove(after, 'backStep'), false);
  // The Squire can't reach, so the heroes' turn costs no HP; it steps up.
  const next = endTurn(after);
  assert.equal(next.player.hp, 60);
  assert.equal(next.heroes[0]?.row, 'front');
});

void test('card text shows the damage for the aimed-at hero', () => {
  const start = squireAndArcher(['blackArrow']);
  const player = {
    ...start.player,
    statuses: { ...start.player.statuses, wrath: 2, hone: 3 },
  };
  const archer = heroNamed(start, 'archer') as HeroUnit;
  // (7 + 2 + 3) x 1.3 long range = 15.6, rounded to 16.
  assert.match(describeCard('blackArrow', player, archer).join(' '), /16/);
  // Not aimed: the bonus that needs a target is left out.
  assert.match(describeCard('blackArrow', player).join(' '), /12/);
});

void test('card text in hand shows only buffs; Weaken waits for an aim', () => {
  const start = squireAndArcher(['spiteBolt']);
  const player = {
    ...start.player,
    statuses: { ...start.player.statuses, wrath: 2, hone: 2, weaken: 1 },
  };
  const squire = heroNamed(start, 'squire') as HeroUnit;
  // In hand: 6 + 2 Wrath + 2 Hone, Weaken left out.
  assert.match(describeCard('spiteBolt', player).join(' '), /Deal 10 /);
  // Aimed at the Squire (in front, no long-range bonus): 10 x 0.75.
  assert.match(describeCard('spiteBolt', player, squire).join(' '), /Deal 7 /);
});

// --- CARD TEXT FITS ---
/**
 * A card face holds about three short lines. Keep cards to two or three
 * effects so the text never spills off the card.
 */
const MAX_CARD_LINES = 3;
const MAX_CARD_TEXT_CHARS = 48;

void test('every card text fits on the card face', () => {
  for (const cardId of ALL_CARD_IDS) {
    const lines = describeCard(cardId);
    const text = lines.join(' ');
    assert.ok(lines.length <= MAX_CARD_LINES, `${cardId}: ${text}`);
    assert.ok(text.length <= MAX_CARD_TEXT_CHARS, `${cardId}: ${text}`);
  }
});

void test('every movement shares one streak; a full turn off resets it', () => {
  const start = { ...fightWith(['backhand']), energy: 9 };
  assert.equal(movementCost(start, 'backStep'), 1);
  // Back Step, Charge, Back Step in one turn: a different move still
  // counts toward the streak, so they cost 1, 2 and 3.
  const mixed = move(move(move(start, 'backStep'), 'charge'), 'backStep');
  assert.equal(mixed.energy, 9 - 6);
  assert.equal(mixed.lastMovement?.streak, 3);
  // Every kind of movement prices off the same streak.
  assert.equal(movementCost(mixed, 'charge'), 4);
  assert.equal(movementCost(mixed, 'backStep'), 4);
  // The next turn doesn't reset it: the turn it was made never counts.
  assert.equal(movementCost({ ...mixed, turn: mixed.turn + 1 }, 'charge'), 4);
  // Only after one full turn without moving does it go back to base.
  assert.equal(movementCost({ ...mixed, turn: mixed.turn + 2 }, 'charge'), 1);
});

void test('playDamageFactor combines Charge, Weaken and the target bonus', () => {
  const [squire] = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['backhand'],
    heroIds: ['squire'],
    might: 1,
    seed: 3,
  }).heroes;
  assert.ok(squire);
  const villain = createCombatant(60, 60);
  const charged = {
    ...villain,
    statuses: { ...villain.statuses, momentum: 1 },
  };
  const melee = getCard('backhand');
  assert.equal(playDamageFactor(villain, squire, melee), 1);
  assert.equal(playDamageFactor(charged, squire, melee), 1.5);
  const chargedAndWeakened = {
    ...charged,
    statuses: { ...charged.statuses, weaken: 1 },
  };
  assert.equal(playDamageFactor(chargedAndWeakened, squire, melee), 1.13);
});

/** A fresh fight against the Holy Dragon alone. */
const dragonFight = (): CombatState =>
  startCombat({
    hp: 999,
    maxHp: 999,
    deck: ['soulLance'],
    heroIds: ['holyDragon'],
    might: 1,
    seed: 4,
  });

void test('the dragon makes two moves a turn: Unc summons, then breathes', () => {
  const start = dragonFight();
  const [dragon] = start.heroes;
  assert.ok(dragon);
  assert.deepEqual(
    plannedHeroMoves(dragon, start.heroes).map((planned) => planned.move.name),
    ['Call the Host', 'Holy Breath']
  );
  assert.equal(
    describeHeroIntent(dragon, start.heroes).name,
    'Call the Host, then Holy Breath'
  );
  const steps = endTurnSteps(start);
  const dragonSteps = steps.filter((step) => step.actorUid === dragon.uid);
  assert.equal(dragonSteps.length, 2);
  const after = steps.at(-1)?.state;
  assert.equal(after?.heroes.find((u) => u.uid === dragon.uid)?.moveIndex, 2);
  // The summons joined this turn, so only Holy Breath (8 x 2) landed.
  assert.equal(after?.player.hp, 999 - 16);
});

void test('a summon fills the flanks of the summoner with fresh uids', () => {
  const after = endTurn(dragonFight());
  const angels = after.heroes.filter((unit) => unit.heroId === 'angelArcher');
  assert.deepEqual(
    angels.map((unit) => [unit.row, unit.col, unit.uid, unit.summonerUid]),
    [
      ['back', 0, 2, 1],
      ['back', 2, 3, 1],
    ]
  );
  assert.equal(after.nextUid, 4);
});

void test('a Biblical Angel heals the hurt dragon on its second move', () => {
  const angel = getHero('angelArcher');
  assert.equal(angel.name, 'Biblical Angel');
  const healMove = angel.moves[1]!;
  const healing = healMove.effects.find((effect) => effect.kind === 'heal');
  assert.ok(healing && healing.kind === 'heal' && healing.who === 'allies');
  // Summon the angels, then hurt the dragon and line the angels up to heal.
  const summoned = endTurn(dragonFight());
  const dragon = summoned.heroes.find((unit) => unit.heroId === 'holyDragon')!;
  const hurt: CombatState = {
    ...summoned,
    heroes: summoned.heroes.map((unit) =>
      unit.heroId === 'holyDragon'
        ? { ...unit, hp: unit.maxHp - 100 }
        : unit.heroId === 'angelArcher'
          ? { ...unit, moveIndex: 1 }
          : unit
    ),
  };
  const angelUids = hurt.heroes
    .filter((unit) => unit.heroId === 'angelArcher')
    .map((unit) => unit.uid);
  const healed = endTurnSteps(hurt)
    .filter((step) => angelUids.includes(step.actorUid ?? -1))
    .at(-1)!.state;
  const after = healed.heroes.find((unit) => unit.uid === dragon.uid)!;
  assert.ok(after.hp > dragon.maxHp - 100, 'the angels heal the dragon');
});

void test('a summoner with full flanks skips its summon', () => {
  const summoned = endTurn(dragonFight());
  const dragon = summoned.heroes.find((unit) => unit.heroId === 'holyDragon')!;
  const backToCall = { ...dragon, moveIndex: 0 };
  assert.deepEqual(
    plannedHeroMoves(backToCall, summoned.heroes).map((p) => p.move.name),
    ['Holy Breath', 'Sanctuary Wings']
  );
});

void test('a revive brings fallen allies back to their spots', () => {
  const summoned = endTurn(dragonFight());
  const angel = summoned.heroes.find((unit) => unit.heroId === 'angelArcher')!;
  const oneDown: CombatState = {
    ...summoned,
    heroes: summoned.heroes.map((unit) =>
      unit.uid === angel.uid ? { ...unit, hp: 1, guard: 0 } : unit
    ),
    hand: ['soulLance'],
    energy: 3,
  };
  const felled = playCard(oneDown, 0, angel.uid);
  assert.equal(felled.fallen.length, 1);
  const dragon = felled.heroes.find((unit) => unit.heroId === 'holyDragon')!;
  // Halo of Judgment is 4th in the cycle: revive, then the blast.
  const judging = {
    ...felled,
    heroes: felled.heroes.map((unit) =>
      unit.uid === dragon.uid ? { ...unit, moveIndex: 3 } : unit
    ),
  };
  const after = endTurn(judging);
  const back = after.heroes.find(
    (unit) => unit.heroId === 'angelArcher' && unit.col === angel.col
  );
  assert.ok(back);
  assert.equal(back.hp, back.maxHp);
  assert.equal(back.summonerUid, dragon.uid);
  assert.ok(back.uid > angel.uid);
  assert.equal(after.fallen.length, 0);
});

void test('summoned heroes fall with their summoner', () => {
  const summoned = endTurn(dragonFight());
  const dragon = summoned.heroes.find((unit) => unit.heroId === 'holyDragon')!;
  const nearlyDead: CombatState = {
    ...summoned,
    heroes: summoned.heroes.map((unit) =>
      unit.uid === dragon.uid ? { ...unit, hp: 1, guard: 0 } : unit
    ),
    hand: ['soulLance'],
    energy: 3,
  };
  const after = playCard(nearlyDead, 0, dragon.uid);
  assert.equal(after.heroes.length, 0);
  assert.equal(after.slain, 3);
  assert.equal(combatOutcome(after), 'won');
});

// --- GRAND GRIFFON (ALOFT AND THE TWO-TURN DIVE) ---
/** A fresh fight against Grand Griffon Rio alone. */
const griffonFight = (): CombatState =>
  startCombat({
    hp: 999,
    maxHp: 999,
    deck: ['backhand', 'soulLance', 'cleave', 'weakeningGaze'],
    heroIds: ['grandGriffon'],
    might: 1,
    seed: 4,
  });

/** The griffon after its first move (Triple Slice). */
const griffonSlashed = (): CombatState => endTurn(griffonFight());

/** The griffon a turn later: it took off (Heavenly Drive). */
const griffonAloft = (): CombatState => endTurn(griffonSlashed());

/** The griffon in a state's field. */
const griffonOf = (state: CombatState): HeroUnit =>
  state.heroes.find((unit) => unit.heroId === 'grandGriffon')!;

void test('Heavenly Drive flies the griffon up and ends its turn', () => {
  const start = griffonFight();
  assert.deepEqual(
    plannedHeroMoves(griffonOf(start), start.heroes).map((p) => p.move.name),
    ['Triple Slice']
  );
  const slashed = griffonSlashed();
  const after = griffonAloft();
  const griffon = griffonOf(after);
  assert.equal(griffon.statuses.aloft, 1);
  assert.equal(griffon.moveIndex, 2);
  // Taking off deals no damage.
  assert.equal(after.player.hp, slashed.player.hp);
  assert.equal(describeHeroIntent(griffon, after.heroes).name, 'Heavenly Dive');
});

void test('a hero Aloft cannot be aimed at or hit by any card', () => {
  const aloft = griffonAloft();
  const griffon = griffonOf(aloft);
  const handOf = (cardId: CardId) => ({
    ...aloft,
    hand: [cardId],
    energy: 3,
  });
  for (const cardId of ['backhand', 'soulLance', 'cleave'] as const) {
    assert.equal(canPlayCard(handOf(cardId), 0), false, cardId);
    assert.deepEqual(autoTargets(handOf(cardId), 0), [], cardId);
  }
  // A card that also helps the villain still plays, but misses it.
  const gazed = playCard(handOf('weakeningGaze'), 0, griffon.uid);
  assert.equal(griffonOf(gazed).statuses.weaken, 0);
  assert.equal(griffonOf(gazed).hp, griffon.hp);
});

void test('a turn later the griffon dives down with one crushing blow', () => {
  const aloft = griffonAloft();
  const steps = endTurnSteps(aloft);
  const griffonSteps = steps.filter(
    (step) => step.actorUid === griffonOf(aloft).uid
  );
  assert.deepEqual(
    griffonSteps.map((step) => step.move?.name),
    ['Heavenly Dive']
  );
  assert.equal(griffonSteps[0]?.move?.isSignature, true);
  const landed = steps.at(-1)!.state;
  assert.equal(griffonOf(landed).statuses.aloft, 0);
  assert.equal(aloft.player.hp - landed.player.hp, 34);
  // Back on the ground it can be hit again.
  assert.equal(canPlayCard({ ...landed, hand: ['backhand'] }, 0), true);
});

void test('a move with two effects is one action; only the dragon has two', () => {
  const fight = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['backhand'],
    heroIds: ['holt', 'holyDragon'],
    might: 1,
    seed: 3,
  });
  const holt = fight.heroes.find((unit) => unit.heroId === 'holt')!;
  const rally = describeHeroIntent(holt, fight.heroes);
  // Rally: Wrath and Guard, two chips but one move.
  assert.equal(rally.moves.length, 1);
  assert.equal(rally.moves[0]?.intents.length, 2);
  const dragon = fight.heroes.find((unit) => unit.heroId === 'holyDragon')!;
  assert.equal(describeHeroIntent(dragon, fight.heroes).moves.length, 2);
});

// --- HOLD ---
void test('a Hold card stays in hand at end of turn; the rest are discarded', () => {
  // A deck of Dark Cloaks, so the new hand never redraws the Backhand.
  const deck: CardId[] = Array.from({ length: 12 }, () => 'darkCloak');
  const state = withHand(fightWith(deck), ['ruin', 'backhand']);
  const after = endTurn(state);
  assert.ok(after.hand.includes('ruin'));
  assert.ok(!after.discardPile.includes('ruin'));
  assert.ok(after.discardPile.includes('backhand'));
});

void test('Hold is a card trait, printed on the card', () => {
  assert.ok(getCard('ruin').keywords.includes('hold'));
  assert.ok(!getCard('backhand').keywords.includes('hold'));
  assert.ok(describeCard('ruin').includes('Hold.'));
});

// --- AFFLICTION CARDS ---
void test('Venom Dart poisons, Frost Bolt frosts and Serrated Slash bleeds', () => {
  const cases: readonly [CardId, 'poison' | 'frost' | 'bleed'][] = [
    ['venomDart', 'poison'],
    ['frostBolt', 'frost'],
    ['serratedSlash', 'bleed'],
  ];
  cases.forEach(([cardId, status]) => {
    const state = withHand(fightWith([]), [cardId]);
    const uid = state.heroes[0]?.uid ?? -1;
    const after = playCard(state, 0, uid);
    const hero = after.heroes.find((unit) => unit.uid === uid);
    assert.ok((hero?.statuses[status] ?? 0) > 0, `${cardId} applies ${status}`);
  });
});

// --- IMBUE ---
/** A fight whose deck is all Dark Cloaks, so redraws never muddle a test. */
const cloakFight = (hand: CardId[]): CombatState =>
  withHand(
    fightWith(Array.from({ length: 12 }, (): CardId => 'darkCloak')),
    hand
  );

void test('Imbue Hold for this turn keeps a card one end of turn only', () => {
  const state = cloakFight(['holdFast', 'backhand']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  assert.deepEqual(imbued.hand, ['backhand']);
  const turn2 = endTurn(imbued);
  assert.ok(
    turn2.hand.includes('backhand'),
    'held through the first end of turn'
  );
  const turn3 = endTurn(turn2);
  assert.ok(!turn3.hand.includes('backhand'), 'the turn imbue has worn off');
});

void test('Imbue Hold for this battle keeps a card every end of turn', () => {
  const state = cloakFight(['soulbind', 'backhand']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  const later = endTurn(endTurn(endTurn(imbued)));
  assert.ok(later.hand.includes('backhand'));
});

void test('an imbued effect lands when the card is played', () => {
  const state = cloakFight(['venomCoat', 'backhand']);
  const uid = state.heroes[0]?.uid ?? -1;
  const imbued = playCard(state, 0, uid, undefined, 1);
  const after = playCard(imbued, 0, uid);
  const hero = after.heroes.find((unit) => unit.uid === uid);
  assert.equal(hero?.statuses.poison, 3);
  assert.equal(hero?.hp, 14 - 6);
});

void test('a battle imbue follows its card through the discard and back', () => {
  const state = cloakFight(['venomCoat', 'backhand']);
  const uid = state.heroes[0]?.uid ?? -1;
  const played = playCard(playCard(state, 0, uid, undefined, 1), 0, uid);
  assert.equal(played.stowedImbues.length, 1);
  // Only the Backhand left to draw: it comes back still imbued.
  const redrawn = endTurn({
    ...played,
    drawPile: ['backhand'],
    discardPile: [],
  });
  const slot = redrawn.hand.indexOf('backhand');
  assert.ok(slot >= 0);
  assert.equal(redrawn.handImbues[slot]?.length, 1);
  assert.equal(redrawn.stowedImbues.length, 0);
});

void test('a hero effect can only be imbued onto a card that aims at a hero', () => {
  const state = cloakFight(['venomCoat', 'darkCloak']);
  assert.equal(playCard(state, 0, 0, undefined, 1), state);
  assert.equal(canPlayCard(cloakFight(['venomCoat', 'darkCloak']), 0), false);
  assert.equal(canPlayCard(cloakFight(['wardRune', 'darkCloak']), 0), true);
});

void test('an Imbue card needs another card in hand to imbue', () => {
  assert.equal(canPlayCard(cloakFight(['holdFast']), 0), false);
  // Without a card to imbue (or imbuing itself) the play is refused.
  const state = cloakFight(['holdFast', 'backhand']);
  assert.equal(playCard(state, 0, 0), state);
  assert.equal(playCard(state, 0, 0, undefined, 0), state);
});

void test('Imbue cards say what they grant and for how long', () => {
  assert.deepEqual(describeCard('holdFast'), ['Imbue Hold this turn.']);
  assert.deepEqual(describeCard('venomCoat'), [
    'Imbue this battle: Apply 3 Poison.',
  ]);
});

// --- ENFEEBLE ---
void test('Enfeeble cuts the damage a unit deals by its tier, like Protection', () => {
  const unit = createCombatant(50, 50);
  const tiers = [1, 2, 3].map((tier) => ({
    ...unit,
    statuses: { ...unit.statuses, enfeeble: tier },
  }));
  assert.deepEqual(
    tiers.map((enfeebled) => attackDamage(20, enfeebled)),
    [15, 10, 5]
  );
});

void test('Enfeeble climbs a tier when reapplied the next turn, up to III', () => {
  const deck: CardId[] = Array.from({ length: 12 }, () => 'sapStrength');
  let state = fightWith(deck);
  const uid = state.heroes[0]?.uid ?? -1;
  const tierOf = (current: CombatState) =>
    current.heroes.find((unit) => unit.uid === uid)?.statuses.enfeeble;
  for (const expected of [1, 2, 3, 3]) {
    state = endTurn(playCard(withHand(state, ['sapStrength']), 0, uid));
    assert.equal(tierOf(state), expected);
  }
});

void test('Enfeeble lasts one turn: it lapses unless reapplied', () => {
  const deck: CardId[] = Array.from({ length: 12 }, () => 'darkCloak');
  const state = withHand(fightWith(deck), ['sapStrength']);
  const uid = state.heroes[0]?.uid ?? -1;
  const once = endTurn(playCard(state, 0, uid));
  const tierOf = (current: CombatState) =>
    current.heroes.find((unit) => unit.uid === uid)?.statuses.enfeeble;
  assert.equal(tierOf(once), 1, 'on for the heroes turn after it lands');
  assert.equal(tierOf(endTurn(once)), 0, 'gone when not reapplied');
});

void test('Enfeeble is an affliction Cleanse can remove', () => {
  assert.equal(STATUS_IS_AFFLICTION.enfeeble, true);
});

// --- PIERCING ---
/** A Squire up front in lane 0, archers behind it (lane 0) and beside (lane 1). */
const laneFight = (hand: CardId[]): CombatState => {
  const state = startCombat({
    hp: 60,
    maxHp: 60,
    deck: Array.from({ length: 12 }, (): CardId => 'darkCloak'),
    heroIds: ['squire', 'archer', 'archer'],
    might: 1,
    seed: 7,
  });
  const spots = [
    { row: 'front', col: 0 },
    { row: 'back', col: 0 },
    { row: 'back', col: 1 },
  ] as const;
  return {
    ...state,
    hand,
    energy: 5,
    heroes: state.heroes.map((unit, index) => ({
      ...unit,
      ...(spots[index] ?? spots[0]),
    })),
  };
};

void test('a Piercing hit also strikes the hero directly behind, in the same lane', () => {
  const state = laneFight(['impale']);
  const front = state.heroes[0]?.uid ?? -1;
  const after = playCard(state, 0, front);
  const [frontLost, behindLost, besideLost] = hpLost(state, after);
  assert.ok((frontLost ?? 0) > 0);
  assert.equal(behindLost, frontLost, 'full damage to the hero behind');
  assert.equal(besideLost, 0, 'the next lane is left alone');
});

void test('a Piercing hit on the back row has nobody behind to hit', () => {
  const state = laneFight(['blackArrow']);
  const back = state.heroes[2]?.uid ?? -1;
  const after = playCard(state, 0, back);
  const [frontLost, behindLost] = hpLost(state, after);
  assert.equal(frontLost, 0);
  assert.equal(behindLost, 0);
});

void test('a plain hit does not pierce', () => {
  const state = laneFight(['cruelSlash']);
  const after = playCard(state, 0, state.heroes[0]?.uid ?? -1);
  assert.equal(hpLost(state, after)[1], 0);
});

void test('Piercing can be imbued onto a single-target attack, for the turn', () => {
  const state = laneFight(['barbedTip', 'cruelSlash', 'darkCloak']);
  assert.equal(
    playCard(state, 0, 0, undefined, 2),
    state,
    'not onto a Guard card'
  );
  const imbued = playCard(state, 0, 0, undefined, 1);
  const after = playCard(imbued, 0, state.heroes[0]?.uid ?? -1);
  assert.ok((hpLost(state, after)[1] ?? 0) > 0);
  assert.ok(describeCard('impale').includes('Piercing.'));
});

// --- CURSES ---
void test('Curse cards never deal direct damage, and all of them lay Hex', () => {
  const curses = ALL_CARD_IDS.filter((id) => getCard(id).type === 'curse');
  for (const id of curses)
    assert.ok(
      !getCard(id).effects.some((effect) => effect.kind === 'damage'),
      `${id} deals direct damage`
    );
  // ...and every one of them lays Hex.
  for (const id of curses)
    assert.ok(
      getCard(id).effects.some((effect) => effect.kind === 'hex'),
      `${id} lays no Hex`
    );
});

void test('status effects in a row share one line of card text', () => {
  assert.deepEqual(describeCard('sneer'), [
    'Gain 5 Guard.',
    'Apply 1 Weaken and 1 Hex.',
  ]);
});

// --- BRACE ---
void test('Brace keeps Guard from expiring, one turn per stack', () => {
  const unit = { ...createCombatant(30, 30), guard: 10 };
  const braced = { ...unit, statuses: { ...unit.statuses, brace: 2 } };
  const turn1 = expireGuard(braced);
  assert.equal(turn1.guard, 10);
  assert.equal(turn1.statuses.brace, 1);
  const turn2 = expireGuard(turn1);
  assert.equal(turn2.guard, 10);
  assert.equal(turn2.statuses.brace, 0);
  assert.equal(expireGuard(turn2).guard, 0, 'Brace spent: Guard expires');
  assert.equal(expireGuard(unit).guard, 0, 'no Brace: Guard expires');
});

void test('Stand Firm guards and braces; Brace can be imbued', () => {
  const state = cloakFight(['standFirm']);
  const after = playCard(state, 0, 0);
  assert.equal(after.player.statuses.brace, 1);
  assert.ok(after.player.guard > 0);
  assert.equal(STATUS_IS_AFFLICTION.brace, false);
});
