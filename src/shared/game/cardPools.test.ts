import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ALL_CARD_IDS, CARD_POOL_LABELS, getCard } from './cards.ts';

test('Imbue cards are Neutral; other existing cards are Player Cards', () => {
  let neutral = 0;
  for (const id of ALL_CARD_IDS) {
    const card = getCard(id);
    const imbues = card.type === 'imbue' || card.effects.some(effect => effect.kind === 'imbue');
    assert.equal(card.pool, imbues ? 'neutral' : 'player', id);
    if (imbues) neutral++;
  }
  assert.ok(neutral > 0);
  assert.equal(CARD_POOL_LABELS.unit, 'Unit Cards');
});
