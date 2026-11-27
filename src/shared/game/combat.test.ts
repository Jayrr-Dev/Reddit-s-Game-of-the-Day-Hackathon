// ===================================================================
// COMBAT ENGINE TESTS
// ===================================================================

import { appendCombatHistory, recordEffects } from './combatHistory.ts';
import { test } from 'node:test';
import { createCharacter, IRON_RING_RESERVE, type Traits } from './character.ts';
import assert from 'node:assert/strict';
import { advanceHeroes, targetRuleOf } from './battlefield.ts';
import { ALL_CARD_IDS, getCard, type CardId } from './cards.ts';
import { canMove, hasPlayLeft, move, moveFree, movementCost } from './movement.ts';
import {
  attackDamage,
  endOfTurnUpkeep,
  burnTick,
  poisonTick,
  bleedOnAttack,
  afterAction,
  burstShock,
  frostThaw,
  hexBurn,
  hexBurnAmount,
  cleanseOne,
  dispelBuffs,
  disruptStatus,
  takeDamage,
  takeHit,
  addStatus,
  createCombatant,
  castProtection,
  castCardProtection,
  tickStackingBuffs,
  protectedAmount,
  expireGuard,
  NO_STATUSES,
} from './combatant.ts';
import {
  canPlayCard,
  canPlayCardOnSelf,
  SELF_TARGET_UID,
  combatOutcome,
  endTurn,
  endTurnSteps,
  finishPlayerTurn,
  heroTurnOrder,
  playCard,
  playCardSteps,
  startPlayerTurn,
  startCombat,
  targetsFor,
  soleTargetFor,
  wouldFell,
  autoTargets,
  playDamageFactor,
  plannedHeroMoves,
  plannedHeroMove,
  dodgeChanceAgainst,
  aimHitChance,
  aimCritChance,
  shotHitChance,
} from './combat.ts';
import {
  describeCard,
  describeCardEffect,
  describeHeroIntent,
  describeImbueGift,
  KEYWORD_INFO,
} from './describe.ts';
import { cardImbuesAt, imbueSlotsFor } from './imbue.ts';
import {
  ALOFT_EVASION,
  BANE_AFFLICTIONS,
  BLEED_BITE_FACTOR,
  RAMPAGE_MOMENTUM_FACTOR,
  EXHAUST_USES,
} from './rules.ts';
import { foldPerHitAfflictions, getHero } from './heroes.ts';
import {
  BACK_STEP_COST,
  CARDS_PER_TURN,
  ENERGY_PER_TURN,
  MAX_IMBUES_PER_CARD,
  SHOCK_BURST_FACTOR,
  SHOCK_HITS,
  STATUS_IS_AFFLICTION,
} from './rules.ts';
import type { CombatState, HeroUnit, ImbueGift } from './types.ts';

// --- FIXTURES ---
/** A fight's lines once settled: melee heroes have stepped up. */
const settled = (state: CombatState): CombatState => ({
  ...state,
  heroes: advanceHeroes(state.heroes),
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

void test('Decimate spends one less energy per kill this turn, down to zero', () => {
  const battle = fightWith(['decimate']);
  const card = getCard('decimate');
  assert.equal(card.edge, 'blunt');
  assert.equal(card.rarity, 'legendary');
  assert.ok(card.keywords.includes('rampage'));
  assert.deepEqual(describeCard('decimate'), ['Damage 50', '-1 cost per kill this turn', 'Rampage']);
  for (const slain of [0, 1, 2, 3, 4]) {
    const cost = Math.max(0, 3 - slain);
    const state = { ...battle, slain: slain + 5, killsThisTurn: slain, energy: cost };
    if (cost > 0) assert.equal(canPlayCard({ ...state, energy: cost - 1 }, 0), false);
    assert.equal(canPlayCard(state, 0), true);
    const after = playCard(state, 0, state.heroes[0]!.uid);
    assert.equal(after.energy, 0);
    assert.equal(after.slain, state.slain + 1);
    assert.equal(after.killsThisTurn, slain + 1);
    assert.equal(startPlayerTurn(after).killsThisTurn, 0);
  }
});

// --- COMBATANT RULES ---
void test('movement cards follow formation rules and Jump grants Momentum', () => {
  const front = withHand(fightWith(['retreat']), ['retreat']);
  const retreat = playCard(front, 0, 0);
  assert.deepEqual(retreat.heroes, move(front, 'backStep').heroes);
  assert.equal(retreat.energy, front.energy - 1);
  assert.equal(retreat.lastMovement?.move, 'backStep');

  const chargeReady = withHand(retreat, ['chargeForward']);
  const charged = playCard(chargeReady, 0, 0);
  assert.deepEqual(charged.heroes, move(chargeReady, 'charge').heroes);
  assert.equal(charged.player.statuses.momentum, 1);
  assert.equal(charged.lastMovement?.streak, 2);
  assert.equal(canPlayCard(withHand(charged, ['chargeForward']), 0), false);

  const jumpReady = withHand(front, ['jump']);
  const jumped = playCard(jumpReady, 0, 0);
  assert.deepEqual(jumped.heroes, jumpReady.heroes);
  assert.equal(jumped.energy, jumpReady.energy - 1);
  assert.equal(jumped.player.statuses.momentum, 1);
  assert.equal(jumped.lastMovement, jumpReady.lastMovement);
});

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

void test('poison ticks before an action, then drops by one', () => {
  const poisoned = {
    ...createCombatant(20, 20),
    statuses: { ...NO_STATUSES, poison: 3, weaken: 1 },
  };
  const ticked = poisonTick(poisoned);
  assert.equal(ticked.hp, 17);
  assert.equal(ticked.statuses.poison, 2);
  // Upkeep (after the turn) leaves it alone now.
  const upkept = endOfTurnUpkeep(poisoned);
  assert.equal(upkept.hp, 20);
  assert.deepEqual(upkept.statuses, { ...NO_STATUSES, poison: 3 });
});

void test('a poisoned hero loses HP right before it acts; the villain at turn start', () => {
  const start = squireAndArcher([]);
  const squire = start.heroes[0]!;
  const state: CombatState = {
    ...start,
    player: {
      ...start.player,
      statuses: { ...start.player.statuses, poison: 4 },
    },
    heroes: start.heroes.map((unit) =>
      unit.uid === squire.uid
        ? { ...unit, statuses: { ...unit.statuses, poison: 3 } }
        : unit
    ),
  };
  const steps = endTurnSteps(state);
  const moveAt = steps.findIndex((step) => step.actorUid === squire.uid);
  const before = steps[moveAt - 1]!.state.heroes.find(
    (unit) => unit.uid === squire.uid
  )!;
  assert.equal(before.hp, squire.hp - 3, 'its poison beat comes first');
  assert.equal(before.statuses.poison, 2);
  // The villain's poison ticks when its next turn starts.
  assert.equal(steps[0]!.state.player.statuses.poison, 4, 'not at its end');
  assert.equal(steps.at(-1)!.state.player.statuses.poison, 3);
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
    assert.equal(burned.hp, 100 - hex * 2, `hex ${hex} burns ${hex * 2}`);
    assert.equal(burned.statuses.hex, left, `hex ${hex} drops to ${left}`);
  }
});

void test('an odd hex ending in 3 burns triple, then clears', () => {
  for (const [hex, loss] of [
    [3, 9],
    [13, 39],
    [23, 69],
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
  assert.equal(hexBurnAmount(11), 22, 'other odd hex burns double');
});

void test('hex runs its course: 7 burns, grows, burns, then triples out', () => {
  // 7 (x2) -> 4 (grows) -> 5 (x2) -> 3 (x3) -> gone.
  assert.deepEqual(hexLosses(7, 5), [14, 0, 10, 9, 0]);
  assert.deepEqual(hexLosses(4, 4), [0, 10, 9, 0]);
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
      step.state.heroes[0]?.hp === hexed.heroes[0]!.hp - 9 // Hex 3 ends in 3: tripled, then cleared
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
  // The Bard only sings (Wrath to allies): the 10 lost is the hex (odd: double).
  assert.equal(next.player.hp, 40);
  // 5 loses a third, rounded up: 3 left.
  assert.equal(next.player.statuses.hex, 3);
  // 3 ends in 3: it burns triple (9, at least; the heroes may hit too), then clears.
  const after = endTurn(next);
  assert.ok(next.player.hp - after.player.hp >= 9);
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

void test('shock bursts and clears on the 4th hit', () => {
  assert.equal(SHOCK_HITS, 4);
  const shocked = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, shock: 6 },
  };
  const thrice = takeHit(
    takeHit(takeHit(shocked, 2, 'melee'), 2, 'range'),
    2,
    'melee'
  );
  assert.equal(thrice.shockHits, 3);
  assert.equal(thrice.hp, 44);
  const burst = takeHit(thrice, 2, 'melee');
  // Four hits of 2, then the shock (6) doubled.
  assert.equal(SHOCK_BURST_FACTOR, 2);
  assert.equal(burst.hp, 42 - 6 * SHOCK_BURST_FACTOR);
  assert.equal(burst.statuses.shock, 0);
  assert.equal(burst.shockHits ?? 0, 0);
});

void test('Shock fades by 1 after each action, like Bleed', () => {
  const shocked = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, shock: 3 },
  };
  const once = afterAction(shocked);
  assert.equal(once.statuses.shock, 2);
  assert.equal(once.hp, 50, 'fading deals no damage');
  assert.equal(afterAction(afterAction(once)).statuses.shock, 0);
  assert.equal(afterAction(afterAction(afterAction(once))).statuses.shock, 0);
});

void test('only a burst counts as Shock going off, never a fade', () => {
  const shocked = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, shock: 1 },
  };
  const faded = afterAction(shocked);
  assert.equal(faded.statuses.shock, 0);
  assert.equal(faded.shockBursts ?? 0, 0, 'a fade is not a burst');
  assert.equal(burstShock(shocked).shockBursts, 1);
});

void test("a shocked hero's own attacks never set off its Shock", () => {
  const start = griffonFight();
  const griffon = griffonOf(start);
  const names = getHero('grandGriffon').moves.map((m) => m.name);
  const shocked: CombatState = {
    ...start,
    heroes: start.heroes.map((unit) =>
      unit.uid === griffon.uid
        ? {
            ...unit,
            moveIndex: names.indexOf('Triple Slice'),
            statuses: { ...unit.statuses, shock: 4 },
          }
        : unit
    ),
  };
  const after = endTurnSteps(shocked).find(
    (step) => step.actorUid === griffon.uid
  )!.state;
  const hero = after.heroes.find((unit) => unit.uid === griffon.uid)!;
  assert.equal(hero.shockBursts ?? 0, 0);
  assert.equal(hero.hp, griffon.hp);
  assert.equal(hero.statuses.shock, 3, 'it only fades by 1');
});

/** A combatant with its Bleed set. */
const withBleed = <T extends { statuses: typeof NO_STATUSES }>(
  unit: T,
  bleed: number
): T => ({ ...unit, statuses: { ...unit.statuses, bleed } });

void test('Bleed bites once per physical attack landed, not per hit', () => {
  // A hit alone no longer sets it off.
  const bleeding = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, bleed: 9 },
  };
  const hit = takeHit(bleeding, 2, 'melee');
  assert.equal(hit.hp, 48);
  assert.equal(hit.statuses.bleed, 9);
  // The whole attack: one bite for a third (rounded up), then Bleed -1.
  assert.equal(BLEED_BITE_FACTOR, 1 / 3);
  const bitten = bleedOnAttack(bleeding, 9);
  assert.equal(bitten.hp, 50 - 3);
  assert.equal(bitten.statuses.bleed, 8);
  assert.equal(bitten.bleedTaken, 3, 'counted for the bleed number');
  // Played: a 2x3 volley on Bleed 9 bites once, for 3.
  const start = withHand(fightWith([]), []);
  const uid = start.heroes[0]?.uid ?? -1;
  const state: CombatState = {
    ...start,
    heroes: start.heroes.map((unit) =>
      unit.uid === uid ? withBleed({ ...unit, hp: 500, maxHp: 500 }, 9) : unit
    ),
  };
  const play = (card: CardId) =>
    playCard(withHand(state, [card]), 0, uid).heroes.find(
      (unit) => unit.uid === uid
    )!;
  const volleyed = play('barbedVolley');
  assert.equal(volleyed.hp, 500 - 6 - 3);
  assert.equal(volleyed.bleedTaken, 3);
  // Its own 3 x Bleed 2 land too: 9 + 6, then -1 for the bite.
  assert.equal(volleyed.statuses.bleed, 14);
  // Magic doesn't set it off, nor does it tick between actions.
  assert.equal(play('chaosBolt').statuses.bleed, 9);
  assert.equal(afterAction(bleeding).statuses.bleed, 9);
  assert.ok(BANE_AFFLICTIONS.has('bleed'));
  assert.ok(!('venom' in NO_STATUSES), 'Venom is gone');
});

void test('new shock stacks on top and keeps the count', () => {
  const shocked = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, shock: 2 },
  };
  const hit = takeHit(
    takeHit(takeHit(shocked, 1, 'melee'), 1, 'melee'),
    1,
    'melee'
  );
  const stacked = addStatus(hit, 'shock', 4);
  assert.equal(stacked.shockHits, 3);
  const burst = takeHit(stacked, 1, 'melee');
  assert.equal(burst.hp, 50 - 4 - 6 * SHOCK_BURST_FACTOR);
});

void test('Shock hits must come in one turn: the count resets at upkeep', () => {
  const shocked = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, shock: 6 },
  };
  const twice = takeHit(takeHit(shocked, 1, 'melee'), 1, 'melee');
  const nextTurn = endOfTurnUpkeep(twice);
  assert.equal(nextTurn.shockHits ?? 0, 0);
  assert.equal(takeHit(nextTurn, 1, 'melee').statuses.shock, 6);
});

void test('a magic hit counts toward Shock like any other', () => {
  const shocked = {
    ...createCombatant(50, 50),
    statuses: { ...NO_STATUSES, shock: 6 },
  };
  const hit = takeHit(
    takeHit(takeHit(shocked, 1, 'magic'), 1, 'melee'),
    1,
    'range'
  );
  const zapped = takeHit(hit, 1, 'magic');
  assert.equal(zapped.statuses.shock, 0, 'the 4th hit bursts it');
  assert.equal(zapped.hp, 50 - 4 - 6 * SHOCK_BURST_FACTOR);
});

void test('a hero shocked by the villain: four melee hits', () => {
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
  const shocked: CombatState = {
    ...fight,
    hand: ['backhand', 'backhand', 'backhand', 'backhand'],
    energy: 4,
    heroes: fight.heroes.map((unit) => ({
      ...unit,
      hp: 99,
      maxHp: 99,
      statuses: { ...unit.statuses, shock: 5 },
    })),
  };
  const uid = shocked.heroes[0]!.uid;
  const after = [0, 0, 0, 0].reduce(
    (state) => playCard(state, 0, uid),
    shocked
  );
  const maiden = after.heroes.find((unit) => unit.uid === uid)!;
  assert.equal(maiden.hp, 99 - 6 * 4 - 5 * SHOCK_BURST_FACTOR);
  assert.equal(maiden.statuses.shock, 0);
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

void test('a card with Remove goes to the Remove pile after use', () => {
  const after = playCard(withHand(fightWith(['seethe']), ['seethe']), 0, 1);
  assert.deepEqual(after.removedPile, ['seethe']);
  assert.deepEqual(after.discardPile, []);
  assert.equal(after.player.statuses.wrath, 2);
  assert.ok(describeCard('seethe').includes('Remove'));
});

void test('removed cards stay out of the reshuffle', () => {
  const state = {
    ...withHand(fightWith(['seethe']), ['seethe']),
    drawPile: [],
    discardPile: [],
  };
  const after = endTurn(playCard(state, 0, 1));
  assert.deepEqual(after.hand, []);
  assert.deepEqual(after.removedPile, ['seethe']);
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

void test('Protection cuts each hit by its tier: I 25%, II 50%, III 75%, IV 95%', () => {
  const shielded = (tier: number) => ({
    ...createCombatant(100, 100),
    statuses: { ...NO_STATUSES, protection: tier },
  });
  const lost = (tier: number) => 100 - takeHit(shielded(tier), 20, 'melee').hp;
  assert.deepEqual([0, 1, 2, 3, 4].map(lost), [20, 15, 10, 5, 1]);
});

void test('Protection and Enfeeble round up hits, while Guard and Armor can still stop them', () => {
  const base = createCombatant(60, 60);
  const tier = (id: 'protection' | 'enfeeble', n: number) => ({
    ...base, statuses: { ...base.statuses, [id]: n },
  });
  const amounts = [0, 1, 8, 20, 21];
  assert.deepEqual(amounts.map(n => protectedAmount(tier('protection', 4), n)), [0, 1, 1, 1, 2]);
  assert.deepEqual(amounts.map(n => attackDamage(n, tier('enfeeble', 4))), [0, 1, 1, 1, 2]);
  assert.equal(protectedAmount(tier('protection', 2), 5), 3);
  assert.equal(attackDamage(5, tier('enfeeble', 2)), 3);
  const protectedUnit = tier('protection', 4);
  assert.equal(takeHit({ ...protectedUnit, guard: 1 }, 8, 'melee').hp, 60);
  assert.equal(takeHit({ ...protectedUnit, statuses: { ...protectedUnit.statuses, armor: 1 } }, 8, 'melee').hp, 60);
  const enfeebled = tier('enfeeble', 4);
  assert.equal(attackDamage(8, { ...enfeebled, statuses: { ...enfeebled.statuses, frost: 1 } }), 0);
});

void test('Protection and Instinct cap at IV on repeated casts in a turn', () => {
  for (const [card, key] of [['bulwark', 'protection'], ['instinct', 'instinct']] as const) {
    const hand = Array.from({ length: 5 }, () => card);
    const tiers: number[] = [];
    let state = { ...withHand(fightWith(['backhand']), hand), energy: 9 };
    for (let cast = 0; cast < hand.length; cast += 1) {
      state = playCard(state, 0, -1);
      tiers.push(state.player.statuses[key]);
    }
    assert.deepEqual(tiers, [1, 2, 3, 4, 4]);
  }
  assert.ok(describeCard('instinct').includes('Instinct I'));
});

void test("Bulwark protects through two full enemy turns, then expires", () => {
  const start = withHand(fightWith(['backhand']), ['bulwark', 'bulwark']);
  const twice = playCard(playCard(start, 0, -1), 0, -1);
  assert.equal(twice.player.statuses.protection, 2);
  const first = endTurnSteps(twice);
  assert.ok(first.every(step => step.state.player.statuses.protection === 2));
  const next = first.at(-1)!.state;
  const second = endTurnSteps(next);
  assert.ok(second.slice(0, -1).every(step => step.state.player.statuses.protection === 2));
  const expired = second.at(-1)!.state;
  assert.equal(expired.player.statuses.protection, 0);
  const recast = playCard(withHand(expired, ['bulwark']), 0, -1);
  assert.equal(recast.player.statuses.protection, 1);
  const renewed = playCard(withHand(next, ['bulwark']), 0, -1);
  assert.equal(renewed.player.statuses.protection, 3, 'recast while active stacks');
  assert.equal(endTurn(renewed).player.statuses.protection, 3, 'recast refreshes the duration');
});

void test('a wave arrival without enemy actions does not spend a Stacking Buff turn', () => {
  const start = withHand(fightWith(['backhand']), ['bulwark', 'sapStrength']);
  const uid = start.heroes[0]!.uid;
  const active = playCard(playCard({ ...start, waveArrival: true }, 0, -1), 0, uid);
  const waiting = endTurn(active);
  assert.equal(waiting.player.cardProtectionTurns, 2);
  assert.equal(waiting.heroes.find(unit => unit.uid === uid)?.enfeebleTurns, 2);
});

void test('Natural expiry of max Protection or Instinct locks Buff cards for one player turn', () => {
  for (const card of ['bulwark', 'instinct'] as const) {
    let state = withHand(fightWith(['darkCloak']), [card, card, card, card]);
    state = { ...state, energy: 12 };
    for (let i = 0; i < 4; i++) state = playCard(state, 0, -1);
    state = endTurn(state);
    assert.equal(state.player.statuses.malaise, 0, 'not before Tier IV expires');
    state = endTurn(state);
    assert.equal(state.player.statuses.malaise, 1);
    const hand = withHand(state, [card, 'darkCloak', 'sapStrength']);
    assert.equal(canPlayCard(hand, 0), false);
    assert.equal(playCard(hand, 0, -1), hand, 'no charge or loss of the blocked card');
    assert.equal(canPlayCard(hand, 1), true, 'Defend is still allowed');
    assert.equal(canPlayCard(hand, 2), true, 'Curse is still allowed');
    state = endTurn(state);
    assert.equal(state.player.statuses.malaise, 0);
    assert.equal(canPlayCard(withHand(state, [card]), 0), true);
  }
});

void test('Malaise affects the unit whose Tier IV expires and skips its buff-only moves', () => {
  const state = fightWith(['darkCloak']);
  const bard = { ...state.heroes[0]!, heroId: 'bard' as const, row: 'back' as const };
  const buffIndex = getHero('bard').moves.findIndex(move => move.effects.some(effect => effect.kind === 'wrath'));
  assert.ok(buffIndex >= 0);
  const enfeebled = {
    ...bard, moveIndex: buffIndex, enfeebleTurns: 1,
    statuses: { ...bard.statuses, enfeeble: 4 },
  };
  const expired = endTurn({ ...state, heroes: [enfeebled] });
  assert.equal(expired.player.statuses.malaise, 0);
  const enemy = { ...expired.heroes[0]!, moveIndex: buffIndex };
  assert.equal(enemy.statuses.malaise, 1);
  assert.equal(plannedHeroMove(enemy, [enemy])?.move.effects.some(effect => effect.kind === 'wrath') ?? false, false);
  const afterFirst = endTurn({ ...expired, heroes: [enemy] });
  assert.equal(afterFirst.heroes[0]!.statuses.malaise, 0);
  const ready = { ...afterFirst.heroes[0]!, moveIndex: buffIndex };
  assert.equal(plannedHeroMove(ready, [ready])?.move.effects.some(effect => effect.kind === 'wrath'), true);
  assert.equal(cleanseOne(enemy, 7)[0].statuses.malaise, 0, 'Malaise is a normal cleanseable debuff');
});

void test('Malaise N prints and grants N turns without stacking the duration', () => {
  const unit = createCombatant(60, 60);
  const effect = { kind: 'malaise', amount: 2, target: 'one' } as const;
  assert.equal(describeCardEffect(effect, getCard('sap')), 'Malaise 2');
  const first = addStatus(unit, 'malaise', 2);
  assert.equal(first.statuses.malaise, 2);
  const longer = addStatus(first, 'malaise', 3);
  assert.equal(longer.statuses.malaise, 3);
  assert.equal(addStatus(longer, 'malaise', 2).statuses.malaise, 3);
  assert.equal(endOfTurnUpkeep(longer).statuses.malaise, 2);
});

void test('Malaise does not trigger when a lower tier expires or Tier IV has been cleansed', () => {
  const state = fightWith(['darkCloak']);
  const lower = { ...state, player: { ...state.player, instinctTurns: 1, statuses: { ...state.player.statuses, instinct: 3 } } };
  assert.equal(endTurn(lower).player.statuses.malaise, 0);
  const enemy = state.heroes[0]!;
  const [cleaned] = cleanseOne({ ...enemy, enfeebleTurns: 1, statuses: { ...enemy.statuses, enfeeble: 4 } }, 7);
  assert.equal(endTurn({ ...state, heroes: [cleaned] }).heroes[0]!.statuses.malaise, 0);
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
    'fatigue',
    'fatigueAll',
    'frost',
    'hex',
    'hitLimit',
    'malaise',
    'pin',
    'poison',
    'scramble',
    'shock',
    'vex',
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
  // The Squire (front) takes 3; the back-row Archer takes 125% of 3
  // (rounded to 4) twice.
  assert.deepEqual(hpLost(start, after), [3, 8]);
});

void test('every pick follows reach: a melee pick at the back row hits the front', () => {
  const start = squireAndArcher(['reapingCuts']);
  const [squire, archer] = start.heroes.map((unit) => unit.uid);
  const picks = [squire ?? -1, archer ?? -1];
  const after = playCard(start, 0, picks[0] ?? -1, picks);
  // 4 + 4, and no bite: Bleed bites once per attack, on Bleed from before.
  assert.deepEqual(hpLost(start, after), [8, 0]);
});

void test('a Target N card shows one beat per pick and ends on the real play', () => {
  const start = squireAndArcher(['scatterShot']);
  const [squire, archer] = start.heroes.map((unit) => unit.uid);
  const picks = [squire ?? -1, archer ?? -1, squire ?? -1];
  const steps = playCardSteps(start, 0, picks[0] ?? -1, picks);
  assert.equal(steps.length, 4);
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
      const perHit = Number(/Damage (\d+)/.exec(line)?.[1]);
      const hits = Number(/×(\d+)/.exec(line)?.[1] ?? 1);
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
  // Volley 2x3 from the back: Range at 125% (2.5 rounds to 3).
  const [shot] = describeHeroIntent(archer, fresh.heroes).intents;
  assert.deepEqual([shot?.kind, shot?.text, shot?.hoverText], ['range', '3×3', '9']);
  // Up close it loses the bonus but is still a Range shot.
  const upClose = { ...archer, row: 'front' as const };
  const [strike] = describeHeroIntent(upClose, fresh.heroes).intents;
  assert.deepEqual([strike?.kind, strike?.text, strike?.hoverText], ['range', '2×3', '6']);
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
  // (7 + 2 + 3) x 1.25 long range = 15.
  assert.match(describeCard('blackArrow', player, archer).join(' '), /15/);
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
  assert.match(describeCard('spiteBolt', player).join(' '), /Damage 10/);
  // Aimed at the Squire (in front, no long-range bonus): 10 x 0.75.
  assert.match(describeCard('spiteBolt', player, squire).join(' '), /Damage 7/);
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
  // RAMPAGE doubles Momentum's bonus: +50% becomes +100%.
  assert.equal(RAMPAGE_MOMENTUM_FACTOR, 2);
  assert.equal(attackDamage(10, charged, 'melee'), 15);
  assert.equal(attackDamage(10, charged, 'melee', true), 20);
  assert.equal(attackDamage(10, villain, 'melee', true), 10, 'no Momentum');
  const quickJab = getCard('quickJab');
  assert.ok(quickJab.keywords.includes('rampage'));
  assert.equal(playDamageFactor(charged, squire, quickJab), 2);
  assert.ok(describeCard('quickJab', charged).includes('Damage 6'), '3 x 2');
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

void test('the dragon makes two moves a turn: Sol summons, then breathes', () => {
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

void test('a hero Aloft is out of Melee reach', () => {
  const aloft = griffonAloft();
  for (const cardId of ['backhand', 'cleave'] as const) {
    const state = { ...aloft, hand: [cardId], energy: 3 };
    assert.equal(canPlayCard(state, 0), false, cardId);
    assert.deepEqual(autoTargets(state, 0), [], cardId);
  }
});

void test('a Curse always lands on a hero Aloft', () => {
  const aloft = griffonAloft();
  const griffon = griffonOf(aloft);
  const state = { ...aloft, hand: ['mourningCurse' as CardId], energy: 3 };
  assert.equal(canPlayCard(state, 0), true);
  assert.equal(aimHitChance(state, 0, griffon), 1);
  const cursed = playCard(state, 0, griffon.uid);
  assert.equal(griffonOf(cursed).statuses.hex, 3);
});

void test('Range and Magic reach a hero Aloft but it evades most shots', () => {
  const aloft = griffonAloft();
  const griffon = griffonOf(aloft);
  for (const cardId of ['spiteBolt', 'soulLance'] as const) {
    const state = { ...aloft, hand: [cardId], energy: 3 };
    assert.equal(canPlayCard(state, 0), true, cardId);
    assert.equal(aimHitChance(state, 0, griffon), 1 - ALOFT_EVASION, cardId);
  }
  // Rolled on the seeded rng: over many seeds most shots miss.
  const landed = Array.from({ length: 60 }, (_, rng) =>
    playCard({ ...aloft, rng, hand: ['spiteBolt'], energy: 3 }, 0, griffon.uid)
  ).filter((after) => griffonOf(after).hp < griffon.hp).length;
  assert.ok(landed > 0 && landed < 25, `landed ${landed} of 60`);
});

void test('the griffon calls lightning: Shock its triple hits charge', () => {
  const start = griffonFight();
  const griffon = griffonOf(start);
  const atMove = (moveIndex: number): CombatState => ({
    ...start,
    heroes: start.heroes.map((unit) =>
      unit.uid === griffon.uid ? { ...unit, moveIndex } : unit
    ),
  });
  const names = getHero('grandGriffon').moves.map((m) => m.name);
  // Thunder Talons rakes three times, then leaves Shock on the villain.
  const talons = endTurn(atMove(names.indexOf('Thunder Talons')));
  // Shock 6 on every one of its 3 hits.
  assert.equal(talons.player.statuses.shock, 6 * 3);
  // Storm Wings guards and charges more Shock without attacking.
  const wings = endTurn(atMove(names.indexOf('Storm Wings')));
  assert.ok(wings.player.statuses.shock > 0);
  // Its Triple Slice charges the Shock 3 of the SHOCK_HITS (4) hits:
  // one more hit that turn, from any hero, sets it off.
  const shocked = {
    ...atMove(0),
    player: {
      ...start.player,
      statuses: { ...start.player.statuses, shock: 6 },
    },
  };
  const sliced = endTurnSteps(shocked).find(
    (step) => step.actorUid === griffon.uid
  )!.state;
  assert.equal(sliced.player.shockHits, 3);
  // 6, less the 1 that faded after the villain's own turn.
  assert.equal(sliced.player.statuses.shock, 5);
});

void test('the griffon Smites (sets off Shock) and swipes Crossed Talon 3x6', () => {
  const start = griffonFight();
  const griffon = griffonOf(start);
  const moves = getHero('grandGriffon').moves;
  const indexOf = (name: string) => moves.findIndex((m) => m.name === name);
  const shocked = (moveIndex: number): CombatState => ({
    ...start,
    player: {
      ...start.player,
      statuses: { ...start.player.statuses, shock: 5 },
    },
    heroes: start.heroes.map((unit) =>
      unit.uid === griffon.uid ? { ...unit, moveIndex } : unit
    ),
  });
  const actOf = (state: CombatState) =>
    endTurnSteps(state).find((step) => step.actorUid === griffon.uid)!.state;
  // Smite: no hits, the Shock goes off at once (doubled). The villain's
  // own turn faded it 5 -> 4 first.
  const smitten = actOf(shocked(indexOf('Smite')));
  assert.equal(smitten.player.statuses.shock, 0);
  assert.equal(start.player.hp - smitten.player.hp, 4 * SHOCK_BURST_FACTOR);
  // Crossed Talon: 6 hits of 3, which also set the Shock off.
  const crossed = moves[indexOf('Crossed Talon')]!;
  assert.deepEqual(crossed.effects[0], {
    kind: 'attack',
    amount: 3,
    hits: 6,
    type: 'melee',
  });
  const swiped = actOf(shocked(indexOf('Crossed Talon')));
  assert.equal(swiped.player.statuses.shock, 0);
  assert.equal(
    start.player.hp - swiped.player.hp,
    3 * 6 + 4 * SHOCK_BURST_FACTOR
  );
});

void test('a Back Step while the griffon is Aloft does not cancel its dive', () => {
  const aloft = griffonAloft();
  const griffon = griffonOf(aloft);
  // Pushed back to the farthest line while in the sky.
  const pushedBack = {
    ...aloft,
    heroes: aloft.heroes.map((unit) =>
      unit.uid === griffon.uid ? { ...unit, row: 'horizon' as const } : unit
    ),
  };
  assert.deepEqual(
    plannedHeroMoves(griffonOf(pushedBack), pushedBack.heroes).map(
      (p) => p.move.name
    ),
    ['Heavenly Dive']
  );
  const landed = endTurnSteps(pushedBack).find(
    (step) => step.actorUid === griffon.uid
  )!.state;
  assert.equal(pushedBack.player.hp - landed.player.hp, 34);
  assert.equal(griffonOf(landed).statuses.aloft, 0);
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

// --- MELEE EDGES ---
void test('Blunt cards land single heavy blows with Knockback and Rampage; multi-hit is Sharp', () => {
  const blunt = ALL_CARD_IDS.map(getCard).filter((c) => c.edge === 'blunt');
  for (const card of blunt) {
    const multi = card.effects.some(
      (effect) => effect.kind === 'damage' && effect.hits > 1
    );
    assert.equal(multi, false, `${card.name} hits once`);
  }
  assert.equal(getCard('flurry').edge, 'sharp');
  const knocks = blunt.filter((c) => c.effects.some((e) => e.kind === 'push'));
  assert.ok(knocks.length >= 3, 'Knockback is a Blunt staple');
  const rampages = blunt.filter((c) => c.keywords.includes('rampage'));
  assert.ok(rampages.length >= 3, 'so is Rampage');
});

// --- ALL-ALLY HERO MOVES ---
void test('hero moves can buff, guard or heal every hero (chip reads ALL)', () => {
  const rally = getHero('holt').moves.find((m) => m.name === 'Rally')!;
  assert.ok(
    rally.effects.some((e) => e.kind === 'wrath' && e.who === 'allies'),
    'Rally: Buff All'
  );
  const sanctuary = getHero('maren').moves.find((m) => m.name === 'Sanctuary')!;
  assert.ok(
    sanctuary.effects.some((e) => e.kind === 'guard' && e.who === 'allies'),
    'Sanctuary: Guard All'
  );
  const start = fightWith([]);
  const unit = { ...start.heroes[0]!, heroId: 'holt' as const, moveIndex: 0 };
  const [lead] = describeHeroIntent(unit, [unit]).intents;
  assert.equal(lead?.text, 'ALL +1');
  assert.ok(lead?.label.includes('every hero'));
});

// --- AFFLICTIONS ON HIT ---
void test("an attack card's afflictions land on every hit that lands", () => {
  const state = withHand(fightWith([]), ['barbedVolley']);
  const uid = state.heroes[0]?.uid ?? -1;
  const after = playCard(state, 0, uid);
  const hero = after.heroes.find((unit) => unit.uid === uid);
  // Barbed Volley: Damage 2 x3, Bleed 2 on each hit. It had no Bleed
  // before the attack, so it doesn't bite this time.
  assert.equal(hero?.statuses.bleed, 6);
  assert.equal(hero?.bleedTaken ?? 0, 0);
  assert.ok(describeCard('barbedVolley').includes('Bleed 2 per hit'));
  // One hit, one proc (and no "per hit" on the text).
  assert.ok(describeCard('cruelSlash').includes('Bleed 3'));
});

void test("a hero move's afflictions ride its attack, one per hit", () => {
  const breath = getHero('holyDragon').moves.find(
    (m) => m.name === 'Holy Breath'
  )!;
  const [attack, ...rest] = foldPerHitAfflictions(breath.effects);
  assert.equal(rest.length, 0, 'Burn folded into the attack');
  assert.ok(attack?.kind === 'attack');
  assert.deepEqual(attack.perHit, [{ status: 'burn', amount: 4 }]);
});

void test('the Holy Dragon breathes fire: its breaths lay Burn', () => {
  const moves = getHero('holyDragon').moves;
  const burns = moves.filter((m) =>
    m.effects.some(
      (e) =>
        e.kind === 'burn' ||
        (e.kind === 'attack' &&
          (e.perHit ?? []).some((proc) => proc.status === 'burn'))
    )
  );
  assert.deepEqual(
    burns.map((m) => m.name),
    ['Holy Breath', 'Dragonfire']
  );
});

void test('the Holy Dragon blesses its host; its angels cleanse it', () => {
  const dragon = getHero('holyDragon').moves.find(
    (m) => m.name === 'Blessing of the Host'
  )!;
  assert.deepEqual(
    dragon.effects.map((e) => [e.kind, 'who' in e ? e.who : '']),
    [
      ['wrath', 'allies'],
      ['protect', 'allies'],
    ]
  );
  const angel = getHero('angelArcher').moves.find((m) => m.name === 'Purify')!;
  assert.deepEqual(angel.effects, [{ kind: 'cleanse', who: 'allies' }]);
  // Protection on heroes: cast on their turn, gone when their next starts.
  const start = squireAndArcher([]);
  const squire = start.heroes[0]!;
  const blessed: CombatState = {
    ...start,
    heroes: start.heroes.map((unit) => ({
      ...unit,
      statuses: { ...unit.statuses, protection: 1 },
    })),
  };
  const steps = endTurnSteps(blessed);
  const after = steps[0]!.state.heroes.find((u) => u.uid === squire.uid)!;
  assert.equal(after.statuses.protection, 0, 'spent as their turn starts');
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
  assert.ok(describeCard('ruin').includes('Hold'));
});

// --- AFFLICTION CARDS ---
void test('Poison Dart poisons, Frost Bolt frosts and Serrated Slash shocks', () => {
  const cases: readonly [CardId, 'poison' | 'frost' | 'shock'][] = [
    ['venomDart', 'poison'],
    ['frostBolt', 'frost'],
    ['serratedSlash', 'shock'],
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

void test('an imbued Hold keeps a card in hand every turn until it is played', () => {
  const state = cloakFight(['holdFast', 'backhand']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  assert.deepEqual(imbued.hand, ['backhand']);
  const later = endTurn(endTurn(endTurn(imbued)));
  assert.ok(later.hand.includes('backhand'), 'held turn after turn');
});

void test('an imbued effect lands with the card, then waits in the piles', () => {
  const state = cloakFight(['venomCoat', 'backhand']);
  const uid = state.heroes[0]?.uid ?? -1;
  const imbued = playCard(state, 0, uid, undefined, 1);
  const after = playCard(imbued, 0, uid);
  const hero = after.heroes.find((unit) => unit.uid === uid);
  assert.equal(hero?.statuses.poison, 3);
  assert.equal(hero?.hp, 14 - 6);
  // It lasts the battle: it goes to the pile with the Backhand.
  assert.equal(after.stowedImbues.length, 1);
});

void test('an imbue on a multi-hit card lands once per hit', () => {
  const state = cloakFight(['venomCoat', 'flurry']);
  const uid = state.heroes[0]?.uid ?? -1;
  const imbued = playCard(state, 0, uid, undefined, 1);
  const after = playCard(imbued, 0, uid);
  const hero = after.heroes.find((unit) => unit.uid === uid);
  // Flurry hits 3 times, so Poison 3 lands 3 times.
  assert.equal(hero?.statuses.poison, 9);
});

void test("imbued damage adds to the card's own Damage (Keen Edge on Backhand: 6 + 5)", () => {
  const state = cloakFight(['keenEdge', 'backhand']);
  const uid = state.heroes[0]?.uid ?? -1;
  const imbued = playCard(state, 0, uid, undefined, 1);
  const keen = imbued.handImbues[0] ?? [];
  assert.deepEqual(describeCard('backhand', undefined, undefined, 0, keen), [
    'Damage 11',
  ]);
  const hpBefore = imbued.heroes.find((unit) => unit.uid === uid)?.hp ?? 0;
  const after = playCard(imbued, 0, uid);
  const hero = after.heroes.find((unit) => unit.uid === uid);
  assert.equal(hpBefore - (hero?.hp ?? 0), 11, 'one hit of 11');
});

void test('imbued damage adds to every hit of a multi-hit card', () => {
  const state = cloakFight(['keenEdge', 'flurry']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  const keen = imbued.handImbues[0] ?? [];
  assert.deepEqual(describeCard('flurry', undefined, undefined, 0, keen), [
    'Damage 8 ×3',
  ]);
});

void test('an unplayed imbued card keeps its imbue through the discard and back', () => {
  const state = cloakFight(['venomCoat', 'backhand']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  const discarded = endTurn({ ...imbued, drawPile: [], discardPile: [] });
  // Only the Backhand to draw: it is discarded, reshuffled and redrawn.
  const slot = discarded.hand.indexOf('backhand');
  assert.ok(slot >= 0);
  assert.equal(discarded.handImbues[slot]?.length, 1);
  assert.equal(discarded.stowedImbues.length, 0);
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

void test('Imbue cards say what they grant', () => {
  assert.equal(getCard('venomCoat').type, 'imbue');
  assert.deepEqual(describeCard('holdFast'), ['Hold']);
  assert.deepEqual(describeCard('venomCoat'), ['Poison 3']);
});

void test('an imbued effect on a multi-hit card reads per hit', () => {
  const poison: ImbueGift = {
    kind: 'effect',
    effect: { kind: 'poison', amount: 3, target: 'one' },
  };
  assert.equal(
    describeImbueGift(poison, getCard('flurry')),
    'Poison 3 per hit'
  );
  assert.equal(describeImbueGift(poison, getCard('backhand')), 'Poison 3');
});

// --- UTILITY AND EXHAUST ---
void test('a Healing Potion heals you and exhausts on its only use', () => {
  const state = cloakFight(['healingPotion']);
  const hurt = { ...state, player: { ...state.player, hp: 30 } };
  const after = playCard(hurt, 0, -1);
  assert.ok(after.player.hp > 30);
  assert.deepEqual(after.exhausted, ['healingPotion']);
  assert.ok(describeCard('healingPotion').includes('Uses 1/1'));
});

void test('the last use Exhausts the card out of the fight', () => {
  const state = cloakFight(['rushPotion']);
  const worn = { ...state, usesSpent: { rushPotion: EXHAUST_USES - 1 } };
  const after = playCard(worn, 0, -1);
  assert.equal(after.player.statuses.rush, 2);
  assert.deepEqual(after.removedPile, ['rushPotion']);
  assert.deepEqual(after.exhausted, ['rushPotion']);
  // The next copy starts fresh.
  assert.equal(after.usesSpent.rushPotion, undefined);
});

void test('an Exhaust card reads Destroy N/3, counting up', () => {
  assert.ok(describeCard('rushPotion').includes(`Uses 1/${EXHAUST_USES}`));
  assert.ok(
    describeCard('rushPotion', undefined, undefined, 1).includes(
      `Uses 2/${EXHAUST_USES}`
    )
  );
});

void test('consumable potions and tonics Exhaust', () => {
  for (const id of ['healingPotion', 'antidote', 'swiftTonic', 'rushPotion'] as const)
    assert.ok(getCard(id).keywords.includes('exhaust'), id);
});

void test('healing spells are Magic, reusable, and heal you', () => {
  for (const cardId of ['mend', 'siphonBolt', 'darkRenewal'] as CardId[]) {
    const cardDef = getCard(cardId);
    assert.equal(cardDef.type, 'magic', cardId);
    assert.ok(!cardDef.keywords.includes('exhaust'), cardId);
    const state = cloakFight([cardId]);
    const hurt = { ...state, player: { ...state.player, hp: 20 }, energy: 5 };
    const uid = hurt.heroes[0]?.uid ?? -1;
    const after = playCard(hurt, 0, uid);
    assert.ok(after.player.hp > 20, cardId);
    assert.ok(after.discardPile.includes(cardId), `${cardId} is reused`);
  }
});

// --- ENFEEBLE ---
void test('Enfeeble cuts the damage a unit deals by its tier, like Protection', () => {
  const unit = createCombatant(50, 50);
  const tiers = [1, 2, 3, 4].map((tier) => ({
    ...unit,
    statuses: { ...unit.statuses, enfeeble: tier },
  }));
  assert.deepEqual(
    tiers.map((enfeebled) => attackDamage(20, enfeebled)),
    [15, 10, 5, 1]
  );
});

void test('Enfeeble climbs a tier when reapplied the next turn, up to IV', () => {
  const deck: CardId[] = Array.from({ length: 12 }, () => 'sapStrength');
  let state = fightWith(deck);
  const uid = state.heroes[0]?.uid ?? -1;
  const tierOf = (current: CombatState) =>
    current.heroes.find((unit) => unit.uid === uid)?.statuses.enfeeble;
  for (const expected of [1, 2, 3, 4, 4]) {
    state = endTurn(playCard(withHand(state, ['sapStrength']), 0, uid));
    assert.equal(tierOf(state), expected);
  }
});

void test('Sap casts Enfeeble x3: tier III at once', () => {
  const deck: CardId[] = Array.from({ length: 12 }, () => 'darkCloak');
  const state = withHand(fightWith(deck), ['sap']);
  const uid = state.heroes[0]?.uid ?? -1;
  const after = playCard(state, 0, uid);
  assert.equal(
    after.heroes.find((unit) => unit.uid === uid)?.statuses.enfeeble,
    3
  );
  assert.ok(describeCard('sap').includes('Enfeeble III'));
});

void test('Enfeeble lasts two enemy turns without reapplication', () => {
  const deck: CardId[] = Array.from({ length: 12 }, () => 'darkCloak');
  const state = withHand(fightWith(deck), ['sapStrength']);
  const uid = state.heroes[0]?.uid ?? -1;
  const once = endTurn(playCard(state, 0, uid));
  const tierOf = (current: CombatState) =>
    current.heroes.find((unit) => unit.uid === uid)?.statuses.enfeeble;
  assert.equal(tierOf(once), 1, 'still active after the first enemy turn');
  const second = endTurnSteps(once);
  assert.ok(second.slice(0, -1).every(step => tierOf(step.state) === 1));
  assert.equal(tierOf(second.at(-1)!.state), 0, 'gone after the second enemy turn');
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

void test('a wide front hero is pierced through one lane only', () => {
  const state = startCombat({
    hp: 60,
    maxHp: 60,
    deck: Array.from({ length: 12 }, (): CardId => 'darkCloak'),
    heroIds: ['paladin', 'archer', 'archer'],
    might: 1,
    seed: 7,
  });
  const spots = [
    { row: 'front', col: 0 },
    { row: 'back', col: 0 },
    { row: 'back', col: 1 },
  ] as const;
  const placed: CombatState = {
    ...state,
    hand: ['blackArrow'],
    energy: 5,
    heroes: state.heroes.map((unit, index) => ({
      ...unit,
      ...(spots[index] ?? spots[0]),
    })),
  };
  const after = playCard(placed, 0, placed.heroes[0]?.uid ?? -1);
  const [, firstLost, secondLost] = hpLost(placed, after);
  assert.ok((firstLost ?? 0) > 0, 'the hero behind its first lane is hit');
  assert.equal(secondLost, 0, 'one column, not the whole back row');
});

void test('a Piercing hit on the back row strikes the front hero in its lane', () => {
  const state = laneFight(['blackArrow']);
  const behind = state.heroes[1]?.uid ?? -1;
  const after = playCard(state, 0, behind);
  const [frontLost, backLost, besideLost] = hpLost(state, after);
  assert.ok((backLost ?? 0) > 0);
  assert.ok((frontLost ?? 0) > 0, 'pierced forward, through the lane');
  assert.equal(besideLost, 0, 'one column only');
  // Lane 1 has nobody up front: nothing more to hit.
  const lone = playCard(state, 0, state.heroes[2]?.uid ?? -1);
  assert.equal(hpLost(state, lone)[0], 0);
});

void test('every pick of a Target N card pierces its own lane', () => {
  const state = laneFight(['barbedTip', 'forkedBolt']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  const back = state.heroes[1]?.uid ?? -1;
  const after = playCard(imbued, 0, back, [back, back]);
  const [frontLost, backLost, besideLost] = hpLost(state, after);
  assert.ok((backLost ?? 0) > 0);
  assert.equal(frontLost, backLost, 'pierced once per pick');
  assert.equal(besideLost, 0);
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
  assert.ok(describeCard('impale').includes('Piercing'));
});

// --- CURSES ---
void test('Curse cards never deal direct damage, and all of them lay or reap Hex', () => {
  const curses = ALL_CARD_IDS.filter((id) => getCard(id).type === 'curse');
  for (const id of curses)
    assert.ok(
      !getCard(id).effects.some((effect) => effect.kind === 'damage'),
      `${id} deals direct damage`
    );
  // ...and every one of them lays Hex.
  for (const id of curses)
    assert.ok(
      getCard(id).effects.some((effect) => effect.kind === 'hex' || effect.kind === 'reap'),
      `${id} lays no Hex`
    );
});

void test('each status reads as its name and number, one per line', () => {
  assert.deepEqual(describeCard('sneer'), ['Guard 5', 'Weaken 1', 'Hex 1']);
  assert.deepEqual(describeCard('beckon'), ['Pull 1', 'Weaken 1', 'Hex 1']);
  assert.ok(describeCard('hurlAside').includes('Knockback 1'));
  assert.deepEqual(describeCard('forcePull'), ['Pull 2', 'Hex 2']);
  assert.deepEqual(describeCard('forcePush'), ['Knockback 2', 'Hex 2']);
  assert.ok(describeCard('plague').includes('Hex ALL 4'));
  for (const id of ALL_CARD_IDS)
    assert.ok(!describeCard(id).join(' ').includes('Apply'), id);
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

// --- REMOVE, STACKING AND DURATIONS ---
void test('Remove can be imbued: the card goes to the Remove pile once played', () => {
  const state = cloakFight(['lastRites', 'backhand']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  assert.equal(imbued.hand.length, 2, 'Last Rites draws a card');
  const slot = imbued.hand.indexOf('backhand');
  const after = playCard(imbued, slot, imbued.heroes[0]?.uid ?? -1);
  assert.deepEqual(after.removedPile, ['lastRites', 'backhand']);
  assert.ok(!after.discardPile.includes('backhand'));
});

void test('a keyword can not be imbued onto a card that already has it', () => {
  // Printed: Impale already pierces.
  const printed = laneFight(['barbedTip', 'impale']);
  assert.equal(canPlayCard(printed, 0), false);
  // Imbued: a second Hold Fast finds no card without Hold.
  const state = cloakFight(['holdFast', 'backhand', 'holdFast']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  assert.deepEqual(imbued.hand, ['backhand', 'holdFast']);
  assert.equal(canPlayCard(imbued, 1), false);
});

void test('a stackable effect stacks when imbued twice', () => {
  const state = cloakFight(['venomCoat', 'venomCoat', 'backhand']);
  const uid = state.heroes[0]?.uid ?? -1;
  const once = playCard(state, 0, uid, undefined, 2);
  const twice = playCard({ ...once, energy: 3 }, 0, uid, undefined, 1);
  const after = playCard({ ...twice, energy: 3 }, 0, uid);
  const hero = after.heroes.find((unit) => unit.uid === uid);
  assert.equal(hero?.statuses.poison, 6);
});

void test('an effect that does not stack can not be imbued twice', () => {
  const state = cloakFight(['purifyingRune', 'backhand', 'purifyingRune']);
  const imbued = playCard({ ...state, energy: 5 }, 0, 0, undefined, 1);
  assert.deepEqual(imbued.hand, ['backhand', 'purifyingRune']);
  assert.equal(canPlayCard(imbued, 1), false);
});

void test('every imbue lasts the battle, coming back with its card', () => {
  const state = cloakFight(['emberRune', 'backhand']);
  const uid = state.heroes[0]?.uid ?? -1;
  const imbued = playCard(state, 0, 0, undefined, 1);
  const played = playCard(imbued, 0, uid);
  // The Backhand is reshuffled and drawn again, Burn and all.
  const later = endTurn({ ...played, drawPile: [] });
  const slot = later.hand.indexOf('backhand');
  assert.ok(slot >= 0);
  assert.equal(later.handImbues[slot]?.length, 1);
  assert.deepEqual(describeCard('emberRune'), ['Burn 4']);
});

void test('an imbue outlasts other plays and the end of the turn', () => {
  const state = cloakFight(['keenEdge', 'backhand', 'darkCloak']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  const other = playCard(imbued, imbued.hand.indexOf('darkCloak'), 0);
  assert.equal(other.handImbues[other.hand.indexOf('backhand')]?.length, 1);
  const later = endTurn({ ...other, drawPile: [], discardPile: [] });
  assert.equal(later.handImbues[later.hand.indexOf('backhand')]?.length, 1);
});

void test('an Imbue card goes to the Remove pile once played', () => {
  const state = cloakFight(['holdFast', 'backhand']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  assert.deepEqual(imbued.removedPile, ['holdFast']);
  assert.ok(!imbued.discardPile.includes('holdFast'));
});

void test('an action buff lasts for the next card only', () => {
  const state = cloakFight(['steadyAim', 'blackArrow', 'blackArrow']);
  const uid = state.heroes[0]?.uid ?? -1;
  const aimed = playCard(state, 0, 0);
  assert.equal(aimed.player.statuses.hone, 4);
  const first = playCard(aimed, 0, uid);
  assert.equal(first.player.statuses.hone, 0, 'spent on the first arrow');
  assert.deepEqual(describeCard('steadyAim'), ['Hone 4 this action']);
});

void test('a turn buff wears off at the end of the turn', () => {
  const state = cloakFight(['battleFury']);
  const before = state.player.statuses.might;
  const furious = playCard(state, 0, 0);
  assert.equal(furious.player.statuses.might, before + 3);
  const later = endTurn(furious);
  assert.equal(later.player.statuses.might, before);
  assert.deepEqual(describeCard('battleFury'), ['Might 3 this turn']);
});

void test('a card holds at most MAX_IMBUES_PER_CARD imbues', () => {
  const runes = Array.from(
    { length: MAX_IMBUES_PER_CARD + 1 },
    (): CardId => 'venomCoat'
  );
  let state: CombatState = { ...cloakFight(['backhand', ...runes]), energy: 9 };
  // Imperative on purpose: each rune goes on the Backhand in slot 0.
  for (let i = 0; i < MAX_IMBUES_PER_CARD; i++)
    state = playCard(state, 1, 0, undefined, 0);
  assert.equal(state.handImbues[0]?.length, MAX_IMBUES_PER_CARD);
  assert.equal(canPlayCard(state, 1), false, 'the Backhand is full');
});

void test('every elemental card is a Magic card', () => {
  for (const id of ALL_CARD_IDS)
    if (getCard(id).element)
      assert.equal(getCard(id).type, 'magic', `${id} has an element`);
  assert.equal(getCard('cataclysm').element, 'fire');
  assert.equal(getCard('frostBolt').element, 'ice');
  assert.equal(getCard('shadowBarrage').element, undefined, 'plain magic');
  assert.equal(getCard('wardingBolt').element, 'lightning');
});

void test('Buff cards can not be imbued', () => {
  // Hold Fast fits any card, but never a Buff card (Imbue cards included).
  const state = cloakFight(['holdFast', 'seethe', 'ironRune', 'backhand']);
  assert.deepEqual(imbueSlotsFor(state, 0), [3]);
});

// --- RAMPAGE ---
/** Squire (front, 1 HP) and Archer (back): one kill empties the front. */
const rampageFight = (hand: CardId[]): CombatState => {
  const state = squireAndArcher(hand);
  return {
    ...state,
    heroes: state.heroes.map((unit) =>
      unit.heroId === 'squire' ? { ...unit, hp: 1 } : unit
    ),
  };
};

/** Squire (front) and Archer (back, 1 HP): one kill leaves only the front. */
const distanceFight = (hand: CardId[]): CombatState => {
  const state = squireAndArcher(hand);
  return {
    ...state,
    heroes: state.heroes.map((unit) =>
      unit.heroId === 'archer' ? { ...unit, hp: 1 } : unit
    ),
  };
};

/** The uid of the Archer in a fight. */
const archerUid = (state: CombatState): number =>
  state.heroes.find((unit) => unit.heroId === 'archer')?.uid ?? -1;

/** The Distance fight, its first card imbued with Rampage. */
const distanceRampage = (hand: CardId[]): CombatState => {
  const state = distanceFight(hand);
  return {
    ...state,
    handImbues: [[{ gift: { kind: 'keyword', keyword: 'rampage' } }]],
  };
};

void test('a Rampage kill that empties the front row Charges for free', () => {
  const state = rampageFight(['cleave']);
  const after = playCard(state, 0, state.heroes[0]?.uid ?? -1);
  const archer = after.heroes.find((unit) => unit.heroId === 'archer');
  assert.equal(archer?.row, 'front', 'the back row stepped up');
  assert.equal(after.player.statuses.momentum, 1);
  assert.equal(after.energy, state.energy - 1, 'only the card was paid');
  assert.equal(after.lastMovement, null, 'no movement streak either');
  assert.equal(after.freeMove?.move, 'charge');
  // Even with no energy left, a kill still Charges.
  const broke = { ...rampageFight(['cleave']), energy: 1 };
  const brokeAfter = playCard(broke, 0, broke.heroes[0]?.uid ?? -1);
  assert.equal(brokeAfter.freeMove?.move, 'charge');
});

void test('Rampage grants Momentum on kill even when Charge is blocked', () => {
  // No kill: the Squire stands.
  const tough = squireAndArcher(['cleave']);
  assert.equal(playCard(tough, 0, tough.heroes[0]?.uid ?? -1).freeMove, null);
  // A kill in the back row leaves the Squire up front: no room to Charge.
  const back = distanceRampage(['blackArrow']);
  const blocked = playCard(back, 0, archerUid(back));
  assert.equal(blocked.freeMove, null);
  assert.equal(blocked.player.statuses.momentum, 1);
  assert.equal(playCard(tough, 0, tough.heroes[0]!.uid).player.statuses.momentum, 0);
  // A plain card kills without charging.
  const plain = rampageFight(['backhand']);
  assert.equal(playCard(plain, 0, plain.heroes[0]?.uid ?? -1).freeMove, null);
});

void test('Rampage can be imbued onto an attack', () => {
  const state = rampageFight(['redMist', 'backhand']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  const after = playCard(imbued, 0, imbued.heroes[0]?.uid ?? -1);
  assert.equal(after.freeMove?.move, 'charge', 'the imbued Backhand charged');
  assert.ok(describeCard('cleave').includes('Rampage'));
});

// --- DISTANCE ---
void test('a Distance kill that leaves only the front row Back Steps for free', () => {
  const state = distanceFight(['retreatingShot']);
  const after = playCard(state, 0, archerUid(state));
  const squire = after.heroes.find((unit) => unit.heroId === 'squire');
  assert.equal(squire?.row, 'back', 'the villain fell back');
  assert.equal(after.energy, state.energy - 1, 'only the card was paid');
  assert.equal(after.freeMove?.move, 'backStep');
  const broke = { ...distanceFight(['retreatingShot']), energy: 1 };
  assert.equal(playCard(broke, 0, archerUid(broke)).freeMove?.move, 'backStep');
});

void test('a Distance kill in an all-front line Back Steps the rest at once', () => {
  // Two Squires up front, nobody behind; one falls to Retreating Shot.
  const start = settled(
    startCombat({
      hp: 60,
      maxHp: 60,
      deck: ['backhand'],
      heroIds: ['squire', 'squire'],
      might: 1,
      seed: 7,
    })
  );
  const [first] = start.heroes;
  const state: CombatState = {
    ...start,
    hand: ['retreatingShot'],
    heroes: start.heroes.map((unit) =>
      unit.uid === first?.uid ? { ...unit, hp: 1 } : unit
    ),
  };
  assert.ok(state.heroes.every((unit) => unit.row === 'front'));
  const after = playCard(state, 0, first?.uid ?? -1);
  assert.equal(after.heroes.length, 1);
  assert.equal(after.heroes[0]?.row, 'back', 'the survivor is pushed back');
  assert.equal(after.freeMove?.move, 'backStep');
  assert.equal(after.energy, state.energy - 1, 'for free');
});

void test('Distance Back Steps on a hit, no kill needed', () => {
  // Two healthy Squires up front, nobody behind: the shot hits, nobody falls.
  const state: CombatState = {
    ...settled(
      startCombat({
        hp: 60,
        maxHp: 60,
        deck: ['backhand'],
        heroIds: ['squire', 'squire'],
        might: 1,
        seed: 7,
      })
    ),
    hand: ['retreatingShot'],
  };
  const after = playCard(state, 0, state.heroes[0]?.uid ?? -1);
  assert.equal(after.heroes.length, 2, 'nobody fell');
  assert.ok(after.heroes.every((unit) => unit.row === 'back'));
  assert.equal(after.freeMove?.move, 'backStep');
});

void test('Distance does nothing without room to Back Step', () => {
  // Nobody stands on Frontline: there is no line to fall back from.
  const state = squireAndArcher(['retreatingShot']);
  const allBack: CombatState = {
    ...state,
    heroes: state.heroes.map((unit, col) => ({ ...unit, row: 'back', col })),
  };
  assert.equal(playCard(allBack, 0, archerUid(allBack)).freeMove, null);
});

void test('Distance can be imbued onto an attack', () => {
  const state = distanceFight(['vanish', 'venomDart']);
  const imbued = playCard(state, 0, 0, undefined, 1);
  const after = playCard(imbued, 0, archerUid(imbued));
  assert.equal(after.freeMove?.move, 'backStep');
  assert.ok(describeCard('retreatingShot').includes('Distance'));
});

// --- ELEMENTS ---
void test('every hit of an Ice card applies Frost (Frost Bolt hits twice)', () => {
  const state = withHand(fightWith([]), ['frostBolt']);
  const uid = state.heroes[0]?.uid ?? -1;
  const after = playCard(state, 0, uid);
  const hero = after.heroes.find((unit) => unit.uid === uid);
  assert.equal(hero?.statuses.frost, 2, 'one Frost per hit');
  assert.ok(describeCard('frostBolt').includes('Frost 1 per hit'));
  // Fire's Burn is printed on the card (Hexfire: Burn 2), not added per hit.
  const fire = withHand(fightWith([]), ['hexfire']);
  const burnt = playCard(fire, 0, uid).heroes.find((unit) => unit.uid === uid);
  assert.equal(burnt?.statuses.frost, 0);
  assert.equal(burnt?.statuses.burn, 2);
});

// --- AUTO END TURN ---
void test('a turn has a play left while a card or a move can be made', () => {
  const state = squireAndArcher(['backhand']);
  assert.equal(hasPlayLeft(state), true, 'Backhand is affordable');
  const broke = { ...state, energy: 0 };
  assert.equal(hasPlayLeft(broke), false, 'no energy, no move offered');
  // An empty hand still has a Back Step (the Squire has room behind).
  const empty = { ...state, hand: [] };
  assert.equal(hasPlayLeft(empty), true, 'a Back Step is left');
  // An empty front row offers a Charge: that still counts as a play.
  const allBack: CombatState = {
    ...state,
    hand: [],
    heroes: state.heroes.map((unit) => ({ ...unit, row: 'back' })),
  };
  assert.equal(hasPlayLeft(allBack), true);
  assert.equal(hasPlayLeft({ ...allBack, energy: 0 }), false);
});

// --- SHARPSHOOTER ---
void test('Sharpshooter: Range hits deal 20% more, other types are unchanged', () => {
  const state = withHand(fightWith([]), ['sharpshooter', 'blackArrow']);
  const after = playCard(state, 0, 0);
  assert.equal(after.player.statuses.sharpshooter, 3);
  assert.deepEqual(describeCard('blackArrow', after.player).slice(0, 1), [
    'Damage 8',
  ]);
  assert.deepEqual(describeCard('backhand', after.player), ['Damage 6']);
  assert.deepEqual(describeCard('sharpshooter'), ['Sharpshooter 3', 'Remove']);
  // +50% accuracy, added to each shot's chance (capped at 100%).
  const hero = after.heroes[0]!;
  const aloft = { ...hero, statuses: { ...hero.statuses, aloft: 1 } };
  assert.ok(
    Math.abs(shotHitChance('range', aloft, false, 0.5) - 0.65) < 1e-9,
    'Aloft 15% -> 65%'
  );
  const far = { ...hero, row: 'horizon' as const };
  assert.equal(shotHitChance('range', far, false, 0.5), 1, 'Out of Range 50%');
  assert.equal(shotHitChance('range', far, false), 0.5);
});

// --- BERSERKER ---
void test('Berserker gives every Melee card Rampage for the fight', () => {
  const state = rampageFight(['berserker', 'backhand', 'blackArrow']);
  const berserk = playCard(state, 0, 0);
  assert.equal(berserk.player.statuses.berserker, 1);
  assert.equal(getCard('berserker').rarity, 'legendary');
  assert.deepEqual(describeCard('berserker'), [
    'Imbue all Melee: Rampage',
    'Remove',
  ]);
  // The plain Backhand kills and now Charges for free.
  const after = playCard(berserk, 0, berserk.heroes[0]?.uid ?? -1);
  assert.equal(after.freeMove?.move, 'charge');
  // Melee only: the bow shot is untouched.
  assert.equal(cardImbuesAt(berserk, 0).length, 1, 'Backhand: Rampage');
  assert.ok(describeCard('berserker').includes('Imbue all Melee: Rampage'));
  assert.equal(cardImbuesAt(berserk, 1).length, 0, 'Black Arrow: none');
  // Without it, the Backhand kill makes no move (see Rampage tests).
});

// --- BANE ---
void test('Bane adds its stacks to every affliction a card lays', () => {
  const state = withHand(fightWith([]), ['bane', 'venomDart', 'darkCloak']);
  const uid = state.heroes[0]?.uid ?? -1;
  const baned = playCard(state, 0, uid);
  assert.equal(baned.player.statuses.bane, 3);
  assert.deepEqual(describeCard('venomDart', baned.player), [
    'Damage 3',
    'Poison 7',
  ]);
  const after = playCard(baned, 0, uid);
  const hero = after.heroes.find((unit) => unit.uid === uid);
  assert.equal(hero?.statuses.poison, 4 + 3);
  assert.deepEqual(describeCard('bane'), ['Bane 3', 'Remove']);
});

// --- VEX ---
void test('Vex adds its stacks to every affliction laid on the unit, with Bane', () => {
  const state = withHand(fightWith([]), ['vexingWord', 'venomDart', 'bane']);
  const uid = state.heroes[0]?.uid ?? -1;
  const vexed = playCard(state, 0, uid);
  const hero = vexed.heroes.find((unit) => unit.uid === uid);
  assert.equal(hero?.statuses.vex, 3);
  const baned = playCard(vexed, 1, uid);
  const after = playCard(baned, 0, uid);
  const poisoned = after.heroes.find((unit) => unit.uid === uid);
  // Poison 4, +3 Bane, +3 Vex.
  assert.equal(poisoned?.statuses.poison, 10);
});

void test("Vex wears off by 1 at the end of the unit's turn", () => {
  const vexed = {
    ...createCombatant(20, 20),
    statuses: { ...NO_STATUSES, vex: 2 },
  };
  assert.equal(endOfTurnUpkeep(vexed).statuses.vex, 1);
});

// --- RUSH ---
void test('Rush N: the next N movements this turn cost 0, one stack each', () => {
  const state = withHand(fightWith([]), ['adrenaline']);
  const rushed = {
    ...playCard(state, 0, 0),
  };
  assert.equal(rushed.player.statuses.rush, 2);
  assert.equal(movementCost(rushed, 'backStep'), 0);
  const moved = move(rushed, 'backStep');
  assert.equal(moved.energy, rushed.energy, 'the Back Step was free');
  assert.equal(moved.player.statuses.rush, 1, 'one stack spent');
  assert.deepEqual(describeCard('adrenaline'), ['Rush 2']);
  const triple = {
    ...state,
    player: {
      ...state.player,
      statuses: { ...state.player.statuses, rush: 3 },
    },
  };
  assert.equal(move(triple, 'backStep').player.statuses.rush, 2);
});

void test('Rush lasts the turn, not past it', () => {
  const rushed = {
    ...createCombatant(20, 20),
    statuses: { ...NO_STATUSES, rush: 2 },
  };
  assert.equal(endOfTurnUpkeep(rushed).statuses.rush, 0);
});

// --- ARMOR ---
void test('Armor N takes N off each physical hit, never magic', () => {
  const armored = addStatus(createCombatant(30, 30), 'armor', 2);
  assert.equal(takeHit(armored, 5, 'melee').hp, 27, 'melee: 5 - 2');
  assert.equal(takeHit(armored, 5, 'range').hp, 27, 'range: 5 - 2');
  assert.equal(takeHit(armored, 5, 'magic').hp, 25, 'magic ignores it');
  assert.equal(takeHit(armored, 1, 'melee').hp, 30, 'never below 0');
  assert.equal(endOfTurnUpkeep(armored).statuses.armor, 2, 'it lasts');
});

void test('Armor counts what it soaks, so the hit number can show it', () => {
  const armored = addStatus(createCombatant(30, 30), 'armor', 3);
  const partly = takeHit(armored, 5, 'melee');
  assert.equal(partly.armorSoaked, 3);
  const fully = takeHit(partly, 2, 'range');
  assert.equal(fully.armorSoaked, 5, 'a hit of 2 loses only 2');
  assert.equal(takeHit(armored, 5, 'magic').armorSoaked ?? 0, 0);
  assert.equal(takeHit(armored, 5, 'melee', true).armorSoaked ?? 0, 0);
});

void test('Plate Armor gives the villain Armor 2; Sir Brannoc starts armored', () => {
  const state = withHand(fightWith(['darkCloak']), ['plateArmor']);
  assert.equal(playCard(state, 0, -1).player.statuses.armor, 2);
  assert.equal(describeCard('plateArmor')[0], 'Armor 2');
  const maiden = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['darkCloak'],
    heroIds: ['brannoc'],
    might: 1,
    seed: 7,
  }).heroes[0];
  assert.equal(maiden?.statuses.armor, 3);
});

void test('Piercing ignores Armor, Protection and Guard', () => {
  const tough = castProtection(
    addStatus({ ...createCombatant(30, 30), guard: 1 }, 'armor', 2)
  );
  const pierced = takeHit(tough, 8, 'range', true);
  assert.equal(pierced.hp, 22, 'all 8, straight to HP');
  assert.equal(pierced.guard, 1, 'Guard is left standing');
  assert.ok(takeHit(tough, 8, 'range').hp > 22, 'unpierced is reduced');
  assert.ok(KEYWORD_INFO.piercing.description.includes('Guard'));
  assert.ok(KEYWORD_INFO.piercing.description.includes('Armor'));
});

// --- MELEE EDGE (COSMETIC) ---
void test('every Melee card is Sharp or Blunt; no other card has an edge', () => {
  for (const id of ALL_CARD_IDS) {
    const { type, edge } = getCard(id);
    assert.equal(edge !== undefined, type === 'melee', id);
  }
  assert.equal(getCard('cruelSlash').edge, 'sharp');
  assert.equal(getCard('ruin').edge, 'blunt');
});

void test('a card hit for 0 (all Armor) lays none of its on-hit effects', () => {
  const state = withHand(fightWith(['darkCloak']), ['sear']);
  const armored: CombatState = {
    ...state,
    heroes: state.heroes.map((unit) =>
      addStatus({ ...unit, guard: 0 }, 'armor', 20)
    ),
  };
  const uid = armored.heroes[0]?.uid ?? -1;
  const hero = playCard(armored, 0, uid).heroes[0];
  assert.equal(hero?.damageTaken, 0);
  assert.equal(hero?.statuses.burn, 0, 'Sear lays no Burn on a 0 hit');
  // A hit that lands still burns.
  const landed = playCard(state, 0, uid).heroes[0];
  assert.ok((landed?.statuses.burn ?? 0) > 0);
});

void test('Doom is Legendary: 3 energy, Hex 33', () => {
  const doom = getCard('doom');
  assert.equal(doom.rarity, 'legendary');
  assert.equal(doom.cost, 3);
  assert.ok(doom.effects.some((e) => e.kind === 'hex' && e.amount === 33));
});

// --- RESERVE ENERGY ---
void test('unspent energy carries over into the reserve, up to its slots', () => {
  const start = startCombat({
    hp: 999,
    maxHp: 999,
    deck: ['backhand', 'backhand', 'backhand', 'backhand', 'backhand'],
    heroIds: ['squire'],
    might: 1,
    seed: 1,
  });
  assert.equal(start.reserve, 0);
  // The starter Iron Ring retains one of the three unspent energy.
  const steps = endTurnSteps(start);
  const heroesTurn = steps[0]!.state;
  assert.equal(heroesTurn.reserve, IRON_RING_RESERVE);
  assert.equal(heroesTurn.energy, 0);
  const next = steps.at(-1)!.state;
  assert.equal(next.energy, ENERGY_PER_TURN + IRON_RING_RESERVE);
  assert.equal(next.reserve, 0);
  // Ending with nothing left keeps nothing.
  const spent = endTurn({ ...next, energy: 0 });
  assert.equal(spent.energy, ENERGY_PER_TURN);
});

// --- LIGHTNING CARDS ---
void test('lightning cards: Static Charge only shocks, Overcharge doubles it', () => {
  assert.equal(getCard('forkedBolt').element, 'lightning');
  assert.ok(getCard('forkedBolt').effects.some((e) => e.kind === 'shock'));
  assert.ok(
    getCard('staticCharge').effects.every((e) => e.kind === 'shock'),
    'Static Charge deals no damage'
  );
  const state = fightWith(['backhand']);
  const uid = state.heroes[0]!.uid;
  const charged = playCard(
    { ...state, hand: ['staticCharge', 'overcharge'], energy: 9 },
    0,
    uid
  );
  const shockOf = (s: CombatState) =>
    s.heroes.find((unit) => unit.uid === uid)!.statuses.shock;
  const laid = shockOf(charged);
  assert.ok(laid > 0);
  const doubled = playCard(charged, 0, uid);
  assert.equal(shockOf(doubled), laid * 2);
});

// --- RANDOMLY ---
void test('a Randomly card needs no aim and each hit picks a hero anew', () => {
  assert.equal(describeCard('chaosBolt')[0], 'Damage 7 Randomly');
  const start = squireAndArcher(['wildVolley']);
  assert.equal(targetRuleOf('wildVolley'), 'none');
  // Over many seeds both heroes get hit at some point, and the total
  // damage is always every hit landing on someone.
  const spreads = Array.from({ length: 30 }, (_, rng) => {
    const state = { ...start, rng, hand: ['wildVolley' as CardId], energy: 3 };
    const after = playCard(state, 0, -1);
    return hpLost(state, after);
  });
  assert.ok(spreads.some(([squire = 0]) => squire > 0));
  assert.ok(spreads.some(([, archer = 0]) => archer > 0));
  assert.ok(spreads.every((lost) => lost.reduce((a, b) => a + b, 0) > 0));
});

// --- MELEE KNOCKBACK REACH ---
void test('a Melee Knockback card only targets the front row, even if blocked', () => {
  const fresh = startCombat({
    hp: 99,
    maxHp: 99,
    deck: ['backhand'],
    heroIds: ['holt', 'paladin'],
    might: 1,
    seed: 3,
  });
  const state = { ...fresh, heroes: fresh.heroes.map(unit => ({ ...unit, row: unit.heroId === 'holt' ? 'front' as const : 'back' as const })) };
  for (const card of ['hurlAside', 'ruin'] as const) {
    assert.deepEqual(
      targetsFor(state, card).map((unit) => unit.heroId),
      ['holt'],
      `${card}: Holt in front, not the Paladin behind`
    );
  }
});

void test('play history records paid cards and hand moves once, in order', () => {
  const battle = { ...fightWith(['darkCloak', 'darkCloak']), energy: 10 };
  const failed = playCard(battle, 99, 0);
  assert.equal(failed.playHistory, undefined);
  const first = playCard(battle, 0, 0);
  const second = playCard(first, 0, 0);
  const cost = movementCost(second, 'backStep');
  const moved = move(second, 'backStep');
  assert.equal(second.playHistory?.length, 4);
  assert.deepEqual(moved.playHistory?.filter(entry => 'move' in entry), [
    { turn: battle.turn, move: 'backStep', cost },
  ]);
  assert.equal(move({ ...moved, energy: 0 }, 'charge').playHistory, moved.playHistory);
  assert.equal(battle.playHistory, undefined);
});

void test('resolved enemy attacks join played cards in the history on their own beat', () => {
  const played = playCard(fightWith(['darkCloak']), 0, 0);
  const steps = endTurnSteps(played);
  const attack = steps.find(step => step.attackType);
  assert.ok(attack);
  const record = attack.state.playHistory?.at(-1);
  assert.ok(record && 'heroId' in record);
  assert.equal(record.heroId, 'squire');
  assert.equal(record.attackName, attack.move?.name);
  assert.equal(record.turn, played.turn);
  assert.equal(record.hpLost, played.player.hp - attack.state.player.hp);
  assert.deepEqual(attack.state.playHistory?.slice(0, -1), played.playHistory);
  assert.equal(steps.at(-1)?.state.playHistory?.length, 3);
});
void test('Charge aims after a free advance and spends its Momentum on the same melee attack', () => {
  const battle = fightWith(['cruelSlash']);
  const distant = { ...battle, heroes: battle.heroes.map(hero => ({ ...hero, row: 'back' as const, hp: 50, maxHp: 50 })) };
  const uid = distant.heroes[0]!.uid;
  const beats = playCardSteps(distant, 0, uid);
  assert.ok(canPlayCard(distant, 0));
  assert.deepEqual(autoTargets(distant, 0), [uid]);
  assert.equal(beats[0]?.heroes[0]?.row, 'front');
  assert.equal(beats[0]?.heroes[0]?.hp, 50);
  assert.equal(beats[0]?.player.statuses.momentum, 1);
  const advanced = playCard(distant, 0, uid);
  const adjacent = { ...distant, heroes: distant.heroes.map(hero => ({ ...hero, row: 'front' as const })) };
  const ordinary = playCard(adjacent, 0, uid);
  assert.equal(ordinary.heroes[0]!.hp, 41);
  assert.ok(advanced.heroes[0]!.hp < ordinary.heroes[0]!.hp);
  assert.equal(advanced.player.statuses.momentum, 0);
  assert.equal(advanced.energy, distant.energy - 1);
  assert.equal(advanced.lastMovement, distant.lastMovement);
  assert.deepEqual(beats.at(-1), advanced);
  const beyondReach = { ...distant, heroes: distant.heroes.map(hero => ({ ...hero, row: 'horizon' as const })) };
  assert.equal(canPlayCard(beyondReach, 0), false);
  assert.equal(playCard(beyondReach, 0, uid), beyondReach);
});

/** Give the target enough HP to check every strike of a card. */
const traitFight = (cardId: CardId, traits: Partial<Traits>): CombatState => {
  const fight = fightWith([cardId]);
  return { ...fight, player: { ...fight.player, traits: { ...createCharacter().traits, ...traits } },
    heroes: fight.heroes.map(hero => ({ ...hero, maxHp: 500, hp: 500 })) };
};

void test('offensive traits scale printed damage before dividing flat bonuses across all hits and picks', () => {
  for (const [id, traits, perHit, hits] of [
    ['stormOfBlades', { strength: 64 }, 13, 4],
    ['spiteBolt', { dexterity: 64 }, 42, 1],
    ['shadowBarrage', { intelligence: 64 }, 13, 4],
    ['forkedBolt', { intelligence: 64 }, 23, 2],
    ['stormOfBlades', { intelligence: 64 }, 3, 4],
  ] as const) {
    const fight = traitFight(id, traits);
    const target = fight.heroes[0]!;
    const preview = describeCard(id, fight.player, target);
    assert.ok(preview.some(line => line.startsWith('Damage ' + perHit)), id);
    const result = playCard(fight, 0, target.uid);
    const dealt = target.hp - result.heroes[0]!.hp;
    if (id === 'spiteBolt') assert.ok(dealt === perHit || dealt === 2 * perHit);
    else assert.equal(dealt, perHit * hits, id);
  }
});

void test('Dexterity offsets distance penalties for both Range and Magic', () => {
  const state = traitFight('spiteBolt', { dexterity: 64 });
  const enemy = { ...state.heroes[0]!, row: 'horizon' as const };
  const fight = { ...state, heroes: [enemy] };
  assert.equal(aimHitChance(fight, 0, enemy), 1);
  assert.ok(playCard(fight, 0, enemy.uid).heroes[0]!.hp < enemy.hp);
  const magic = withHand(fight, ['forkedBolt']);
  assert.equal(aimHitChance(magic, 0, enemy), 1);
});

void test('Scorn increases direct and elemental afflictions per application and respects the Enfeeble cap', () => {
  const fight = traitFight('frostBolt', { scorn: 64 });
  const target = fight.heroes[0]!;
  const ice = playCard(fight, 0, target.uid);
  assert.equal(ice.heroes[0]!.statuses.frost, 22);
  assert.ok(describeCard('frostBolt', fight.player).includes('Frost 11 per hit'));
  const cursed = playCard(withHand(fight, ['sapStrength']), 0, target.uid);
  assert.equal(cursed.heroes[0]!.statuses.enfeeble, 4);
  assert.equal(cursed.heroes[0]!.statuses.hex, 11);
  assert.ok(describeCard('sapStrength', fight.player, target).includes('Enfeeble IV'));
});

void test('Vigor and Endurance use the same Guard in hand and on resolution', () => {
  const base = fightWith(['darkCloak']);
  const traits = { ...createCharacter().traits, vigor: 64, endurance: 64 };
  const player = { ...base.player, traits };
  const battle = { ...base, player };
  assert.ok(describeCard('darkCloak', player).includes('Guard 40'));
  assert.equal(playCard(battle, 0, -1).player.guard, 40);

  const imbued: CombatState = {
    ...withHand(battle, ['flurry']),
    heroes: battle.heroes.map(unit => ({ ...unit, hp: 100, maxHp: 100 })),
    handImbues: [[{ gift: { kind: 'effect', effect: { kind: 'guard', amount: 4 } } }]],
  };
  // Three landed hits each grant 4 × 2 + floor(30 / 3).
  assert.equal(playCard(imbued, 0, imbued.heroes[0]!.uid).player.guard, 54);
});

void test('Endurance sets turn energy, retention and the cap on energy gains', () => {
  const traits = { ...createCharacter().traits, endurance: 64 };
  const battle = startCombat({ hp: 60, maxHp: 60, deck: ['bloodPact'], heroIds: ['squire'], might: 1, seed: 1, traits });
  assert.equal(battle.energy, 6);
  const capped = playCard({ ...battle, energy: 19 }, 0, -1);
  assert.equal(capped.energy, 20);
  const finished = finishPlayerTurn(capped);
  assert.equal(finished.reserve, 12);
  assert.equal(startPlayerTurn(finished).energy, 18);
  assert.equal(playCard({ ...fightWith(['bloodPact']), energy: 9 }, 0, -1).energy, 10);
});
void test('whatever an Imbue card gives reads under its other actions', () => {
  assert.deepEqual(describeCard('lastRites').slice(0, 2), ['Draw 1', 'Remove']);
});
void test('Reap is a Curse card that reads Damage ? until it is aimed', () => {
  assert.equal(getCard('reap').type, 'curse');
  assert.deepEqual(describeCard('reap'), ['Damage ?', "(2x target's Hex)"]);
  const fight = traitFight('reap', {});
  const target = addStatus(fight.heroes[0]!, 'hex', 3);
  assert.deepEqual(describeCard('reap', fight.player, target), ['Damage 6']);
});
void test('a card previews its numbers on the only hero it can hit', () => {
  const alone = fightWith(['reap']);
  assert.equal(soleTargetFor(alone, 'reap', 0)?.uid, alone.heroes[0]!.uid);
  assert.equal(soleTargetFor(squireAndArcher(['reap']), 'reap', 0), undefined);
  assert.equal(soleTargetFor(alone, 'mend'), undefined);
});
void test('Reap previews and deals Intelligence-scaled magic damage based on target Hex', () => {
  const fight = traitFight('reap', { intelligence: 64 });
  const target = addStatus(fight.heroes[0]!, 'hex', 4);
  assert.ok(describeCard('reap', fight.player, target).includes('Damage 46'));
  assert.equal(playCard({ ...fight, heroes: [target] }, 0, target.uid).heroes[0]!.hp, 454);
});
void test('Scorn scales enemy Poison, Burn and odd Hex ticks independently without changing their decay or Frost', () => {
  const trigger = (scorn: number, hex: number) => {
    const battle = traitFight('mend', { scorn });
    const hero = battle.heroes[0]!;
    const afflicted = { ...hero, statuses: { ...hero.statuses, hex, poison: 7, burn: 9, frost: 2 } };
    return endTurn({ ...battle, heroes: [afflicted] });
  };
  const ordinary = trigger(0, 5);
  const scaled = trigger(64, 5);
  const enemy = scaled.heroes[0]!;
  const expected = [hexBurnAmount(5), 7, 9].reduce((sum, n) => sum + Math.floor(n * 1.6), 0);
  assert.equal(500 - enemy.hp, expected);
  assert.deepEqual(enemy.statuses, ordinary.heroes[0]!.statuses);
  assert.equal(scaled.player.hp, ordinary.player.hp);
  assert.equal(500 - trigger(64, 4).heroes[0]!.hp, 11 + 14);
});

void test('Scorn scales the Bleed bite and Shock burst separately from the melee hit, including overkill counters', () => {
  const battle = traitFight('backhand', { scorn: 64 });
  const target = battle.heroes[0]!;
  const enemy = { ...target, hp: 1, shockHits: SHOCK_HITS - 1, statuses: { ...target.statuses, shock: 5, bleed: 10 } };
  const steps = playCardSteps({ ...battle, heroes: [enemy] }, 0, enemy.uid);
  const burst = steps.find(step => (step.heroes[0]?.shockDamageTaken ?? 0) > 0)?.heroes[0];
  assert.ok(burst);
  assert.equal(burst.shockDamageTaken, 16);
  assert.equal(burst.damageTaken, 6 + 16);
  // A living target also bleeds once per card, independently of the triggering hit.
  const live = playCard({ ...battle, heroes: [{ ...enemy, hp: 500 }] }, 0, enemy.uid).heroes[0]!;
  assert.equal(live.bleedTaken, 6);
  assert.equal(live.shockDamageTaken, 16);
  assert.equal(500 - live.hp, 6 + 16 + 6);
  assert.equal(live.statuses.bleed, 9);
});

void test('Scorn scales only the Hex-derived part of Reap before mitigation, and never incoming status damage', () => {
  const battle = traitFight('reap', { scorn: 64, intelligence: 64 });
  const enemy = addStatus(battle.heroes[0]!, 'hex', 5);
  const target = { ...enemy, guard: 4, statuses: { ...enemy.statuses, protection: 1 } };
  const boosted = 16 * 2 + 30;
  assert.ok(describeCard('reap', battle.player, target).includes('Damage ' + boosted));
  const struck = playCard({ ...battle, heroes: [target] }, 0, target.uid).heroes[0]!;
  assert.equal(struck.hp, takeHit(target, boosted, 'magic').hp);
  const statuses = { ...battle.player.statuses, poison: 5, burn: 7, hex: 3, shock: 4, bleed: 8 };
  const archer = { ...battle.heroes[0]!, uid: battle.nextUid, heroId: 'archer' as const, col: 1, row: 'back' as const };
  const suffer = (scorn: number) => endTurn({ ...battle, heroes: [...battle.heroes, archer], player: {
    ...battle.player, hp: 500, maxHp: 500, statuses,
    traits: { ...createCharacter().traits, scorn },
  } }).player;
  const low = suffer(0), high = suffer(64);
  assert.equal(high.hp, low.hp);
  assert.equal(high.shockDamageTaken, low.shockDamageTaken);
  assert.equal(high.bleedTaken, low.bleedTaken);
  assert.ok(high.shockDamageTaken && high.bleedTaken);
});

void test('Endurance scales the displayed and actual healing and respects missing HP', () => {
  const fight = traitFight('mend', { endurance: 64 });
  const wounded = { ...fight.player, hp: 1 };
  assert.ok(describeCard('mend', wounded).includes('Heal 10'));
  assert.equal(playCard({ ...fight, player: wounded }, 0, -1).player.hp, 11);
  const nearlyFull = { ...wounded, hp: wounded.maxHp - 1 };
  assert.equal(playCard({ ...fight, player: nearlyFull }, 0, -1).player.hp, nearlyFull.maxHp);
});

void test('excess accuracy gives Range and Magic double-damage crits but excludes Melee', () => {
  for (const id of ['spiteBolt', 'forkedBolt', 'backhand'] as const) {
    const fight = traitFight(id, { dexterity: 64 });
    const target = fight.heroes[0]!;
    const focussed = { ...fight, player: addStatus(fight.player, 'sharpshooter', 1) };
    const ranged = id !== 'backhand';
    assert.equal(aimCritChance(fight, 0, target), ranged ? 0.5 : 0);
    assert.equal(aimCritChance(focussed, 0, target), ranged ? 1 : 0);
    const base = describeCard(id, focussed.player, target).find(line => line.startsWith('Damage '))!;
    const perHit = Number(base.match(/\d+/)![0]);
    const result = playCard(focussed, 0, target.uid);
    assert.equal(target.hp - result.heroes[0]!.hp, perHit * (ranged ? 2 : 1) * (id === 'forkedBolt' ? 2 : 1));
  }
});
void test('combat history retains the latest ten events and records actual healing, buffs and deaths', () => {
  const battle = fightWith(['backhand']);
  const old = { ...battle, player: { ...battle.player, hp: 5 } };
  const next = { ...old, heroes: [], player: { ...old.player, hp: 8, statuses: { ...old.player.statuses, wrath: 2 } } };
  const history = recordEffects(old, next).playHistory!;
  assert.deepEqual(history.map(entry => 'event' in entry && entry.event), ['heal', 'status', 'death']);
  const ten = appendCombatHistory(undefined, ...Array.from({length: 14}, (_, turn) => ({turn, cardId: 'backhand' as const, cost: 1})));
  assert.deepEqual(ten.map(entry => entry.turn), [4,5,6,7,8,9,10,11,12,13]);
});

void test('Protection reduces all damaging afflictions after source scaling without spending Guard or Armor', () => {
  const unit = createCombatant(100, 100);
  const base = {
    ...unit,
    guard: 9,
    statuses: { ...unit.statuses, protection: 2, armor: 5, hex: 5, poison: 7, burn: 9, bleed: 8, shock: 5 },
  };
  const effects = [hexBurn(base), poisonTick(base), burnTick(base), bleedOnAttack(base, 8), burstShock(base)];
  assert.deepEqual(effects.map(x => 100 - x.hp), [5, 4, 5, 2, 5]);
  assert.ok(effects.every(x => x.guard === 9 && x.statuses.armor === 5));
  assert.equal(effects[3]!.bleedTaken, 2);
  assert.equal(effects[4]!.shockDamageTaken, 5);
  assert.deepEqual(effects.map((x, i) => x.statuses[(['hex','poison','burn','bleed','shock'] as const)[i]!]), [3, 6, 4, 7, 0]);
  const source = { ...unit, traits: { ...createCharacter().traits, scorn: 64 } };
  assert.equal(100 - poisonTick(base, source).hp, 6);
  assert.equal(100 - poisonTick({ ...base, statuses: { ...base.statuses, protection: 4 } }).hp, 1);
  assert.equal(hexBurn({ ...base, statuses: { ...base.statuses, hex: 4 } }).hp, 100);
});

void test('a future Protection trait can add a turn without changing Bulwark’s base duration', () => {
  const unit = createCombatant(100, 100);
  assert.equal(castCardProtection(unit).cardProtectionTurns, 2);
  const extended = castCardProtection(unit, 1);
  assert.equal(extended.cardProtectionTurns, 3);
  assert.equal(extended.cardProtectionDuration, 3);
  const once = tickStackingBuffs(extended);
  const twice = tickStackingBuffs(once);
  assert.equal(once.cardProtectionTurns, 2);
  assert.equal(twice.cardProtectionTurns, 1);
  assert.equal(twice.cardProtectionDuration, 3);
  assert.equal(twice.statuses.protection, 1);
  assert.equal(tickStackingBuffs(twice).statuses.protection, 0);
});

void test('Dispel is a targeted Magic card that removes one random buff, not Guard or afflictions', () => {
  const state = fightWith(['dispel']);
  const target = { ...state.heroes[0]!, guard: 8, statuses: { ...state.heroes[0]!.statuses, wrath: 4, poison: 3 } };
  const fight = { ...state, heroes: [target] };
  assert.equal(getCard('dispel').type, 'magic');
  assert.equal(targetRuleOf('dispel'), 'any');
  assert.ok(describeCard('dispel', state.player, target).includes('Dispel 1'));
  const result = playCard(fight, 0, target.uid);
  const hero = result.heroes[0]!;
  assert.equal(hero.statuses.wrath, 0);
  assert.equal(hero.statuses.poison, 3);
  assert.equal(hero.guard, 8);
  assert.equal(hero.hp, target.hp);
  assert.deepEqual(playCard(fight, 0, target.uid), result);
});

void test('Dispel N picks distinct buff slots and removes timers without triggering natural-expiry effects', () => {
  const base = createCombatant(100, 100);
  const unit = { ...base, guard: 5, cardProtectionTurns: 1, instinctTurns: 1,
    statuses: { ...base.statuses, protection: 4, instinct: 4, armor: 3, aloft: 1, enfeeble: 2 } };
  const [result, rng, removed] = dispelBuffs(unit, 2, 7, 3);
  assert.deepEqual(new Set(removed), new Set(['protection', 'instinct']));
  assert.equal(result.statuses.protection, 0);
  assert.equal(result.statuses.instinct, 0);
  assert.equal(result.cardProtectionTurns, 0);
  assert.equal(result.instinctTurns, 0);
  assert.equal(result.statuses.malaise, 0);
  assert.equal(result.statuses.armor, 3);
  assert.equal(result.statuses.aloft, 1);
  assert.equal(result.statuses.enfeeble, 2);
  assert.equal(result.guard, 5);
  assert.deepEqual(dispelBuffs(result, 2, rng, 3), [result, rng, []]);
});

void test('Archmage and High Priestess Maren can each dispel one player buff on their cast', () => {
  for (const heroId of ['archmage', 'maren'] as const) {
    const state = fightWith(['darkCloak']);
    const moveIndex = getHero(heroId).moves.findIndex(move => move.effects.some(effect => effect.kind === 'dispel'));
    assert.ok(moveIndex >= 0, heroId);
    const hero = { ...state.heroes[0]!, heroId, row: 'back' as const, moveIndex };
    assert.equal(describeHeroIntent(hero, [hero]).intents.find(intent => intent.kind === 'dispel')?.text, '1');
    const player = castCardProtection(state.player);
    const next = endTurn({ ...state, waveArrival: false, heroes: [hero], player });
    assert.equal(next.player.statuses.protection, 0, heroId);
    assert.equal(next.player.statuses.malaise, 0);
  }
});

void test('Back Step grants flat Reflex without touching Instinct, then Reflex expires after an enemy turn', () => {
  const base = fightWith(['retreat']);
  const fight = { ...base, waveArrival: false, player: { ...base.player, instinctTurns: 1,
    statuses: { ...base.player.statuses, instinct: 2 } } };
  for (const moved of [move(fight, 'backStep'), playCard(fight, 0, -1), moveFree(fight, 'backStep')]) {
    assert.equal(moved.player.statuses.reflex, 1);
    assert.equal(moved.player.statuses.instinct, 2);
    assert.equal(moved.player.instinctTurns, 1);
    assert.equal(moved.heroes[0]!.row, 'back');
    assert.equal(moveFree(moved, 'backStep'), moved, 'a failed Back Step grants nothing');
    assert.equal(endTurn(moved).player.statuses.reflex, 0);
  }
  const unit = base.player;
  const reflex = addStatus(addStatus(unit, 'reflex', 1), 'reflex', 1);
  assert.equal(reflex.statuses.reflex, 1);
  assert.equal(dodgeChanceAgainst(reflex), .25);
  assert.equal(dodgeChanceAgainst(addStatus(reflex, 'instinct', 3)), 1);
  assert.equal(dodgeChanceAgainst(addStatus(unit, 'instinct', 4)), .95);
});

void test('bonus Accuracy directly subtracts dodge without a global 95 percent cap', () => {
  const target = addStatus(createCombatant(100, 100), 'reflex', 1);
  assert.equal(dodgeChanceAgainst(target, .10), .15);
  assert.equal(dodgeChanceAgainst(target, .25), 0);
  assert.equal(dodgeChanceAgainst(target, .50), 0);
  const combined = addStatus(target, 'instinct', 4);
  assert.equal(dodgeChanceAgainst(combined, 0), 1);
  assert.ok(Math.abs(dodgeChanceAgainst(combined, .30) - .90) < 1e-9);
  const state = fightWith(['arcaneBolt']);
  const foe = { ...state.heroes[0]!, statuses: { ...state.heroes[0]!.statuses, reflex: 1 } };
  assert.equal(aimHitChance(state, 0, foe), .75);
  assert.equal(aimHitChance({ ...state, player: addStatus(state.player, 'sharpshooter', 1) }, 0, foe), 1);
});

void test('attack-reducing auto-target prioritizes announced multi-hit damage, not HP or single-hit size', () => {
  const base = startCombat({ hp: 60, maxHp: 60, deck: ['sap'],
    heroIds: ['holt', 'lysa', 'bard'], might: 1, seed: 7 });
  const holt = { ...base.heroes.find(unit => unit.heroId === 'holt')!, row: 'front' as const, moveIndex: 1, hp: 6 };
  const lysa = { ...base.heroes.find(unit => unit.heroId === 'lysa')!, row: 'back' as const, moveIndex: 0, hp: 30 };
  const bard = { ...base.heroes.find(unit => unit.heroId === 'bard')!, hp: 1 };
  const state = { ...base, heroes: [holt, lysa, bard] };
  for (const card of ['sap', 'sapStrength', 'sneer', 'frostBolt'] as const) {
    const hand = withHand(state, [card]);
    assert.deepEqual(autoTargets(hand, 0), [lysa.uid], card);
    assert.deepEqual(autoTargets(hand, 0, [holt.uid]), [holt.uid], 'an explicit target stays selected');
  }
  const debuffedLysa = { ...lysa, statuses: { ...lysa.statuses, enfeeble: 4 } };
  assert.deepEqual(autoTargets(withHand({ ...state, heroes: [holt, debuffedLysa, bard] }, ['sap']), 0), [holt.uid]);
  assert.deepEqual(autoTargets(withHand(state, ['backhand']), 0), [holt.uid], 'ordinary attacks keep their original ranking');
});

void test('Disrupt lowers one random buff or affliction by N without stripping the whole effect', () => {
  const base = createCombatant(40, 40);
  const buff = { ...base, cardProtectionTurns: 1, statuses: { ...base.statuses, protection: 4 } };
  const [weakened, , which] = disruptStatus(buff, 1, 7);
  assert.equal(which, 'protection');
  assert.equal(weakened.statuses.protection, 3);
  assert.equal(weakened.cardProtectionTurns, 1);
  assert.equal(weakened.statuses.malaise, 0);
  const shocked = { ...base, guard: 6, shockHits: 2, statuses: { ...base.statuses, shock: 3, armor: 4, aloft: 1 } };
  const [lowered, rng] = disruptStatus(shocked, 1, 7, 4);
  assert.equal(lowered.statuses.shock, 2);
  assert.equal(lowered.shockHits, 2);
  const [cleared] = disruptStatus(lowered, 2, rng, 4);
  assert.equal(cleared.statuses.shock, 0);
  assert.equal(cleared.shockHits, 0);
  assert.equal(cleared.guard, 6);
  assert.equal(cleared.statuses.armor, 4);
  assert.equal(cleared.statuses.aloft, 1);
  assert.equal(describeCardEffect({ kind: 'disrupt', amount: 1, target: 'one' }, getCard('dispel')), 'Disrupt 1');
});

void test('only curses may target the portrait; even area curses affect just the player', () => {
  const initial = fightWith(['backhand']);
  const stored = { ...initial, heroes: initial.heroes.map(hero => ({ ...hero, row: 'back' as const })) };
  assert.equal(canPlayCard(stored, 0), false);
  assert.equal(canPlayCardOnSelf(stored, 0), false);
  assert.equal(playCard(stored, 0, SELF_TARGET_UID), stored);
  const curse = withHand(stored, ['sap']);
  assert.equal(canPlayCardOnSelf(curse, 0), true);
  const cursed = playCard(curse, 0, SELF_TARGET_UID);
  assert.equal(cursed.player.statuses.enfeeble, 3);
  assert.equal(cursed.player.statuses.hex, 1);
  assert.deepEqual(cursed.heroes, stored.heroes);
  const plague = withHand(initial, ['plague']);
  const afflicted = playCard(plague, 0, SELF_TARGET_UID);
  assert.equal(afflicted.player.statuses.hex, 4);
  assert.deepEqual(afflicted.heroes, plague.heroes);
  const lowEnergy = { ...plague, energy: 1 };
  assert.equal(playCard(lowEnergy, 0, SELF_TARGET_UID), lowEnergy);
});

void test('manual targeting rejects other card types and mixed targets without changing native buffs or healing', () => {
  const initial = fightWith(['mourningCurse']);
  const uid = initial.heroes[0]!.uid;
  for (const cardId of ['cleave', 'mend', 'bulwark'] as const) {
    const state = withHand(initial, [cardId]);
    assert.equal(canPlayCardOnSelf(state, 0), false);
    assert.equal(playCard(state, 0, SELF_TARGET_UID), state);
  }
  const buffs = withHand(initial, ['bulwark']);
  assert.equal(playCard(buffs, 0, uid).player.statuses.protection, 1);
  const hurt = withHand({ ...initial, player: { ...initial.player, hp: 10 } }, ['mend']);
  assert.equal(playCard(hurt, 0, uid).player.hp, 17);
  assert.equal(playCard(initial, 0, SELF_TARGET_UID, [uid]), initial);
  assert.equal(playCard(initial, 0, uid, [SELF_TARGET_UID]), initial);
});

void test('Mass Disrupt costs two energy and applies Disrupt 5 separately to every enemy', () => {
  const initial = startCombat({ hp: 60, maxHp: 60, deck: ['massDisrupt'],
    heroIds: ['squire', 'archer'], might: 1, seed: 7 });
  const first = initial.heroes[0]!, second = initial.heroes[1]!;
  const state = { ...initial, heroes: [
    { ...first, statuses: { ...first.statuses, wrath: 8 } },
    { ...second, statuses: { ...second.statuses, poison: 6 } },
  ] };
  assert.equal(getCard('massDisrupt').type, 'magic');
  assert.equal(targetRuleOf('massDisrupt'), 'none');
  assert.ok(describeCard('massDisrupt').some(line => line.includes('Disrupt 5')));
  const played = playCard(state, 0, first.uid);
  assert.equal(played.energy, state.energy - 2);
  assert.equal(played.heroes[0]!.statuses.wrath, 3);
  assert.equal(played.heroes[1]!.statuses.poison, 1);
  assert.equal(played.heroes[0]!.hp, first.hp);
  assert.equal(played.heroes[1]!.hp, second.hp);
});

void test('Mass Disrupt lowers every debuff, then caps the enemy’s next attacks at one hit', () => {
  const base = startCombat({ hp: 60, maxHp: 60, deck: ['massDisrupt'],
    heroIds: ['archer'], might: 1, seed: 7 });
  const enemy = { ...base.heroes[0]!, row: 'back' as const, moveIndex: 0,
    statuses: { ...base.heroes[0]!.statuses, hex: 5, bleed: 4, poison: 6, wrath: 2 } };
  const state = { ...base, waveArrival: false, heroes: [enemy] };
  const normal = plannedHeroMove(enemy, [enemy])?.move.effects.find(effect => effect.kind === 'attack');
  assert.ok(normal && normal.hits > 1);
  const played = playCard(state, 0, enemy.uid);
  const affected = played.heroes[0]!;
  assert.equal(affected.statuses.hex, 0);
  assert.equal(affected.statuses.bleed, 0);
  assert.equal(affected.statuses.poison, 1);
  assert.equal(affected.statuses.wrath, 0);
  assert.equal(affected.statuses.hitLimit, 1);
  const limited = plannedHeroMove(affected, [affected])?.move.effects.find(effect => effect.kind === 'attack');
  assert.deepEqual(limited, { ...normal, hits: 1 });
  const round = endTurn(played);
  assert.equal(round.heroes[0]?.statuses.hitLimit, 0);
  assert.equal(round.player.hp, played.player.hp - Math.round(normal.amount * 1.3));
  assert.ok(describeCard('massDisrupt').includes('Max 1 hit for 1 turn'));
});

void test('combat history records each unit’s dodge count delta, including a unit fallen on a later hit', () => {
  const state = fightWith(['backhand']);
  const old = { ...state, player: { ...state.player, dodgedHits: 1, missedShots: 1 } };
  const enemy = old.heroes[0]!;
  const next = { ...old, player: { ...old.player, dodgedHits: 3, missedShots: 4 },
    heroes: [], fallen: [{ ...enemy, hp: 0, dodgedHits: 1 }] };
  const history = recordEffects(old, next).playHistory!;
  assert.deepEqual(history, [
    { event: 'dodge', turn: old.turn, subject: 'Villain', detail: 'Dodged ×2' },
    { event: 'dodge', turn: old.turn, subject: 'Squire', detail: 'Dodged' },
    { event: 'death', turn: old.turn, subject: 'Squire', detail: 'Defeated' },
  ]);
  assert.equal(recordEffects(next, next).playHistory, next.playHistory);
});

// --- SHOCK CHAIN ---
/** Squire on its 4th Shock hit, Archer shocked too, both in reach. */
const chainReady = (): CombatState => {
  const start = squireAndArcher(['backhand']);
  const [squire, archer] = start.heroes;
  const charge = (shockHits: number) => ({
    row: 'front' as const, hp: 80, maxHp: 80, guard: 0, shockHits,
  });
  return {
    ...start,
    energy: 3,
    heroes: [
      { ...squire!, ...charge(3), statuses: { ...squire!.statuses, shock: 5 } },
      { ...archer!, ...charge(0), statuses: { ...archer!.statuses, shock: 4 } },
    ],
  };
};

void test('one Shock going off sets off every other Shock on the field', () => {
  const state = chainReady();
  const [squire, archer] = state.heroes;
  const after = playCard(state, 0, squire!.uid);
  const archerAfter = after.heroes.find((unit) => unit.uid === archer!.uid)!;
  assert.equal(archerAfter.statuses.shock, 0);
  assert.equal(archerAfter.shockBursts, 1);
  // Never hit by the card: all it lost is its own burst (4 x 2).
  assert.equal(archerAfter.hp, 80 - 4 * SHOCK_BURST_FACTOR);
});

void test('the chained Shock goes off on its own beat, after the burst that set it off', () => {
  const state = chainReady();
  const [squire, archer] = state.heroes;
  const beats = playCardSteps(state, 0, squire!.uid).slice(0, -1);
  const burstsOf = (beat: CombatState, uid: number) =>
    beat.heroes.find((unit) => unit.uid === uid)!.shockBursts ?? 0;
  const first = beats.findIndex((beat) => burstsOf(beat, squire!.uid) === 1);
  const chained = beats.findIndex((beat) => burstsOf(beat, archer!.uid) === 1);
  assert.ok(first >= 0 && chained === first + 1);
});

void test('a Shock chain leaves heroes with no Shock alone', () => {
  const state = chainReady();
  const [squire, archer] = state.heroes;
  const calm = { ...state, heroes: [squire!, { ...archer!, statuses: { ...archer!.statuses, shock: 0 } }] };
  const after = playCard(calm, 0, squire!.uid);
  assert.equal(after.heroes.find((unit) => unit.uid === archer!.uid)!.hp, 80);
});
