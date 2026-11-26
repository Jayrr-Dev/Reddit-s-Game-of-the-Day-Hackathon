// ===================================================================
// UNIT STAT OVERRIDES TESTS
// ===================================================================

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getCatalogHero, getHero } from './heroes.ts';
import { isUnitStatOverrides, setUnitOverrides, withUnitOverride } from './unitOverrides.ts';

afterEach(() => setUnitOverrides({}));

void test('an override replaces only the stats it names', () => {
  setUnitOverrides({ squire: { maxHp: 99 } });
  assert.equal(getHero('squire').maxHp, 99);
  assert.equal(getHero('squire').speed, getCatalogHero('squire').speed);
  assert.equal(getCatalogHero('squire').maxHp, 14);
});

void test('a null override resets the unit to the catalog', () => {
  const overrides = withUnitOverride({ squire: { maxHp: 99 } }, 'squire', null);
  setUnitOverrides(overrides);
  assert.deepEqual(overrides, {});
  assert.equal(getHero('squire').maxHp, 14);
});

void test('overrides outside the allowed stats or ranges are rejected', () => {
  assert.equal(isUnitStatOverrides({ squire: { maxHp: 20, armor: 2 } }), true);
  assert.equal(isUnitStatOverrides({ squire: { maxHp: 0 } }), false);
  assert.equal(isUnitStatOverrides({ squire: { maxHp: 2.5 } }), false);
  assert.equal(isUnitStatOverrides({ squire: { name: 'X' } }), false);
});
