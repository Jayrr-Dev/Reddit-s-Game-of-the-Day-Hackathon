// ===================================================================
// IMAGE ASSET STEM TESTS
// ===================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetStemCandidates, fileStemOf } from './imageAssetStem.ts';

void test('fileStemOf drops folders, query and extension', () => {
  assert.equal(fileStemOf('/src/client/assets/heroes/cerviel-bow.webp?t=1'), 'cerviel-bow');
  assert.equal(fileStemOf('walnut.webp'), 'walnut');
});

void test('dev URLs keep their stem', () => {
  assert.deepEqual(assetStemCandidates('/src/client/assets/table/walnut.webp'), ['walnut']);
});

void test('built URLs also try the stem without the content hash', () => {
  assert.deepEqual(assetStemCandidates('/assets/cerviel-bow-AbC1_x-9.webp'), ['cerviel-bow-AbC1_x-9', 'cerviel-bow']);
  assert.deepEqual(assetStemCandidates('/assets/fulgur-dragonknight-idle-Zz09azAZ.webp'), [
    'fulgur-dragonknight-idle-Zz09azAZ',
    'fulgur-dragonknight-idle',
  ]);
});
