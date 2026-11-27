import assert from 'node:assert/strict';
import test from 'node:test';
import { getHero, HEROES } from '../game/heroes.ts';
import { COST_CURVE_CONFIG, withOverride } from './costCurveConfig.ts';
import { allUnitPowers, toughnessOf, unitPower, villainDamagePerTurn } from './unitPower.ts';

const CONFIG = COST_CURVE_CONFIG;

void test('The villain deals a full turn of energy at the curve price', () => {
  assert.equal(villainDamagePerTurn(CONFIG), 24);
});

void test('Power is threat times the turns it takes to kill the unit', () => {
  const squire = unitPower(CONFIG, 'squire');
  // Swing 5, Raise Shield (Guard 4 + 3): 6 a turn on average; 14 HP in the front line.
  assert.equal(squire.threat, 6);
  assert.equal(squire.toughness, 14);
  assert.equal(squire.power, Math.round(6 * (14 / 24) * 10) / 10);
});

void test('Armor and standing out of Melee reach both add toughness', () => {
  assert.ok(toughnessOf(CONFIG, getHero('brannoc')) > getHero('brannoc').maxHp);
  assert.equal(toughnessOf(CONFIG, getHero('archer')), 10 * (1 + CONFIG.unit.backlineShield));
});

void test('Every unit gets a finite, positive power and overrides change it', () => {
  const powers = allUnitPowers(CONFIG);
  assert.equal(powers.length, Object.keys(HEROES).length);
  for (const unit of powers) assert.ok(Number.isFinite(unit.power) && unit.power > 0, unit.id);
  const tougherVillain = withOverride(CONFIG, 'curve.energyValue', 16);
  assert.ok(unitPower(tougherVillain, 'squire').power < unitPower(CONFIG, 'squire').power);
});
