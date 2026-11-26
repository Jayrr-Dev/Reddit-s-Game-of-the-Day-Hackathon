import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMagicCircle, MAGIC_CIRCLE_RADIUS, type MagicCircleComplexity } from './magicCircle.ts';

// --- HELPERS ---
/** Every x, y pair of plain M/L points in a path (arc radii are skipped). */
const pointsOf = (d: string) =>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((match) => [Number(match[1]), Number(match[2])] as const);

const LEVELS: MagicCircleComplexity[] = ['small', 'large', 'complex'];

// --- TESTS ---
void test('the same seed gives the same circle, a new seed a different one', () => {
  const first = buildMagicCircle({ complexity: 'complex', seed: 7 });
  assert.deepEqual(buildMagicCircle({ complexity: 'complex', seed: 7 }), first);
  assert.notDeepEqual(buildMagicCircle({ complexity: 'complex', seed: 8 }), first);
});

void test('more complexity adds parts', () => {
  const counts = LEVELS.map((complexity) => buildMagicCircle({ complexity, seed: 3 }).length);
  assert.ok(counts[0]! < counts[1]! && counts[1]! < counts[2]!, `layer counts ${counts.join(', ')}`);
  const complexParts = new Set(buildMagicCircle({ complexity: 'complex', seed: 3 }).map((layer) => layer.part));
  for (const part of ['runes', 'gear', 'star', 'core'] as const) assert.ok(complexParts.has(part), part);
});

void test('every point stays inside the circle for many seeds', () => {
  for (const complexity of LEVELS) {
    for (let seed = 0; seed < 40; seed += 1) {
      for (const layer of buildMagicCircle({ complexity, seed })) {
        for (const [x, y] of pointsOf(layer.d)) {
          assert.ok(Math.hypot(x, y) <= MAGIC_CIRCLE_RADIUS + 0.01, `${complexity} seed ${seed} ${layer.part} at ${x},${y}`);
          assert.ok(Number.isFinite(x) && Number.isFinite(y));
        }
      }
    }
  }
});
