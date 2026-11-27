import assert from 'node:assert/strict';
import test from 'node:test';
import { goldFromWins } from './gold.ts';

test('Gold starts at zero and credits ten for every recorded wave', () => {
  assert.equal(goldFromWins(0), 0);
  assert.equal(goldFromWins(1), 10);
  assert.equal(goldFromWins(27), 270);
});
