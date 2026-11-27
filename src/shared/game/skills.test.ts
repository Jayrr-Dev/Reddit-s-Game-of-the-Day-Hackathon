// --- SKILL PROGRESSION ---
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCharacter,
  healingAmount,
  restoreCharacter,
} from './character.ts';
import {
  cardHitOn,
  endTurn,
  playCard,
  startCombat,
  targetsFor,
} from './combat.ts';
import { getCard } from './cards.ts';
import {
  addStatus,
  attackDamage,
  createCombatant,
  afflictionAmount,
  afflictionDamage,
  enfeeble,
  damageFactorOf,
  incomingAfflictionDamage,
  hexAfterBurn,
  hexBurst,
  hexBurnAmount,
  takeHit,
} from './combatant.ts';
import { move, movementCost } from './movement.ts';
import {
  planSkillPath,
  skillPurchases,
  buySkill,
  skillPointsLeft,
  movementDiscountOf,
  reflexDodgeOf,
  bonusUsesOf,
  empoweredStacks,
  handSizeBonusOf,
  volleyHitsOf,
  magicAccuracyBonusOf,
  cardChanceBonusOf,
  edgeDamageBonusOf,
  chargeGuardOf,
  lineTwoRangeBonusOf,
  skillEffectOf,
} from './skills.ts';

test('a path entry circle costs 3 skill points', () => {
  const entry = { branch: 4, tier: 0, slot: 0 };
  const low = createCharacter();
  assert.equal(buySkill(low, entry), low, 'level 1 cannot afford it');
  const c = buySkill({ ...low, level: 3 }, entry);
  assert.equal(skillPointsLeft(c), 0);
  assert.equal(buySkill(c, { branch: 1, tier: 0, slot: 0 }), c);
  assert.equal(skillPointsLeft({ ...c, level: 4 }), 1);
});

test('Endurance (Movement entry) grants a 1-energy streak discount', () => {
  assert.equal(movementDiscountOf([]), 0);
  assert.equal(movementDiscountOf([{ branch: 0, tier: 0, slot: 0 }]), 1);
  assert.equal(
    skillEffectOf({ branch: 0, tier: 0, slot: 0 })?.name,
    'Endurance'
  );
});

test('one click buys the missing route or refunds its dependants atomically', () => {
  const c = { ...createCharacter(), level: 20 };
  const left = { branch: 1, tier: 2, slot: 0 };
  assert.equal(
    planSkillPath({ ...c, level: 1 }, left).character.skillPicks,
    undefined
  );
  const first = planSkillPath(c, left).character;
  assert.equal(first.skillPicks?.length, 3);
  const both = planSkillPath(first, { ...left, slot: 1 }).character;
  assert.equal(both.skillPicks?.length, 5);
  const refunded = planSkillPath(both, { ...left, tier: 1 }).character;
  assert.deepEqual(
    refunded.skillPicks,
    both.skillPicks?.filter((p) => p.tier === 0 || p.slot === 1)
  );
  assert.deepEqual(restoreCharacter(refunded).skillPicks, refunded.skillPicks);
  assert.equal(
    planSkillPath(refunded, { ...left, tier: 3 }).character.skillPicks?.length,
    11
  );
});

test('each path ends at two gated endpoints (both can be taken) and restores only surviving circles', () => {
  for (const slot of [0, 1]) {
    const start = { ...createCharacter(), level: 70 };
    const target = { branch: 2, tier: 3, slot };
    assert.equal(buySkill(start, target), start);
    const end = planSkillPath(start, target).character;
    assert.equal(skillPointsLeft(end), 57);
    // Both capstones can be taken: the other one is still buyable.
    assert.notEqual(
      planSkillPath(end, { ...target, slot: 1 - slot }).character,
      end
    );
    const legacy = {
      ...end,
      skillPicks: [
        ...end.skillPicks!,
        { branch: 2, tier: 4, slot: 1 },
        { branch: 2, tier: 6, slot, option: 1 },
      ],
    };
    assert.deepEqual(restoreCharacter(legacy).skillPicks, end.skillPicks);
  }
});

test('Charge and Back Step start free, and Endurance knocks one off consecutive moves', () => {
  const setup = {
    hp: 50,
    maxHp: 50,
    deck: ['backhand' as const],
    heroIds: ['squire' as const],
    might: 1,
    seed: 3,
  };
  const plain = startCombat(setup);
  const enduring = startCombat({
    ...setup,
    skillPicks: [{ branch: 0, tier: 0, slot: 0 }],
  });
  for (const button of ['backStep', 'charge'] as const) {
    assert.equal(movementCost(plain, button), 0);
    assert.equal(movementCost(enduring, button), 0);
    for (const streak of [1, 2, 3]) {
      const lastMovement = { move: button, streak, turn: plain.turn };
      assert.equal(movementCost({ ...plain, lastMovement }, button), streak);
      assert.equal(movementCost({ ...enduring, lastMovement }, button), streak - 1);
      assert.equal(movementCost({ ...enduring, lastMovement, turn: enduring.turn + 2 }, button), 0);
    }
    assert.equal(movementCost({ ...enduring, movementFatigue: 2 }, button), 2);
  }
});

test('Invincible turns the next hit to 0, one stack per hit', () => {
  const unit = createCombatant(30, 30);
  const shielded = { ...unit, statuses: { ...unit.statuses, invincible: 2 } };
  const first = takeHit(shielded, 9, 'melee');
  assert.equal(first.hp, 30);
  assert.equal(first.statuses.invincible, 1);
  const second = takeHit(first, 9, 'magic', true);
  assert.equal(second.hp, 30, 'even Piercing');
  assert.equal(takeHit(second, 9, 'melee').hp, 21, 'then hits land');
});

test('Invincibility Frames: each Back Step adds Invincible 1; Battle Rush gives energy on a kill', () => {
  const setup = {
    hp: 50,
    maxHp: 50,
    deck: ['backhand' as const],
    heroIds: ['squire' as const],
    might: 1,
    seed: 3,
  };
  const iFrames = { branch: 0, tier: 3, slot: 1 };
  const stepped = (picks: { branch: number; tier: number; slot: number }[]) => {
    const state = startCombat({ ...setup, skillPicks: picks });
    const front = {
      ...state,
      energy: 9,
      heroes: state.heroes.map((u) => ({ ...u, row: 'front' as const })),
    };
    return move(front, 'backStep').player.statuses.invincible;
  };
  assert.equal(stepped([iFrames]), 1);
  assert.equal(stepped([]), 0);
  const rage = { branch: 0, tier: 3, slot: 0 };
  const fight = (
    picks: { branch: number; tier: number; slot: number }[],
    momentum = 1
  ) => {
    const state = startCombat({ ...setup, skillPicks: picks });
    const weak = {
      ...state,
      player: {
        ...state.player,
        statuses: { ...state.player.statuses, momentum },
      },
      energy: 5,
      heroes: state.heroes.map((u) => ({
        ...u,
        row: 'front' as const,
        hp: 1,
        guard: 0,
      })),
    };
    return playCard(weak, 0, weak.heroes[0]!.uid).energy;
  };
  assert.equal(fight([rage]), fight([]) + 1);
  assert.equal(fight([rage], 0), fight([], 0), 'no Momentum: no energy');
});

test('Bull Rush: each rank adds 5% to the Momentum bonus', () => {
  const unit = createCombatant(30, 30);
  const charged = { ...unit, statuses: { ...unit.statuses, momentum: 1 } };
  const rank = { branch: 0, tier: 1, slot: 0 };
  assert.equal(attackDamage(100, charged, 'melee'), 150);
  const maxed = { ...charged, skillPicks: [rank, rank, rank, rank, rank] };
  assert.equal(attackDamage(100, maxed, 'melee'), 175);
  // Rampage doubles the whole bonus: +75% becomes +150%.
  assert.equal(attackDamage(100, maxed, 'melee', true), 250);
});

test('Light Feet: each rank adds 5% to the Reflex dodge', () => {
  const rank = { branch: 0, tier: 1, slot: 1 };
  assert.equal(reflexDodgeOf({}), 0.25);
  assert.equal(
    reflexDodgeOf({ skillPicks: [rank, rank, rank, rank, rank] }),
    0.5
  );
});

test('Shield Rush and Skirmisher scale per rank', () => {
  const rush = { branch: 0, tier: 2, slot: 0 };
  const skirm = { branch: 0, tier: 2, slot: 1 };
  assert.equal(chargeGuardOf([rush, rush, rush]), 3);
  assert.ok(
    Math.abs(lineTwoRangeBonusOf([skirm, skirm, skirm, skirm, skirm]) - 0.25) <
      1e-9
  );
  assert.equal(lineTwoRangeBonusOf([]), 0);
});

test('Lunge reaches Midline; Shockwave Cleaves with Momentum', () => {
  const setup = {
    hp: 50,
    maxHp: 50,
    deck: ['backhand' as const],
    heroIds: ['squire' as const, 'squire' as const],
    might: 1,
    seed: 3,
  };
  const field = (picks: { branch: number; tier: number; slot: number }[]) => {
    const state = startCombat({ ...setup, skillPicks: picks });
    return {
      ...state,
      energy: 5,
      player: {
        ...state.player,
        statuses: { ...state.player.statuses, momentum: 1 },
      },
      heroes: state.heroes.map((u, i) => ({
        ...u,
        row: i === 0 ? ('front' as const) : ('back' as const),
        hp: 100,
        guard: 0,
      })),
    };
  };
  const lunge = { branch: 1, tier: 3, slot: 1 };
  assert.equal(targetsFor(field([]), 'backhand').length, 1);
  assert.equal(targetsFor(field([lunge]), 'backhand').length, 2);
  const shock = { branch: 1, tier: 3, slot: 0 };
  const hurt = (picks: (typeof shock)[]) => {
    const state = field(picks);
    return playCard(state, 0, state.heroes[0]!.uid).heroes.filter(
      (u) => u.hp < 100
    ).length;
  };
  assert.equal(hurt([]), 1);
  assert.equal(hurt([shock]), 1, 'Midline is out of reach');
  assert.equal(hurt([shock, lunge]), 2, 'Cleave + Lunge hits both lines');
});

test('Heavy Hands and Keen Edge: +5% per rank to Blunt or Sharp Melee', () => {
  const heavy = { branch: 1, tier: 1, slot: 0 };
  const picks = [heavy, heavy, heavy, heavy, heavy];
  assert.ok(Math.abs(edgeDamageBonusOf(picks, 'blunt') - 0.25) < 1e-9);
  assert.equal(edgeDamageBonusOf(picks, 'sharp'), 0);
  const villain = { ...createCombatant(50, 50), skillPicks: picks };
  assert.equal(attackDamage(100, villain, 'melee', false, 1, 'blunt'), 125);
  assert.equal(attackDamage(100, villain, 'melee', false, 1, 'sharp'), 100);
});

test('Guard Break: Blunt hits a guarded hero +5% per rank', () => {
  const brk = { branch: 1, tier: 2, slot: 0 };
  const picks = [brk, brk, brk, brk, brk];
  const state = startCombat({
    hp: 50,
    maxHp: 50,
    deck: ['backhand' as const],
    heroIds: ['squire' as const],
    might: 1,
    seed: 3,
  });
  const hero = { ...state.heroes[0]!, row: 'front' as const };
  const blunt = getCard('backhand');
  assert.equal(blunt.edge, 'blunt');
  assert.equal(cardHitOn({ ...hero, guard: 5 }, 100, blunt, picks), 125);
  assert.equal(cardHitOn({ ...hero, guard: 0 }, 100, blunt, picks), 100);
});

test('Guard Break also hits armored heroes harder', () => {
  const brk = { branch: 1, tier: 2, slot: 0 };
  const state = startCombat({
    hp: 50,
    maxHp: 50,
    deck: ['backhand' as const],
    heroIds: ['squire' as const],
    might: 1,
    seed: 3,
  });
  const hero = state.heroes[0]!;
  const armored = {
    ...hero,
    guard: 0,
    statuses: { ...hero.statuses, armor: 2 },
  };
  assert.equal(cardHitOn(armored, 100, getCard('backhand'), [brk, brk]), 110);
});

test('Flesh Wound: Sharp hits an unprotected hero +5% per rank', () => {
  const fw = { branch: 1, tier: 2, slot: 1 };
  const picks = [fw, fw, fw, fw, fw];
  const state = startCombat({
    hp: 50,
    maxHp: 50,
    deck: ['twinDaggers' as const],
    heroIds: ['squire' as const],
    might: 1,
    seed: 3,
  });
  const hero = { ...state.heroes[0]!, guard: 0 };
  const sharp = getCard('twinDaggers');
  assert.equal(cardHitOn(hero, 100, sharp, picks), 125);
  assert.equal(cardHitOn({ ...hero, guard: 3 }, 100, sharp, picks), 100);
});

test('Armory and Quiver: path entries make Melee or Range offers 30% likelier', () => {
  const armory = { branch: 1, tier: 0, slot: 0 };
  assert.equal(cardChanceBonusOf([armory], 'melee'), 0.3);
  assert.equal(cardChanceBonusOf([armory], 'range'), 0);
  assert.equal(
    cardChanceBonusOf([{ branch: 2, tier: 0, slot: 0 }], 'range'),
    0.3
  );
});

test('Battlemage, Sniper and both accuracy circles', () => {
  const bm = { branch: 2, tier: 1, slot: 0 };
  const sn = { branch: 2, tier: 1, slot: 1 };
  const focus = { branch: 2, tier: 2, slot: 0 };
  const state = startCombat({
    hp: 50,
    maxHp: 50,
    deck: ['twinDaggers' as const],
    heroIds: ['squire' as const],
    might: 1,
    seed: 3,
  });
  const hero = { ...state.heroes[0]!, guard: 0 };
  const magic = { ...getCard('twinDaggers'), type: 'magic' as const };
  const range = { ...getCard('twinDaggers'), type: 'range' as const };
  const front = { ...hero, row: 'front' as const };
  const back = { ...hero, row: 'back' as const };
  assert.equal(cardHitOn(front, 100, magic, [bm, bm, bm, bm, bm]), 125);
  assert.equal(cardHitOn(back, 100, magic, [bm, bm, bm, bm, bm]), 100);
  assert.equal(cardHitOn(front, 100, range, [sn, sn]), 100);
  assert.ok(
    Math.abs(magicAccuracyBonusOf([focus, focus, focus]) - 0.15) < 1e-9
  );
});

test('Volley adds a hit to every Range card after a Back Step', () => {
  const base = createCombatant(50, 50);
  const archer = { ...base, skillPicks: [{ branch: 2, tier: 3, slot: 1 }] };
  const stepped = { ...archer, statuses: { ...archer.statuses, reflex: 1 } };
  assert.equal(volleyHitsOf(1, 'range', stepped), 2);
  assert.equal(volleyHitsOf(3, 'range', stepped), 4);
  assert.equal(volleyHitsOf(3, 'magic', stepped), 3);
  assert.equal(volleyHitsOf(3, 'range', archer), 3, 'no Back Step yet');
});

test('Everlasting: Stacked Buffs last one more turn', () => {
  const base = createCombatant(50, 50);
  const buffed = { ...base, skillPicks: [{ branch: 3, tier: 3, slot: 0 }] };
  assert.equal(addStatus(base, 'instinct', 1).instinctTurns, 2);
  assert.equal(addStatus(buffed, 'instinct', 1).instinctTurns, 3);
});

test('Overflow: Utility cards get +1 use', () => {
  const of = [{ branch: 3, tier: 3, slot: 1 }];
  assert.equal(bonusUsesOf('utility', of), 1);
  assert.equal(bonusUsesOf('melee', of), 0);
  assert.equal(bonusUsesOf('utility', []), 0);
});

test('Overflow gives Utility cards Hold', () => {
  const potionKept = (
    picks: { branch: number; tier: number; slot: number }[]
  ) => {
    const state = startCombat({
      hp: 50,
      maxHp: 50,
      deck: ['backhand' as const],
      heroIds: ['squire' as const],
      might: 1,
      seed: 3,
      skillPicks: picks,
    });
    const held = {
      ...state,
      hand: ['rushPotion' as const],
      handImbues: [[]],
      drawPile: Array.from({ length: 12 }, () => 'backhand' as const),
      discardPile: [],
    };
    return !endTurn(held).discardPile.includes('rushPotion');
  };
  assert.equal(potionKept([]), false);
  assert.equal(potionKept([{ branch: 3, tier: 3, slot: 1 }]), true);
});

test('Empower: 5% more buff stacks per rank, rounded to nearest', () => {
  const emp = { branch: 3, tier: 1, slot: 0 };
  assert.equal(empoweredStacks(4, [emp, emp, emp, emp, emp]), 5);
  assert.equal(empoweredStacks(3, [emp, emp, emp, emp, emp]), 4);
  assert.equal(empoweredStacks(1, [emp, emp, emp, emp, emp]), 1);
  assert.equal(empoweredStacks(10, [emp, emp]), 11);
});

test('Mender: healing +5% per rank', () => {
  const m = { branch: 3, tier: 1, slot: 1 };
  assert.equal(healingAmount(20, { skillPicks: [m, m, m, m, m] }), 25);
  assert.equal(healingAmount(20, {}), 20);
});

test('Deep Pockets: +1 hand size per rank', () => {
  const dp = { branch: 3, tier: 2, slot: 1 };
  assert.equal(handSizeBonusOf([dp, dp, dp]), 3);
});

test('Potency: buffs 3% stronger per rank', () => {
  const pot = { branch: 3, tier: 2, slot: 0 };
  const base = createCombatant(50, 50);
  const angry = {
    ...base,
    skillPicks: [pot, pot, pot, pot, pot],
    statuses: { ...base.statuses, wrath: 20 },
  };
  assert.equal(attackDamage(0, angry, 'melee'), 23);
  assert.equal(attackDamage(0, { ...angry, skillPicks: [] }, 'melee'), 20);
});

test('the second capstone is still offered once the first is owned', () => {
  const start = { ...createCharacter(), level: 70 };
  const first = planSkillPath(start, { branch: 3, tier: 3, slot: 0 }).character;
  const offer = skillPurchases(first, { branch: 3, tier: 3, slot: 1 });
  assert.ok(offer.steps.length > 0, offer.message);
});

test('Sixfold Curse bursts twice at multiples of six without creating extra trigger points', () => {
  const hexer = { skillPicks: [{ branch: 4, tier: 3, slot: 0 }] };
  assert.equal(hexBurnAmount(6), 6);
  assert.equal(hexBurnAmount(6, hexer), 12);
  assert.equal(hexBurnAmount(12, hexer), 24);
  assert.equal(hexBurnAmount(9, hexer), 9);
  assert.equal(hexBurnAmount(16, hexer), 0);
  assert.equal(hexAfterBurn(16, hexer), 16);
  assert.equal(hexAfterBurn(6), 5);
  const target = createCombatant(40, 40);
  const burst = hexBurst({ ...target, statuses: { ...target.statuses, hex: 6 } }, { ...target, ...hexer });
  assert.equal(burst.hp, 28);
  assert.equal(burst.statuses.hex, 6);
  const protectedTarget = { ...target, statuses: { ...target.statuses, hex: 6, protection: 1 } };
  const protectedBurst = hexBurst(protectedTarget, { ...target, ...hexer });
  assert.equal(protectedBurst.hp, 30, 'each six-damage burst rounds to five after Protection');
});

test('Malediction: afflictions deal 5% more per rank', () => {
  const m = { branch: 4, tier: 1, slot: 0 };
  const hexer = { ...createCombatant(50, 50), skillPicks: [m, m, m, m, m] };
  assert.equal(afflictionDamage(20, hexer), 25);
  assert.equal(afflictionDamage(20), 20);
});

test('Virulence: +5% stacks per rank on non-Hex afflictions, rounded', () => {
  const v = { branch: 4, tier: 1, slot: 1 };
  const unit = { ...createCombatant(50, 50), skillPicks: [v, v, v, v, v] };
  assert.equal(afflictionAmount(4, unit, 'poison'), 5);
  assert.equal(afflictionAmount(10, unit, 'bleed'), 13);
  assert.equal(afflictionAmount(4, unit, 'hex'), 4);
  assert.equal(afflictionAmount(4, createCombatant(50, 50), 'poison'), 4);
});

test('Debilitate: adds 5% per rank to Weaken and Enfeeble cuts', () => {
  const base = createCombatant(50, 50);
  const weak = { ...base, statuses: { ...base.statuses, weaken: 2 } };
  assert.equal(damageFactorOf(weak), 0.75);
  assert.equal(damageFactorOf(weak, undefined, false, undefined, 0.25), 0.5);
  assert.equal(
    damageFactorOf(createCombatant(50, 50), undefined, false, undefined, 0.25),
    1
  );
});

test('Everlasting: Enfeeble the villain applies lasts 1 more turn', () => {
  assert.equal(enfeeble(createCombatant(50, 50)).enfeebleTurns, 2);
  assert.equal(enfeeble(createCombatant(50, 50), 1).enfeebleTurns, 3);
});

test('Tolerance: affliction damage taken is 5% lower per rank', () => {
  const a = { branch: 4, tier: 2, slot: 1 };
  const villain = { ...createCombatant(50, 50), skillPicks: [a, a, a, a, a] };
  assert.equal(incomingAfflictionDamage(villain, 20), 15);
  assert.equal(incomingAfflictionDamage(createCombatant(50, 50), 20), 20);
});

test('Relentless: a hit Armor blocks to 0 still poisons', () => {
  const poisoned = (
    picks: { branch: number; tier: number; slot: number }[]
  ) => {
    const state = startCombat({
      hp: 50,
      maxHp: 50,
      deck: ['venomDart' as const],
      heroIds: ['squire' as const],
      might: 1,
      seed: 3,
      skillPicks: picks,
    });
    const walled = {
      ...state,
      energy: 9,
      heroes: state.heroes.map((u) => ({
        ...u,
        row: 'front' as const,
        guard: 0,
        statuses: { ...u.statuses, armor: 999 },
      })),
    };
    const after = playCard(walled, 0, walled.heroes[0]!.uid);
    return after.heroes[0]!.statuses.poison;
  };
  assert.equal(poisoned([]) > 0, false, 'a hit for 0 procs nothing');
  assert.ok(poisoned([{ branch: 4, tier: 3, slot: 1 }]) > 0);
});
