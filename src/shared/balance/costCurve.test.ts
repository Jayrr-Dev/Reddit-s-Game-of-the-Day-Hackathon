import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_CARD_IDS, getCard, isCardInPlay } from '../game/cards.ts';
import { cardValueParts, scoreAllCards, scoreCard, targetValue } from './costCurve.ts';
import { COST_CURVE_CONFIG, withOverride } from './costCurveConfig.ts';
import { burnValue, hexValue } from './statusValues.ts';

const CONFIG = COST_CURVE_CONFIG;

void test('The target follows the curve: slot + energy x cost, times the rarity premium', () => {
  assert.equal(targetValue(CONFIG, 1, 'common'), 9);
  assert.equal(targetValue(CONFIG, 2, 'common'), 17);
  assert.equal(targetValue(CONFIG, 0, 'common'), CONFIG.curve.zeroCostFloor);
  assert.equal(targetValue(CONFIG, 1, 'basic'), 9 * CONFIG.rarityPremium.basic);
});

void test('Status values replay the game rules', () => {
  // Burn 3 deals 3, halves to 1, deals 1, then runs out.
  assert.equal(burnValue(3), 4);
  // Hex 5 counts through 4, 3, 2, 1, 0. Only 3 and 1 deal damage.
  const delay = CONFIG.battle.delayKeptPerTurn;
  assert.equal(hexValue(CONFIG, 1), 0);
  assert.equal(hexValue(CONFIG, 3), delay * CONFIG.battle.hexLandsLate);
  assert.equal(hexValue(CONFIG, 5), (3 * delay + delay ** 3) * CONFIG.battle.hexLandsLate);
});

void test('Every effect on every card in play gets a price', () => {
  for (const id of ALL_CARD_IDS.filter(isCardInPlay)) {
    const card = getCard(id);
    for (const part of cardValueParts(CONFIG, card)) {
      assert.ok(Number.isFinite(part.points), `${id}: ${part.label} is not a number`);
      // A lone Hex 1 ticks to zero; its value as setup is not modeled here.
      const isSetupHex = part.label === 'hex' && card.effects.some(effect => effect.kind === 'hex' && effect.amount === 1);
      if (!isSetupHex) assert.notEqual(part.points, 0, `${id}: ${part.label} is priced at 0; give it a price in costCurve.ts`);
    }
  }
});

void test('Known outliers land where the benchmark put them', () => {
  assert.equal(scoreCard(CONFIG, 'flurry').verdict, 'on curve');
  assert.equal(scoreCard(CONFIG, 'whisperHex').verdict, 'too weak');
  assert.equal(scoreCard(CONFIG, 'dispel').verdict, 'too weak');
  assert.equal(scoreAllCards(CONFIG).length, ALL_CARD_IDS.filter(isCardInPlay).length);
});

void test('An override changes one number and leaves the defaults alone', () => {
  const cheaperEnergy = withOverride(CONFIG, 'curve.energyValue', 6);
  assert.equal(targetValue(cheaperEnergy, 1, 'common'), 7);
  assert.equal(CONFIG.curve.energyValue, 8);
  assert.throws(() => withOverride(CONFIG, 'battle.typo', 1), /Unknown config number/);
});
