// ===================================================================
// THREE-ROW FIELD TESTS
// The Front line, the Backline and the Horizon: moving between rows,
// Charge and Back Step, Piercing down a column, Out of Range misses
// (both ways), Longrange, and the cap on cells heroes may fill.
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceHeroes,
  canPull,
  canPush,
  cellsOf,
  freeHeroCells,
  heroesPiercedPast,
  pullHero,
  pushHero,
  summonSeats,
} from './battlefield.ts';
import { type CardId } from './cards.ts';
import {
  aimHitChance,
  dodgeChanceOf,
  endTurn,
  endTurnSteps,
  hasLongRangePassive,
  playCard,
  startCombat,
  targetsFor,
} from './combat.ts';
import { describeHeroIntent } from './describe.ts';
import { FEATURES } from './features.ts';
import { RESERVE_SPOTS_PER_LINE } from './rules.ts';
import { canImbueOnto } from './imbue.ts';
import { getHero, type HeroId } from './heroes.ts';
import { canMove, move, movementBlockReason } from './movement.ts';
import {
  SANDBOX_SCENARIOS,
  createSandboxWith,
  sandboxReducer,
} from './sandbox.ts';
import {
  BATTLEFIELD_COLUMNS,
  MAX_HERO_CELLS,
  OUT_OF_RANGE_HIT_CHANCE,
} from './rules.ts';
import type { CombatState, HeroRow, HeroUnit } from './types.ts';

// This file plays the three-row field (off by default, see features.ts).
FEATURES.threeRowField = true;

// --- FIXTURES ---
/** Where to stand one hero: its catalog id, row and column. */
type Spot = [HeroId, HeroRow, number];

/**
 * A fight with heroes standing exactly at `spots` (uids in spot order),
 * the given hand, plenty of energy, and the rng seeded with `seed`.
 */
const fightAt = (spots: Spot[], hand: CardId[] = [], seed = 3): CombatState => {
  const fresh = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['darkCloak'],
    heroIds: spots.map(([heroId]) => heroId),
    might: 1,
    seed,
  });
  return {
    ...fresh,
    heroes: fresh.heroes.map((unit, index) => {
      const [, row, col] = spots[index] ?? ['squire', 'front', 0];
      // uid = spot index, so tests can name heroes by their spot.
      return { ...unit, uid: index, row, col };
    }),
    nextUid: spots.length,
    hand,
    energy: 20,
  };
};

/** The hero with this uid (it must be on the field). */
const unitAt = (state: CombatState, uid: number): HeroUnit => {
  const unit = state.heroes.find((hero) => hero.uid === uid);
  if (!unit) throw new Error(`uid ${uid} is not on the field`);
  return unit;
};

/** "row:col" for each hero, in uid order. */
const placesOf = (heroes: readonly HeroUnit[]): string[] =>
  [...heroes]
    .sort((a, b) => a.uid - b.uid)
    .map((unit) => `${unit.row}:${unit.col}`);

void test('Spiked Guard can strike a Paladin backed by Valen', () => {
  const state = fightAt(
    [
      ['paladin', 'front', 0],
      ['valen', 'back', 0],
      ['archer', 'back', 2],
    ],
    ['spikedGuard']
  );
  const paladin = unitAt(state, 0);
  // Its line behind is full, but Knockback can still put it in a reserve spot.
  assert.equal(canPush(state.heroes, paladin), true);
  for (const id of ['spikedGuard', 'ruin', 'hurlAside'] as const) {
    assert.deepEqual(
      targetsFor(state, id).map((unit) => unit.uid),
      [paladin.uid]
    );
  }
  const after = playCard(state, 0, paladin.uid);
  assert.ok(
    unitAt(after, 0).hp + unitAt(after, 0).guard < paladin.hp + paladin.guard
  );
  assert.equal(after.player.guard, state.player.guard + 5);
  assert.equal(unitAt(after, 1).hp, unitAt(state, 1).hp);
  // Line 2 is full, so the Knockback puts the Paladin in a reserve spot.
  assert.equal(unitAt(after, 0).row, 'back');
  assert.equal(unitAt(after, 0).inReserve, true);
});

// --- FORMATION AND ADVANCING ---
void test('Killing Spree requires three fresh kills in one hit, then pays one to draw three and gain three', () => {
  const start = fightAt([
    ['squire', 'front', 0],
    ['squire', 'front', 1],
    ['squire', 'front', 2],
    ['archer', 'back', 0],
  ]);
  const field = {
    ...start,
    energy: 6,
    heroes: start.heroes.map((hero) => ({
      ...hero,
      hp: hero.row === 'front' ? 1 : 20,
    })),
    drawPile: Array<CardId>(3).fill('darkCloak'),
  };
  const locked = { ...field, hand: ['killingSpree'] as CardId[] };
  assert.equal(playCard(locked, 0, -1), locked);
  let separate = {
    ...field,
    hand: ['backhand', 'backhand', 'backhand', 'killingSpree'] as CardId[],
  };
  for (const uid of [0, 1, 2]) separate = playCard(separate, 0, uid);
  assert.equal(separate.slain, 3);
  assert.equal(playCard(separate, 0, -1), separate);
  const unlocked = playCard(
    { ...field, hand: ['cleave', 'killingSpree'] },
    0,
    -1
  );
  const result = playCard(unlocked, 0, -1);
  assert.deepEqual(result.hand, ['darkCloak', 'darkCloak', 'darkCloak']);
  assert.equal(result.energy, unlocked.energy + 2);
  assert.ok(result.discardPile.includes('killingSpree'));
});

void test('Knockback 2 crosses a full row and shoves the landing occupant sideways', () => {
  for (const blockedSide of [0, 2]) {
    const state = fightAt(
      [
        ['squire', 'front', 1],
        ['archer', 'back', 0],
        ['archer', 'back', 1],
        ['archer', 'back', 2],
        ['archer', 'horizon', 1],
        ['ballista', 'horizon', blockedSide],
      ],
      ['forcePush', 'darkCloak', 'followUp', 'followUp']
    );
    assert.ok(targetsFor(state, 'forcePush').some((hero) => hero.uid === 0));
    const pushed = playCard(state, 0, 0);
    assert.equal(unitAt(pushed, 0).row, 'horizon');
    assert.equal(unitAt(pushed, 0).col, 1);
    assert.equal(unitAt(pushed, 4).col, 2 - blockedSide);
    assert.equal(unitAt(pushed, 5).col, blockedSide);
    const defended = playCard(pushed, 0, -1);
    const boosted = playCard(defended, 0, -1);
    assert.equal(boosted.energy, defended.energy);
    assert.equal(boosted.player.statuses.move, 2);
    const second = playCard(boosted, 0, -1);
    assert.equal(second.energy, boosted.energy - 1);
    assert.equal(endTurn(pushed).followUpReady, false);
  }
});

void test('Move 2 boosts the next Charge or Back Step and is then spent', () => {
  for (const row of ['front', 'horizon'] as const) {
    const state = fightAt([['squire', row, 1]], ['followUp']);
    const ready = playCard(state, 0, -1);
    assert.equal(ready.energy, state.energy - 1);
    const moved = move(ready, row === 'front' ? 'backStep' : 'charge');
    assert.equal(unitAt(moved, 0).row, row === 'front' ? 'horizon' : 'front');
    assert.equal(moved.player.statuses.move, 0);
  }
});

void test('Siege Blast damages the front line and pushes its survivors up to two rows', () => {
  const fight = fightAt(
    [
      ['squire', 'front', 0],
      ['archer', 'back', 1],
      ['priest', 'horizon', 2],
    ],
    ['siegeBlast']
  );
  const state = {
    ...fight,
    heroes: fight.heroes.map((hero) => ({
      ...hero,
      hp: 50,
      maxHp: 50,
      guard: 0,
    })),
  };
  const after = playCard(state, 0, -1);
  assert.equal(after.energy, state.energy - 2);
  assert.deepEqual(
    after.heroes.map((hero) => [hero.hp, hero.row]),
    [
      [38, 'horizon'],
      [50, 'back'],
      [50, 'horizon'],
    ]
  );
  const emptyFront = {
    ...state,
    heroes: state.heroes.filter((hero) => hero.row !== 'front'),
  };
  assert.equal(playCard(emptyFront, 0, -1), emptyFront);
  const lethal = {
    ...state,
    heroes: state.heroes.map((hero) =>
      hero.row === 'front' ? { ...hero, hp: 1 } : hero
    ),
  };
  const kill = playCard(lethal, 0, -1);
  assert.equal(kill.slain, 1);
  assert.equal(kill.freeMove?.move, 'charge');
});

void test('replacement waves fill the Horizon and overflow into the Backline', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const state = fightAt([['squire', 'front', 1]], ['cataclysm'], seed);
    const next = sandboxReducer(
      {
        ...state,
        heroes: state.heroes.map((hero) => ({ ...hero, hp: 1 })),
      },
      { type: 'playCard', handIndex: 0, targetUid: 0 }
    );
    const cells = next.heroes.flatMap(cellsOf);
    const horizonCells = cells.filter((cell) => cell.row === 'horizon').length;
    assert.ok(horizonCells > 0);
    for (const hero of next.heroes.filter((unit) => unit.row === 'back')) {
      assert.ok(cellsOf(hero).length > BATTLEFIELD_COLUMNS * 2 - horizonCells);
    }
    assert.ok(cells.every((cell) => cell.row !== 'front'));
    assert.equal(
      new Set(cells.map((cell) => cell.row + cell.col)).size,
      cells.length
    );
  }
});

void test('a horde marches in a row behind home, then heads home', () => {
  const fresh = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['darkCloak'],
    heroIds: ['squire', 'priest'],
    might: 1,
    seed: 1,
  });
  assert.deepEqual(
    fresh.heroes.map((unit) => unit.row),
    ['back', 'horizon']
  );
  const after = endTurn(fresh);
  assert.deepEqual(
    after.heroes.map((unit) => unit.row),
    ['front', 'back']
  );
});

void test('heroes step one row toward home per turn, never past it', () => {
  const heroes = fightAt([
    ['squire', 'horizon', 0],
    ['priest', 'horizon', 2],
    ['archer', 'front', 1],
  ]).heroes;
  // The Squire comes in one row (not two); the Priest reaches the
  // Backline; the Archer retreats to the same row.
  assert.deepEqual(placesOf(advanceHeroes(heroes)), [
    'back:0',
    'back:2',
    'back:1',
  ]);
});

// --- RESERVE SPOTS ---
void test('Knockback or Pull into a full line uses a reserve spot', () => {
  const heroes = fightAt([
    ['squire', 'front', 0],
    ['priest', 'back', 0],
    ['archer', 'back', 1],
    ['rogue', 'back', 2],
  ]).heroes;
  const [squire] = heroes;
  assert.ok(squire);
  // Line 2 is full: the Squire is knocked back into a reserve spot there.
  const pushed = pushHero(heroes, squire.uid);
  const moved = unitAt({ heroes: pushed } as CombatState, squire.uid);
  assert.equal(moved.row, 'back');
  assert.equal(moved.inReserve, true);
  assert.equal(RESERVE_SPOTS_PER_LINE, 2);
  // Pulled back out, it takes a real seat again.
  const pulled = pullHero(pushed, squire.uid);
  const back = unitAt({ heroes: pulled } as CombatState, squire.uid);
  assert.equal(back.row, 'front');
  assert.equal(back.inReserve, false);
  // Walking (voluntary) never uses a reserve spot.
  assert.equal(advanceHeroes(heroes).length, heroes.length);
});

// --- PULL N AND KNOCKBACK N ---
void test('Pull 2 and Knockback 2 move a hero two rows', () => {
  const heroes = fightAt([
    ['squire', 'front', 1],
    ['priest', 'horizon', 1],
  ]).heroes;
  const [squire, priest] = heroes;
  assert.ok(squire && priest);
  const rowAfter = (field: typeof heroes, uid: number) =>
    unitAt({ heroes: field } as CombatState, uid).row;
  assert.equal(rowAfter(pullHero(heroes, priest.uid, 2), priest.uid), 'front');
  assert.equal(
    rowAfter(pushHero(heroes, squire.uid, 2), squire.uid),
    'horizon'
  );
  // Only one row of room: it goes as far as it can.
  assert.equal(rowAfter(pullHero(heroes, squire.uid, 2), squire.uid), 'front');
  const backPriest = pullHero(heroes, priest.uid);
  assert.equal(
    rowAfter(pullHero(backPriest, priest.uid, 2), priest.uid),
    'front'
  );
});

// --- PULL AND PUSH (ONE ROW AT A TIME) ---
void test('Force Pull and Force Push move a hero exactly one row', () => {
  const heroes = fightAt([
    ['squire', 'front', 1],
    ['priest', 'horizon', 1],
  ]).heroes;
  const [squire, priest] = heroes;
  assert.ok(squire && priest);
  assert.equal(
    unitAt({ heroes: pullHero(heroes, priest.uid) } as CombatState, priest.uid)
      .row,
    'back'
  );
  assert.equal(
    unitAt({ heroes: pushHero(heroes, squire.uid) } as CombatState, squire.uid)
      .row,
    'back'
  );
  assert.equal(canPull(heroes, squire), false, 'nothing nearer than front');
  assert.equal(canPush(heroes, priest), false, 'nothing past the Horizon');
});

// --- CHARGE AND BACK STEP ---
void test('Charge closes exactly one row', () => {
  const farOff = move(
    fightAt([
      ['squire', 'horizon', 0],
      ['priest', 'horizon', 2],
    ]),
    'charge'
  );
  assert.deepEqual(placesOf(farOff.heroes), ['back:0', 'back:2']);
  const split = move(
    fightAt([
      ['squire', 'back', 0],
      ['priest', 'horizon', 2],
    ]),
    'charge'
  );
  assert.deepEqual(placesOf(split.heroes), ['front:0', 'back:2']);
  assert.equal(split.player.statuses.momentum, 1);
});

void test('Back Step always falls back exactly one row', () => {
  const after = move(
    fightAt([
      ['squire', 'front', 0],
      ['shieldmaiden', 'front', 2],
    ]),
    'backStep'
  );
  assert.deepEqual(placesOf(after.heroes), ['back:0', 'back:2']);
});

void test('Back Step works with heroes behind Line 1, when there is room', () => {
  const state = fightAt([
    ['lysa', 'front', 0],
    ['squire', 'horizon', 1],
  ]);
  assert.ok(canMove(state, 'backStep'));
  // Lysa falls back to Line 2; the Squire is already on the last line.
  assert.deepEqual(placesOf(move(state, 'backStep').heroes), [
    'back:0',
    'horizon:1',
  ]);
});

void test('Back Step moves everyone back a line where there is room', () => {
  const after = move(
    fightAt([
      ['squire', 'front', 0],
      ['priest', 'back', 2],
    ]),
    'backStep'
  );
  assert.deepEqual(placesOf(after.heroes), ['back:0', 'horizon:2']);
});

void test('with nobody on Line 1 there is no Back Step (Charge instead)', () => {
  const state = fightAt([['squire', 'back', 0]]);
  assert.equal(canMove(state, 'backStep'), false);
  assert.ok(canMove(state, 'charge'));
});

void test('a deep boss Back Steps as a whole, then walks back in', () => {
  const state = fightAt([['grandGriffon', 'front', 1]]);
  assert.ok(canMove(state, 'backStep'));
  assert.equal(movementBlockReason(state, 'backStep'), null);
  const after = move(state, 'backStep');
  const griffon = unitAt(after, 0);
  assert.deepEqual(
    cellsOf(griffon).map((cell) => `${cell.row}:${cell.col}`),
    ['back:1', 'back:1.5', 'horizon:1', 'horizon:1.5']
  );
  // Still immovable by Force Pull / Push.
  assert.equal(canPull(after.heroes, griffon), false);
  assert.equal(
    unitAt({ heroes: advanceHeroes(after.heroes) } as CombatState, 0).row,
    'front'
  );
});

// --- PIERCING ---
void test('Piercing runs down the whole column, every row', () => {
  const state = fightAt(
    [
      ['squire', 'front', 0],
      ['priest', 'back', 0],
      ['bard', 'horizon', 0],
      ['rogue', 'back', 2],
    ],
    ['impale']
  );
  const [squire, priest, bard] = state.heroes;
  assert.ok(squire && priest && bard);
  assert.deepEqual(
    heroesPiercedPast(state.heroes, priest).map((unit) => unit.heroId),
    ['squire', 'bard']
  );
  // Impale is Melee: Out of Range never applies, so all three are hit.
  const after = playCard(state, 0, squire.uid);
  for (const unit of [squire, priest, bard])
    assert.ok(unitAt(after, unit.uid).hp < unit.hp, unit.heroId);
  assert.equal(unitAt(after, 3).hp, unitAt(state, 3).hp, 'other column');
});

// --- OUT OF RANGE ---
/** Plays `cardId` at a Priest on the Horizon, once per seed. */
const shotsIntoHorizon = (cardId: CardId, seeds: number) =>
  Array.from({ length: seeds }, (_, index) => {
    const state = fightAt([['priest', 'horizon', 1]], [cardId], index + 1);
    const priest = unitAt(state, 0);
    const after = playCard(state, 0, priest.uid);
    // A big enough shot slays the Priest outright: that landed too.
    const hit = after.heroes.find((unit) => unit.uid === priest.uid);
    return {
      landed: hit === undefined || hit.hp < priest.hp,
      missed: (hit?.missedShots ?? 0) > 0,
    };
  });

void test('Range and Magic shots into the Horizon land about half the time', () => {
  for (const cardId of ['spiteBolt', 'hexfire'] as CardId[]) {
    const shots = shotsIntoHorizon(cardId, 200);
    const landed = shots.filter((shot) => shot.landed).length / shots.length;
    assert.ok(
      Math.abs(landed - OUT_OF_RANGE_HIT_CHANCE) < 0.12,
      `${cardId}: ${landed}`
    );
    // Every shot either lands or counts as a miss, never both.
    assert.ok(shots.every((shot) => shot.landed !== shot.missed));
  }
});

/** Like shotsIntoHorizon, with the villain already a Sharpshooter. */
const sharpshotsIntoHorizon = (cardId: CardId, seeds: number) =>
  Array.from({ length: seeds }, (_, index) => {
    const base = fightAt([['priest', 'horizon', 1]], [cardId], index + 1);
    const state = {
      ...base,
      player: {
        ...base.player,
        statuses: { ...base.player.statuses, sharpshooter: 1 },
      },
    };
    const after = playCard(state, 0, unitAt(state, 0).uid);
    return (after.heroes[0]?.missedShots ?? 0) > 0;
  });

void test('Sharpshooter shots into the Horizon never miss', () => {
  for (const cardId of ['spiteBolt', 'hexfire'] as CardId[])
    assert.ok(!sharpshotsIntoHorizon(cardId, 60).some(Boolean), cardId);
});

void test("the aim shows a shot's hit chance: 50% into Line 3, 100% with Sharpshooter", () => {
  const state = fightAt([['priest', 'horizon', 1]], ['spiteBolt', 'backhand']);
  const priest = unitAt(state, 0);
  assert.equal(aimHitChance(state, 0, priest), OUT_OF_RANGE_HIT_CHANCE);
  assert.equal(aimHitChance(state, 1, priest), 1, 'Melee is never a shot');
  const sharp = {
    ...state,
    player: {
      ...state.player,
      statuses: { ...state.player.statuses, sharpshooter: 1 },
    },
  };
  assert.equal(aimHitChance(sharp, 0, priest), 1);
});

void test('the same shot into the Backline always lands', () => {
  const state = fightAt([['priest', 'back', 1]], ['spiteBolt']);
  const after = playCard(state, 0, 0);
  assert.ok(unitAt(after, 0).hp < unitAt(state, 0).hp);
});

void test('a miss is seeded: the same fight misses the same way', () => {
  assert.deepEqual(
    shotsIntoHorizon('spiteBolt', 20),
    shotsIntoHorizon('spiteBolt', 20)
  );
});

void test('Longrange cards never miss into the Horizon', () => {
  const shots = shotsIntoHorizon('soulLance', 40);
  assert.ok(shots.every((shot) => shot.landed));
});

void test('an Eagle Eye imbue gives a shot Longrange', () => {
  const shots = Array.from({ length: 40 }, (_, index) => {
    const state = fightAt(
      [['priest', 'horizon', 1]],
      ['eagleEye', 'spiteBolt'],
      index + 1
    );
    const imbued = playCard(state, 0, -1, undefined, 1);
    const after = playCard(imbued, 0, 0);
    return unitAt(after, 0).hp < unitAt(state, 0).hp;
  });
  assert.ok(shots.every(Boolean));
});

void test('an imbue only lands with a shot that lands', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const state = fightAt(
      [['priest', 'horizon', 1]],
      ['venomCoat', 'spiteBolt'],
      seed
    );
    const after = playCard(playCard(state, 0, -1, undefined, 1), 0, 0);
    const priest = after.heroes.find((unit) => unit.uid === 0);
    if (!priest) continue;
    const isHit = priest.hp < unitAt(state, 0).hp;
    assert.equal((priest.statuses.poison ?? 0) > 0, isHit, `seed ${seed}`);
  }
});

void test('Longrange goes on Range and Magic damage cards only', () => {
  const gift = { kind: 'keyword', keyword: 'longRange' } as const;
  assert.equal(canImbueOnto(gift, 'spiteBolt', []), true);
  assert.equal(canImbueOnto(gift, 'hexfire', []), true);
  assert.equal(canImbueOnto(gift, 'backhand', []), false);
  assert.equal(canImbueOnto(gift, 'boneWard', []), false);
});

/** How a Priest's Shock (Magic) from `row` lands on the villain, per seed. */
const shocksFrom = (heroId: HeroId, row: HeroRow, seeds: number) =>
  Array.from({ length: seeds }, (_, index) => {
    const state = fightAt([[heroId, row, 1]], [], index + 1);
    const steps = endTurnSteps(state);
    const acted = steps[1]?.state ?? state;
    return {
      landed: acted.player.hp < state.player.hp,
      missed: (acted.player.missedShots ?? 0) > 0,
    };
  });

void test('heroes shooting from the Horizon land about half the time', () => {
  const shots = shocksFrom('priest', 'horizon', 200);
  const landed = shots.filter((shot) => shot.landed).length / shots.length;
  assert.ok(Math.abs(landed - OUT_OF_RANGE_HIT_CHANCE) < 0.12, `${landed}`);
  assert.ok(shocksFrom('priest', 'back', 30).every((shot) => shot.landed));
});

void test('the Archer has no Longrange: it misses from the Horizon too', () => {
  // Its Volley fires 3 arrows, so count the turns where one missed.
  const shots = shocksFrom('archer', 'horizon', 40);
  assert.ok(shots.some((shot) => shot.missed));
});

void test('the Ballista fills 1 cell (drawn wider) and has Longrange', () => {
  const state = fightAt([['ballista', 'back', 0]]);
  const ballista = unitAt(state, 0);
  assert.equal(getHero('ballista').size, 1);
  assert.equal(freeHeroCells(state.heroes), MAX_HERO_CELLS - 1);
  assert.ok(hasLongRangePassive(ballista));
  // Its bolts land from Line 3, where other shooters miss.
  const shots = Array.from({ length: 30 }, (_, index) => {
    const far = fightAt([['ballista', 'horizon', 0]], [], index + 1);
    const steps = endTurnSteps(far);
    return steps.some((step) => step.state.player.hp < far.player.hp);
  });
  assert.ok(shots.every(Boolean));
});

void test('the Ballista is Anchored: nothing pushes it, but you can close in', () => {
  const state = fightAt([
    ['squire', 'front', 0],
    ['ballista', 'back', 1],
  ]);
  const ballista = unitAt(state, 1);
  assert.equal(canPull(state.heroes, ballista), false);
  assert.equal(canPush(state.heroes, ballista), false);
  // You step back: it holds its line, the others fall back around it.
  assert.deepEqual(placesOf(move(state, 'backStep').heroes), [
    'back:0',
    'back:1',
  ]);
  // Alone, you can Charge up to it and hit it in Melee.
  const lone = fightAt([['ballista', 'back', 1]]);
  assert.ok(canMove(lone, 'charge'));
  assert.equal(unitAt(move(lone, 'charge'), 0).row, 'front');
  for (const row of ['front', 'back', 'horizon'] as const) {
    const placed = fightAt([['ballista', row, 1]]);
    assert.deepEqual(advanceHeroes(placed.heroes), placed.heroes);
  }
  // It starts and holds on the farthest line.
  const fresh = startCombat({
    hp: 60,
    maxHp: 60,
    deck: ['darkCloak'],
    heroIds: ['ballista'],
    might: 1,
    seed: 1,
  });
  assert.equal(fresh.heroes[0]?.row, 'horizon', 'starts farthest back');
  const far = fightAt([['ballista', 'horizon', 1]]);
  assert.equal(advanceHeroes(far.heroes)[0]?.row, 'horizon');
});

void test('Anchored units hold their line on Charge and Back Step; others go around', () => {
  // Charge: the Shieldmaiden behind the Ballista slides beside it.
  const charging = fightAt([
    ['ballista', 'back', 1],
    ['shieldmaiden', 'horizon', 1],
  ]);
  const charged = move(charging, 'charge').heroes;
  assert.equal(unitAt({ ...charging, heroes: charged }, 0).row, 'back');
  assert.equal(unitAt({ ...charging, heroes: charged }, 0).col, 1);
  const maiden = unitAt({ ...charging, heroes: charged }, 1);
  assert.equal(maiden.row, 'back', 'the Shieldmaiden still closes in');
  assert.notEqual(maiden.col, 1, 'beside the Ballista, not on it');
  // Back Step: the Shieldmaiden in front falls back beside it.
  const stepping = fightAt([
    ['shieldmaiden', 'front', 1],
    ['ballista', 'back', 1],
  ]);
  const stepped = move(stepping, 'backStep').heroes;
  assert.equal(unitAt({ ...stepping, heroes: stepped }, 1).row, 'back');
  assert.equal(unitAt({ ...stepping, heroes: stepped }, 0).row, 'back');
  // A Ballista knockback moves the field, not the Ballista itself.
  const knocked = endTurn(ballistaFight(0));
  assert.equal(unitAt(knocked, 1).row, 'horizon');
});

/** A Ballista on Line 3 about to make move `moveIndex`, a Squire on Line 1. */
const ballistaFight = (moveIndex: number): CombatState => {
  const state = fightAt([
    ['squire', 'front', 0],
    ['ballista', 'horizon', 1],
  ]);
  return {
    ...state,
    heroes: state.heroes.map((unit) =>
      unit.heroId === 'ballista' ? { ...unit, moveIndex } : unit
    ),
  };
};

void test('a Ballista bolt knocks you back 1 line (no walking in after)', () => {
  const state = ballistaFight(0);
  const after = endTurn(state);
  assert.ok(after.player.hp < state.player.hp, 'the bolt lands');
  assert.equal(unitAt(after, 0).row, 'back', 'the Squire is a line farther');
});

void test('the Siege Bolt hits harder and knocks you back 2 lines', () => {
  const siegeIndex = getHero('ballista').moves.findIndex(
    (move) => move.isSignature
  );
  const plain = endTurn(ballistaFight(0));
  const siege = endTurn(ballistaFight(siegeIndex));
  const start = ballistaFight(siegeIndex).player.hp;
  assert.ok(start - siege.player.hp > start - plain.player.hp);
  assert.equal(unitAt(siege, 0).row, 'horizon');
  assert.deepEqual(siege.forcedMovement, {
    count: 1,
    move: 'backStep',
    distance: 2,
  });
  assert.equal(siege.travelRows, -2);
});

void test('Winch Back pulls the player closer only when there is room', () => {
  const index = getHero('ballista').moves.findIndex(
    (move) => move.name === 'Winch Back'
  );
  const state = ballistaFight(index);
  const blocked = endTurn(state);
  assert.equal(blocked.forcedMovement?.distance, 0);
  const pulled = endTurn({
    ...state,
    heroes: state.heroes.filter((unit) => unit.heroId === 'ballista'),
  });
  assert.deepEqual(pulled.forcedMovement, {
    count: 1,
    move: 'charge',
    distance: 1,
  });
  assert.equal(pulled.travelRows, 1);
  assert.equal(pulled.lastMovement, state.lastMovement);
});

void test('the Ballista also looses plain arrows, fire and barbed bolts', () => {
  const { moves } = getHero('ballista');
  const isKnockBack = (move: (typeof moves)[number]) =>
    move.effects.some((effect) => effect.kind === 'knockBack');
  const shoots = (move: (typeof moves)[number]) =>
    move.effects.some((effect) => effect.kind === 'attack');
  assert.ok(
    moves.some((move) => shoots(move) && !isKnockBack(move)),
    'a plain shot'
  );
  assert.ok(
    moves.some(
      (move) =>
        shoots(move) && move.effects.some((effect) => effect.kind === 'burn')
    ),
    'a fire bolt'
  );
  assert.ok(
    moves.some(
      (move) =>
        shoots(move) && move.effects.some((effect) => effect.kind === 'bleed')
    ),
    'a barbed bolt'
  );
});

void test('the Ballista scenario: tanks in front, archers, 2 Ballistas', () => {
  const scenario = SANDBOX_SCENARIOS.find((entry) => entry.id === 'ballista');
  assert.ok(scenario?.startsInPlace);
  const { heroes } = createSandboxWith(9, scenario.heroIds, true);
  const rowOf = (heroId: HeroId) =>
    heroes.filter((unit) => unit.heroId === heroId).map((unit) => unit.row);
  assert.deepEqual(rowOf('shieldmaiden'), ['front', 'front']);
  assert.deepEqual(rowOf('archer'), ['back', 'back']);
  assert.deepEqual(rowOf('ballista'), ['horizon', 'horizon']);
});

// --- CELL CAP ---
void test('heroes never fill more than the cell cap: summons fizzle', () => {
  const state = fightAt([
    ['paladin', 'front', 0],
    ['archmage', 'back', 0],
    ['priest', 'horizon', 0],
  ]);
  // Two large units and one grunt occupy four columns.
  assert.equal(freeHeroCells(state.heroes), MAX_HERO_CELLS - 4);
  const priest = unitAt(state, 2);
  assert.equal(summonSeats(state.heroes, priest, 1, 2).length, 2);
});

// --- INSTINCT (DODGE) ---
/** The fight with the villain at `instinct` stacks of Instinct. */
const withInstinct = (state: CombatState, instinct: number): CombatState => ({
  ...state,
  player: {
    ...state.player,
    statuses: { ...state.player.statuses, instinct },
  },
});

void test('Instinct follows the four tiers: 25%, 50%, 75%, then 95%', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 9].map(dodgeChanceOf),
    [0, 0.25, 0.5, 0.75, 0.95, 0.95, 0.95]
  );
});

void test('Ultra Instinct dodges nearly every hit, and each dodge is counted', () => {
  const results = Array.from({ length: 40 }, (_, index) => {
    const state = withInstinct(
      fightAt([['squire', 'front', 0]], [], index + 1),
      4
    );
    const after = endTurn(state);
    return {
      hp: state.player.hp - after.player.hp,
      dodged: after.player.dodgedHits ?? 0,
    };
  });
  assert.ok(results.filter((r) => r.dodged > 0).length >= 35);
  assert.ok(results.every((r) => r.dodged > 0 || r.hp > 0));
});

void test('Instinct lasts two enemy turns and reapplying upgrades and refreshes it', () => {
  const initial = fightAt([['squire', 'front', 0]], ['instinct']);
  const cast = playCard(initial, 0, -1);
  assert.equal(cast.player.instinctTurns, 2);
  const first = endTurnSteps(cast);
  assert.equal(
    first.find((step) => step.actorUid !== null)!.state.player.statuses
      .instinct,
    1
  );
  const next = first.at(-1)!.state;
  assert.equal(next.player.instinctTurns, 1);
  const second = endTurnSteps(next);
  assert.equal(
    second.find((step) => step.actorUid !== null)!.state.player.statuses
      .instinct,
    1
  );
  assert.equal(second.at(-1)!.state.player.statuses.instinct, 0);
  const recast = playCard({ ...next, hand: ['instinct'] }, 0, -1);
  assert.equal(recast.player.statuses.instinct, 2);
  assert.equal(recast.player.instinctTurns, 2);
  assert.equal(
    endTurn({ ...recast, waveArrival: true }).player.instinctTurns,
    2
  );
});

void test('Hex can not be dodged', () => {
  const base = withInstinct(fightAt([['archmage', 'back', 0]]), 5);
  // Its Curse of Light (Hex 4, Weaken 1) is move 1.
  const state = {
    ...base,
    heroes: base.heroes.map((unit) => ({ ...unit, moveIndex: 1 })),
  };
  const hexed = endTurnSteps(state).some(
    (step) => step.state.player.statuses.hex > 0
  );
  assert.ok(hexed);
});

void test('Homing hits can not be dodged (Arcane Bolts)', () => {
  const state = withInstinct(fightAt([['archmage', 'back', 0]]), 5);
  // Arcane Bolts (Magic 4x3, Homing) is move 0.
  const after = endTurn(state);
  assert.equal(after.player.dodgedHits ?? 0, 0);
  assert.ok(after.player.hp < state.player.hp);
  const [bolts] = describeHeroIntent(state.heroes[0]!, state.heroes).moves;
  assert.ok(bolts?.intents[0]?.label.includes('Homing'));
});

// --- A HIT FOR 0 PROCS NOTHING ---
void test('a hero attack fully stopped by Armor lays none of its on-hit effects', () => {
  const base = fightAt([['ballista', 'back', 0]]);
  const fireBolt = getHero('ballista').moves.findIndex(
    (heroMove) => heroMove.name === 'Fire Bolt'
  );
  const state: CombatState = {
    ...base,
    player: {
      ...base.player,
      statuses: { ...base.player.statuses, armor: 20 },
    },
    heroes: base.heroes.map((unit) => ({ ...unit, moveIndex: fireBolt })),
  };
  const after = endTurn(state);
  assert.equal(after.player.hp, state.player.hp, 'the bolt does 0');
  assert.equal(after.player.statuses.burn, 0, 'so it sets no Burn');
});

void test('terrain travel follows successful row movement and reverses on retreat', () => {
  const start = fightAt([['squire', 'horizon', 0]]);
  const first = move(start, 'charge');
  const second = move(first, 'charge');
  assert.equal(first.travelRows, 1);
  assert.equal(second.travelRows, 2);
  assert.equal(move(second, 'charge').travelRows, 2);
  assert.equal(move(second, 'backStep').travelRows, 1);
  const retreat = move(fightAt([['squire', 'front', 0]]), 'backStep');
  assert.equal(retreat.travelRows, -1);
  assert.equal(move(retreat, 'charge').travelRows, 0);
});

void test('displaced specialists return one row at a time and respect occupied cells', () => {
  for (const id of ['lysa', 'archer', 'archmage', 'maren'] as const) {
    const field = fightAt([[id, 'front', 0]]).heroes;
    const settled = advanceHeroes(field);
    assert.equal(settled[0]?.row, 'back');
    assert.equal(advanceHeroes(settled)[0]?.row, 'back');
  }
  {
    const field = fightAt([['valen', 'front', 0]]).heroes;
    const step = advanceHeroes(field);
    assert.equal(step[0]?.row, 'back');
    assert.equal(advanceHeroes(step)[0]?.row, 'horizon');
  }
  const blocked = fightAt([
    ['lysa', 'front', 0],
    ['archmage', 'back', 0],
    ['archer', 'back', 2],
  ]).heroes;
  assert.equal(advanceHeroes(blocked)[0]?.row, 'front');
});
