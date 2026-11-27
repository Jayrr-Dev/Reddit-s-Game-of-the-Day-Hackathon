import test from 'node:test';
import assert from 'node:assert/strict';
import { createEndless, draftBorrowedOffers, ENDLESS_BATTLE_VERSION, endlessClearedWaves, endlessWaveNumber, reduceEndless, restoreEndlessProfile, withDraftBorrowedPowers } from './endless.ts';
import { createHeroUnit, startPlayerTurn } from './combat.ts';
import { attackDamage, combatantBonuses } from './combatant.ts';
import { borrowedBenefit, eligiblePowerCopies, rollBorrowedPowers, type BorrowedPower } from './borrowedPowers.ts';
import { buildEndlessWaves } from './endlessWaves.ts';
import { canSetTraitNode, progressionFromWins } from './character.ts';
import { createRun, type RunState } from './run.ts';
import { getCard } from './cards.ts';
import { ENDLESS_CLASS_TYPES, endlessDraftOffers, endlessDraftSize, isSavedEndlessDraft, pendingDraftPower, refreshEndlessDraft, type EndlessDraft } from './endlessDraft.ts';
import { applyBorrowedPower, isRunAction, runReducer } from './run.ts';
import { starterNames } from './starters.ts';

test('Endless starts at a seeded fight without changing Conquest', () => {
  const day = '2026-11-27';
  const first = createEndless(day);
  assert.equal(first.phase.kind, 'combat');
  assert.equal(first.stop, 1);
  assert.deepEqual(createEndless(day), first);
  const tomorrow = createEndless('2026-11-28');
  assert.equal(tomorrow.phase.kind, 'combat');
  assert.notDeepEqual(tomorrow.phase.combat, first.phase.combat);
  assert.equal(createRun(day).phase.kind, 'route');
});

test('Endless advances directly to seeded fights well past the campaign finale', () => {
  const start = createEndless('2026-11-27');
  const reward: RunState = { ...start, stop: 45, phase: { kind: 'reward', source: 'champion', offers: [] } };
  const next = reduceEndless(reward, { type: 'pickCard', offerIndex: null });
  assert.equal(next.stop, 46);
  assert.equal(next.phase.kind, 'combat');
  assert.equal(reduceEndless(next, { type: 'chooseStop', option: 1 }), next);
  const fallen = reduceEndless(next, { type: 'abandon' });
  assert.equal(fallen.phase.kind, 'fallen');
  assert.equal(reduceEndless(fallen, { type: 'endTurn' }), fallen);
});

test('all four Endless classes draft 20 cards with three distinct offers and defensive rounds', () => {
  for (let number = 1; number <= 50; number++) {
    const day = '2026-11-27';
    const draft: EndlessDraft = { number, cards: [] };
    for (let picks = 0; picks < 18; picks++) {
      const offers = endlessDraftOffers(day, draft);
      assert.deepEqual(endlessDraftOffers(day, draft), offers);
      assert.equal(offers.length, picks === 0 ? 4 : 3);
      assert.equal(new Set(offers.flatMap(offer => offer.cards)).size, picks === 0 ? 12 : 3);
      assert.ok(offers.flatMap(offer => offer.cards).every(id => !draft.cards.includes(id) && getCard(id).type !== 'imbue'));
      if ([3, 7, 13].includes(draft.cards.length)) {
        assert.ok(offers.flatMap(offer => offer.cards).every(id => getCard(id).type === 'defend'));
      }
      const chosen = offers[(number + picks) % offers.length]!;
      draft.cards.push(...chosen.cards);
      if (chosen.name) draft.starter = chosen.name;
      assert.ok(isSavedEndlessDraft(draft));
    }
    assert.equal(endlessDraftSize(draft), 20);
    assert.equal(draft.cards.length, 20);
    assert.deepEqual(endlessDraftOffers(day, draft), []);
    const run = createEndless(day, draft.cards);
    assert.deepEqual(run.deck, draft.cards);
    assert.equal(run.phase.kind, 'combat');
    assert.deepEqual(
      [...run.phase.combat.hand, ...run.phase.combat.drawPile].sort(),
      [...draft.cards].sort(),
    );
  }
  assert.equal(isSavedEndlessDraft({ number: 1, cards: ['not-a-card'] }), false);
});

test('class bias favors its primary type without locking the draft or breaking old 11-card decks', () => {
  for (const starter of starterNames) {
    const type = ENDLESS_CLASS_TYPES[starter][0];
    const cards = ['cruelSlash', 'cleave', 'boneWard', 'hexfire', 'spiteBolt'] as const;
    let favored = 0;
    let unbiased = 0;
    for (let number = 1; number <= 240; number++) {
      const selections = { number, cards: [...cards] };
      const count = (draft: EndlessDraft) => endlessDraftOffers('class', draft)
        .flatMap(offer => offer.cards).filter(id => getCard(id).type === type).length;
      unbiased += count(selections);
      favored += count({ ...selections, starter });
    }
    assert.ok(favored > unbiased, starter);
    assert.ok(favored < 240 * 3, starter);
  }
  assert.equal(endlessDraftSize({ number: 1, cards: ['cruelSlash', 'cleave', 'boneWard'] }), 11);
});

test('Endless clears five waves, drafts a prize, and carries the same combat into Wave 6', () => {
  const initial = createEndless('2026-11-27', undefined, ENDLESS_BATTLE_VERSION);
  assert.equal(initial.area?.battles[0]?.waves.length, 5);
  assert.equal(initial.area?.battles[0]?.waves.at(-1)?.name, 'Officer');
  let run = initial;
  for (let wave = 1; wave <= 5; wave++) {
    assert.equal(run.phase.kind, 'combat');
    assert.equal(endlessWaveNumber(run), wave);
    const target = { ...createHeroUnit('squire', 255, 1), hp: 1, guard: 0, row: 'front' as const, col: 1 };
    const combat = { ...run.phase.combat, heroes: [target], hand: ['backhand'] as const, energy: 3 };
    const ready = { ...run, phase: { ...run.phase, combat: { ...combat, hand: [...combat.hand] } } };
    run = reduceEndless(ready, { type: 'playCard', handIndex: 0, targetUid: target.uid });
    assert.equal(endlessClearedWaves(run), wave);
    if (wave < 5) {
      assert.equal(run.phase.kind, 'combat');
      assert.equal(run.goldVictories.length, 0);
      assert.equal(reduceEndless(run, { type: 'abandon' }).stats.wavesCleared, wave);
      run = reduceEndless(run, { type: 'nextBattleWave' });
    }
  }
  assert.equal(run.phase.kind, 'combat');
  assert.ok(run.area?.respite);
  assert.equal(run.goldVictories.length, 0);
  assert.equal(run.stats.regionsConquered, 0);
  assert.equal(reduceEndless(run, { type: 'nextBattleWave' }), run);
  const spoils = reduceEndless(run, { type: 'battleRespite', choice: 'fight' });
  const offered = spoils.area?.respite?.offers?.[0];
  assert.ok(offered);
  const next = reduceEndless(spoils, { type: 'pickCard', offerIndex: 0 });
  assert.equal(next.phase.kind, 'combat');
  assert.equal(endlessWaveNumber(next), 6);
  assert.equal(endlessClearedWaves(next), 5);
  assert.equal(next.phase.combat.player, run.phase.combat.player);
  assert.equal(next.phase.combat.turn, run.phase.combat.turn);
  assert.equal(next.phase.combat.hand, run.phase.combat.hand);
  assert.equal(next.phase.combat.discardPile.at(-1), offered);
  assert.equal(next.deck.at(-1), offered);
  assert.equal(next.area?.site, initial.area?.site);
  const choice = { type: 'battleRespite', choice: 'borrow' } as const;
  assert.ok(isRunAction(choice));
  const powers = reduceEndless(run, choice);
  assert.equal(powers.area?.respite?.powers?.length, 3);
  assert.equal(reduceEndless(powers, { type: 'takeBorrowedPower', index: 3 }), powers);
  const cancel = reduceEndless(powers, { type: 'closeBorrowedPowers' });
  assert.deepEqual(reduceEndless(cancel, choice), powers);
  const borrowed = reduceEndless(powers, { type: 'takeBorrowedPower', index: 0 });
  assert.equal(endlessWaveNumber(borrowed), 6);
  assert.equal(borrowed.phase.kind, 'combat');
  assert.equal(borrowed.phase.combat.borrowedPowers?.length, 1);
  assert.equal(borrowed.phase.combat.turn, run.phase.combat.turn);
});

test('draft refreshes replace offers, preserve cards, stop at five and pause at both power milestones', () => {
  const day = '2026-11-27';
  let draft: EndlessDraft = { number: 1, starter: 'Mage', cards: ['forkedBolt', 'frostBolt', 'mend', 'boneWard', 'arcaneBolt'] };
  for (let i = 0; i < 5; i++) {
    const next = refreshEndlessDraft(day, draft);
    assert.equal(next.cards, draft.cards);
    assert.notDeepEqual(endlessDraftOffers(day, next), endlessDraftOffers(day, draft));
    assert.equal(next.refreshesUsed, i + 1);
    draft = next;
  }
  assert.equal(refreshEndlessDraft(day, draft), draft);
  while (draft.cards.length < 20) draft.cards.push(...endlessDraftOffers(day, draft)[0]!.cards);
  assert.equal(pendingDraftPower(draft), 10);
  const first = draftBorrowedOffers(day, draft, 10);
  assert.deepEqual(first, draftBorrowedOffers(day, { ...draft, cards: draft.cards.slice(0, 10) }, 10));
  draft.powerPicks = { 10: 0 };
  assert.equal(pendingDraftPower(draft), 20);
  draft.powerPicks[20] = 1;
  assert.equal(pendingDraftPower(draft), undefined);
  const run = createEndless(day, draft.cards, ENDLESS_BATTLE_VERSION);
  const ready = withDraftBorrowedPowers(run, day, draft);
  assert.equal(ready.phase.kind, 'combat');
  assert.equal(ready.phase.combat.turn, 1);
  assert.deepEqual(ready.phase.combat.borrowedPowers, [first[0], draftBorrowedOffers(day, draft, 20)[1]]);
});

test('borrowed stats, blood prices, HP scaling and Imbue affect live combat without changing the profile', () => {
  const deck = ['backhand', 'backhand', 'darkCloak', 'forkedBolt', 'frostBolt', 'mend', 'boneWard', 'cleave'] as const;
  const initial = createEndless('test', deck, ENDLESS_BATTLE_VERSION);
  assert.equal(initial.phase.kind, 'combat');
  const baseline = initial.phase.combat;
  const energy: BorrowedPower = { rarity: 'rare', benefit: { kind: 'stat', stat: 'startingEnergy', amount: 1 },
    price: { kind: 'blood', percent: 20 }, seed: 123 };
  let run = applyBorrowedPower(initial, energy);
  assert.equal(run.phase.kind, 'combat');
  assert.equal(run.hp, initial.hp - Math.ceil(initial.maxHp * 0.2));
  assert.equal(run.character, initial.character);
  assert.equal(startPlayerTurn(run.phase.combat).energy, startPlayerTurn(initial.phase.combat).energy + 1);
  run = applyBorrowedPower(run, { rarity: 'rare', benefit: { kind: 'stat', stat: 'magicPercent', amount: 30 }, seed: 1 });
  assert.equal(run.phase.kind, 'combat');
  assert.equal(attackDamage(10, run.phase.combat.player, 'magic'), 13);
  run = applyBorrowedPower(run, { rarity: 'rare', benefit: { kind: 'hp', percent: true, amount: 20 }, seed: 1 });
  assert.equal(run.maxHp, initial.maxHp + Math.ceil(initial.maxHp * 0.2));
  run = applyBorrowedPower(run, { rarity: 'uncommon', benefit: { kind: 'stat', stat: 'cardsPerTurn', amount: 1 }, seed: 1 });
  assert.equal(run.phase.kind, 'combat');
  assert.equal(combatantBonuses(run.phase.combat.player).cardsPerTurn, combatantBonuses(initial.phase.combat.player).cardsPerTurn + 1);
  const gift = { kind: 'effect', effect: { kind: 'guard', amount: 2 } } as const;
  const eligible = eligiblePowerCopies(run.phase.combat, deck, gift);
  const power: BorrowedPower = { rarity: 'legendary', benefit: { kind: 'imbue', count: 'all', gift, label: 'Guard 2', eligible: eligible.length }, seed: 1 };
  const all = applyBorrowedPower(run, power);
  const three = applyBorrowedPower(run, { ...power, benefit: { kind: 'imbue', count: 3, gift, label: 'Guard 2', eligible: eligible.length } });
  assert.equal(all.phase.kind, 'combat');
  assert.equal(three.phase.kind, 'combat');
  assert.equal(Object.keys(all.phase.combat.copies?.gifts ?? {}).length, eligible.length);
  assert.equal(Object.keys(three.phase.combat.copies?.gifts ?? {}).length, 3);
  const copies = all.phase.combat.copies;
  assert.deepEqual(all.phase.combat.handImbues, copies?.hand.map(i => copies.gifts[i] ?? []));
  const rolled = Array.from({ length: 100 }, (_, n) => rollBorrowedPowers('roll-' + n, 30, baseline, deck));
  assert.ok(rolled.every(offer => new Set(offer.map(borrowedBenefit)).size === 3));
  assert.deepEqual(new Set(rolled.flat().map(power => power.rarity)), new Set(['common', 'uncommon', 'rare', 'legendary']));
  assert.ok(rolled.flat().some(power => power.price));
  assert.ok(rolled.flat().every(power => !power.price || power.rarity === 'rare' || power.rarity === 'legendary'));
});

test('Endless snapshots the profile level and allocated traits without replacing its drafted deck', () => {
  let wins = 1;
  while (progressionFromWins(wins, false, 0, 200).level < 12) wins++;
  const profile = restoreEndlessProfile({ wins, xpStartWins: 0, bonusXp: 200, shopRings: [],
    edits: [{ type: 'setTraitNode', trait: 'vigor', node: 1, owned: true }],
    rings: { bossWins: 2, rareSlots: [] } });
  assert.ok(profile);
  const deck = ['backhand', 'boneWard'] as const;
  const run = createEndless('test', deck, ENDLESS_BATTLE_VERSION, profile);
  assert.equal(run.character.level, 12);
  assert.equal(run.character.ringProgress.bossWins, 2);
  assert.ok(run.maxHp > 66);
  assert.deepEqual(run.deck, deck);
  assert.deepEqual(createEndless('test', deck, ENDLESS_BATTLE_VERSION, restoreEndlessProfile(JSON.parse(JSON.stringify(profile)))), run);
});

test('new Endless drops the extra Vigor HP without changing Conquest, older saves or Borrowed Power', () => {
  const nodes = Array.from({ length: 64 }, (_, index) => (
    { type: 'setTraitNode', trait: 'vigor', node: index + 1, owned: true } as const
  ));
  const edits: typeof nodes = [];
  let conquest = createRun('vigor-test', undefined, 0, 10000);
  for (let i = 0; i < 64; i++) {
    const action = nodes.find(({ node }) => canSetTraitNode(conquest.character, 'vigor', node, true));
    assert.ok(action);
    edits.push(action);
    conquest = runReducer(conquest, action);
  }
  const profile = { wins: 10000, shopRings: [], rings: { bossWins: 0, rareSlots: [] }, edits };
  const fresh = createEndless('vigor-test', ['backhand'], ENDLESS_BATTLE_VERSION, profile);
  const old = createEndless('vigor-test', ['backhand'], 1, profile);
  assert.equal(fresh.character.traits.vigor, 64);
  assert.equal(fresh.maxHp, 333);
  assert.equal(old.maxHp, 666);
  assert.equal(conquest.maxHp, 666);
  assert.equal(fresh.phase.kind, 'combat');
  assert.equal(fresh.phase.combat.player.hp, 333);
  assert.equal(applyBorrowedPower(fresh, { rarity: 'common', benefit: { kind: 'hp', amount: 8, percent: false }, seed: 1 }).maxHp, 341);
});

test('Endless recruits mixed mobs in progressively larger and stronger waves beyond Wave 100', () => {
  const early = buildEndlessWaves('test', 0).waves;
  const late = buildEndlessWaves('test', 100).waves;
  assert.equal(early[0]?.heroIds.length, 1);
  assert.equal(late[0]?.heroIds.length, 6);
  assert.ok(late.every(wave => (wave.might ?? 0) > (early.at(-1)?.might ?? 0)));
  assert.ok(new Set(late.flatMap(wave => wave.heroIds)).size >= 5);
});
