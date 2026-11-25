import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCard } from './cards.ts';
import { starterDeck, starterNames } from './starters.ts';
import { createRun, isRunAction, runReducer, type RunAction } from './run.ts';
import { replayForScore } from './replayForScore.ts';

test('each starter is Basic and its edited deck is identical in a score replay', () => {
  for (const name of starterNames) {
    const cards = starterDeck(name);
    assert.equal(cards.length, 11);
    assert.ok(cards.every(id => getCard(id).rarity === 'basic'));
    cards[cards.length - 1] = 'darkCloak';
    const action: RunAction = { type: 'starterDeck', name, cards };
    assert.ok(isRunAction(action));
    const run = runReducer(createRun('test'), action);
    assert.deepEqual(run.deck, cards);
    assert.deepEqual(replayForScore('test', [action]).deck, run.deck);
    const fight = runReducer(run, { type: 'chooseStop', option: 0 });
    assert.equal(runReducer(fight, action), fight);
  }
  assert.equal(isRunAction({type:'starterDeck',name:'Mage',cards:Array(11).fill('decimate')}),false);
});
