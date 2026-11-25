import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseReliefOffsets, laneReliefPoints, reliefIntersections } from './fieldRelief.ts';

const ground = { left: 0, top: 10, width: 300, height: 200 };
const spots = reliefIntersections(ground, .5);
const unit = (x: number, y = 100, row = 'back', movable = true) => ({
  feet: { x, y }, body: { left: x - 13, top: y - 30, width: 26, height: 30 }, row, movable, spots,
});
const still = { x: 0, y: 0 };

test('the relief points follow the same perspective rays and the front edge of each row', () => {
  const near = reliefIntersections(ground, 1);
  assert.deepEqual(spots[3], { x: 150, y: 110 });
  assert.equal(near[3]?.y, 210);
  assert.ok(near[4]!.x > spots[4]!.x);
  assert.ok(near[0]!.x < ground.left);
});

test('clear primary spots are preserved, including a normally layered distant unit', () => {
  assert.deepEqual(chooseReliefOffsets([unit(105), unit(150), unit(150, 73, 'horizon')], ground), [still, still, still]);
});

test('only the overlapping unit moves to an unoccupied relief intersection on its own edge', () => {
  const units = [unit(150), unit(150), unit(99)];
  const offsets = chooseReliefOffsets(units, ground);
  assert.deepEqual(offsets[0], still);
  assert.deepEqual(offsets[2], still);
  const moved = offsets[1]!;
  assert.ok(moved.x > 0);
  assert.ok(spots.some(spot => spot.x === 150 + moved.x && spot.y === 100 + moved.y));
  assert.deepEqual(chooseReliefOffsets([units[1]!], ground), [still]);
});

test('relief does not move fixed bosses or send units outside the field', () => {
  const fixed = unit(150, 100, 'back', false);
  assert.deepEqual(chooseReliefOffsets([fixed, unit(150)], { ...ground, width: 170, left: 130 }), [still, {x: 51, y: 10}]);
  assert.deepEqual(chooseReliefOffsets([fixed, unit(150)], { ...ground, width: 40, left: 130 }), [still, still]);
});

test('units can use relief for a paired-intent overlap even when their bodies are already clear', () => {
  const far = { ...unit(145, 88, 'back'), plate: { left: 97, top: 30, width: 96, height: 34 } };
  const near = { ...unit(155, 126, 'front'), plate: { left: 101, top: 48, width: 89, height: 48 } };
  assert.notDeepEqual(chooseReliefOffsets([far, near], ground), [still, still]);
  assert.deepEqual(chooseReliefOffsets([far], ground), [still]);
});

test('asymmetric intent footprints must fit inside the battlefield before taking a relief point', () => {
  const model = { ...unit(38), plate: { left: -9, top: 37, width: 79, height: 36 } };
  const fixed = { ...unit(240, 100, 'front', false), plate: { left: 207, top: 38, width: 80, height: 35 } };
  const [adjusted, boss] = chooseReliefOffsets([model, fixed], ground);
  assert.ok(adjusted && model.plate.left + adjusted.x >= ground.left);
  assert.deepEqual(boss, still);
});

test('flexible relief points stay within the row band and include non-intersection ground', () => {
  const frame = { left: 5, top: 0, width: 290, height: 225 };
  const base = unit(150, 100);
  const plate = { left: 100, top: 62, width: 100, height: 26 };
  const points = laneReliefPoints(ground, .2, .5, base.feet, base.body, plate, frame);
  assert.ok(points.some(p => p.y > 50 && p.y < 110 && p.x !== 150));
  assert.ok(points.every(p => p.y >= 50 && p.y <= 110 && p.x >= 55 && p.x <= 245));
  const blocked = { ...base, plate, movable: false };
  const flexible = { ...base, plate, spots: points };
  const [first, offset] = chooseReliefOffsets([blocked, flexible], frame);
  assert.deepEqual(first, still);
  assert.ok(offset && (offset.x !== 0 || offset.y !== 0));
  assert.ok(points.some(p => p.x === base.feet.x + offset.x && p.y === base.feet.y + offset.y));
});
