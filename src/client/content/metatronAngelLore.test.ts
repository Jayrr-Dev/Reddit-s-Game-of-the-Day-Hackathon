import test from 'node:test';
import assert from 'node:assert/strict';
import { HEROES, unitTypeOf, type HeroId } from '../../shared/game/heroes.ts';
import { METATRON_ANGEL_LORE } from './metatronAngelLore.ts';

test('Metatron has a distinct shop line for every angel in the roster', () => {
  const angelIds = (Object.keys(HEROES) as HeroId[]).filter(id => unitTypeOf(id) === 'angel').sort();
  assert.deepEqual(Object.keys(METATRON_ANGEL_LORE).sort(), angelIds);
  const lines = Object.values(METATRON_ANGEL_LORE);
  assert.equal(new Set(lines).size, lines.length);
  assert.ok(lines.every(line => line.trim().length > 0));
});
