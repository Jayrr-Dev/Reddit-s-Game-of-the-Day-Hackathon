// ===================================================================
// COMBAT ENGINE TESTS
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceMelee } from './battlefield.ts';
import { ALL_CARD_IDS, type CardId } from './cards.ts';
import {
  attackDamage,
  endOfTurnUpkeep,
  takeDamage,
  createCombatant,
  NO_STATUSES,
} from './combatant.ts';
import {
  backStep,
  canBackStep,
  charge,
  fieldMoveCost,
  canPlayCard,
  combatOutcome,
  endTurn,
  endTurnSteps,
  heroTurnOrder,
  playCard,
  playCardSteps,
  startCombat,
} from './combat.ts';
import { describeCard, describeHeroIntent } from './describe.ts';
import { BACK_STEP_COST, CARDS_PER_TURN, ENERGY_PER_TURN } from './rules.ts';
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

void test('Might, Surge and Piercing each power up only their own card type', () => {
  assert.equal(damageWith('backhand', { might: 2 }), 8);
  assert.equal(damageWith('backhand', { surge: 2, piercing: 2 }), 6);
  // The Squire is in front: no long-range bonus.
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
  // One beat per hit, then the real play.
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.at(-1), playCard(start, 0, squireUid(start)));
  const hpOf = (state: CombatState) => state.heroes[0]?.hp ?? 0;
  assert.ok(hpOf(steps[0] as CombatState) > hpOf(steps[1] as CombatState));
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
  assert.equal(describeHeroIntent(maiden as HeroUnit).name, 'Brace');
  assert.equal(describeHeroIntent(squire as HeroUnit).name, 'Advance');
  const after = endTurn(fresh);
  assert.equal(after.player.hp, 60);
  assert.equal(heroNamed(after, 'squire')?.row, 'front');
  assert.equal(heroNamed(after, 'squire')?.moveIndex, 0);
});

void test('a Range hero shoots harder from the back and strikes plainly up close', () => {
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
  const [shot] = describeHeroIntent(archer).intents;
  assert.deepEqual([shot?.kind, shot?.text], ['range', '3×3']);
  // Up close it lands as plain Melee.
  const upClose = { ...archer, row: 'front' as const };
  const [strike] = describeHeroIntent(upClose).intents;
  assert.deepEqual([strike?.kind, strike?.text], ['attack', '2×3']);
});

void test('Back Step pushes a full front row back for 1 energy', () => {
  const state = fightWith(['backhand']);
  assert.ok(canBackStep(state));
  const after = backStep(state);
  assert.ok(after.heroes.every((unit) => unit.row === 'back'));
  assert.equal(after.energy, state.energy - BACK_STEP_COST);
  assert.equal(canBackStep(after), false);
  // The Squire can't reach, so the heroes' turn costs no HP; it steps up.
  const next = endTurn(after);
  assert.equal(next.player.hp, 60);
  assert.equal(next.heroes[0]?.row, 'front');
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

void test('a field move costs 1 more for each use in a row; a break resets it', () => {
  const start = { ...fightWith(['backhand']), energy: 9 };
  assert.equal(fieldMoveCost(start, 'backStep'), 1);
  // Back Step, then Charge (a different move breaks the streak), then
  // Back Step again: each costs 1.
  const mixed = backStep(charge(backStep(start)));
  assert.equal(mixed.energy, 9 - 3);
  // Two Back Steps in a row so far: the next costs 3.
  const streak = {
    ...start,
    lastFieldMove: { move: 'backStep' as const, turn: start.turn, streak: 2 },
  };
  assert.equal(fieldMoveCost(streak, 'backStep'), 3);
  assert.equal(fieldMoveCost(streak, 'charge'), 1);
  // Last turn still counts as in a row; two turns later it is gone.
  assert.equal(
    fieldMoveCost({ ...streak, turn: start.turn + 1 }, 'backStep'),
    3
  );
  assert.equal(
    fieldMoveCost({ ...streak, turn: start.turn + 2 }, 'backStep'),
    1
  );
});
