import test from 'node:test';
import assert from 'node:assert/strict';
import { createEndless, reduceEndless } from './endless.ts';
import { createRun, type RunState } from './run.ts';
import { getCard } from './cards.ts';
import { ENDLESS_DRAFT_SIZE, endlessDraftOffers, isSavedEndlessDraft, type EndlessDraft } from './endlessDraft.ts';

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

test('Endless drafts offer three distinct usable choices at every step, including defense', () => {
  for (let number = 1; number <= 50; number++) {
    const day = '2026-11-27';
    const draft: EndlessDraft = { number, cards: [] };
    for (let picks = 0; picks < 9; picks++) {
      const offers = endlessDraftOffers(day, draft);
      assert.deepEqual(endlessDraftOffers(day, draft), offers);
      assert.equal(offers.length, 3);
      assert.equal(new Set(offers.flatMap(offer => offer.cards)).size, picks === 0 ? 9 : 3);
      assert.ok(offers.flatMap(offer => offer.cards).every(id => !draft.cards.includes(id) && getCard(id).type !== 'imbue'));
      if (draft.cards.length === 3 || draft.cards.length === 7) {
        assert.ok(offers.flatMap(offer => offer.cards).every(id => getCard(id).type === 'defend'));
      }
      draft.cards.push(...offers[(number + picks) % 3]!.cards);
      assert.ok(isSavedEndlessDraft(draft));
    }
    assert.equal(draft.cards.length, ENDLESS_DRAFT_SIZE);
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
