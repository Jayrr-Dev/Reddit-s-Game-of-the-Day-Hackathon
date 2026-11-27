import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canChooseRegion, regionChoices, regionOfRun } from './regionRoutes.ts';
import { stopLocation } from './routeLocation.ts';
import { createRun, isRunAction, runReducer, type RunState } from './run.ts';

void test('a verified clear opens two destinations and the choice sets the region without skipping a stop', () => {
  const start = createRun('regions');
  assert.equal(canChooseRegion(start), false);
  assert.equal(isRunAction({ type: 'chooseRegion', option: 2 }), false);
  assert.equal(runReducer(start, { type: 'chooseRegion', option: 1 }), start);
  const next: RunState = { ...start, stop: 6, stats: { ...start.stats, regionsConquered: 1 } };
  assert.equal(canChooseRegion({ ...next, stats: start.stats }), false);
  assert.equal(canChooseRegion(next), true);
  assert.deepEqual(regionChoices(1).map(x => x.name), ["King's Road", 'Riverlands']);
  const east = runReducer(next, { type: 'chooseRegion', option: 1 });
  assert.equal(regionOfRun(east), 'Riverlands');
  assert.equal(east.phase.kind, 'route');
  assert.equal(east.stop, 6);
  assert.equal(canChooseRegion(east), false);
  assert.equal(runReducer(east, { type: 'chooseRegion', option: 0 }), east);
  assert.equal(runReducer(east, { type: 'chooseStop', option: 0 }).phase.kind, 'combat');
  assert.equal(stopLocation(6, 0, 'horde', 1).name, 'River Bridge');
  assert.equal(stopLocation(7, 0, 'horde', 1).name, 'Old Aqueduct');
  assert.equal(stopLocation(16, 0, 'horde', 1).name, 'Dungeon');
  assert.equal(stopLocation(17, 0, 'horde', 1).name, 'Mines');
  assert.equal(stopLocation(18, 0, 'horde', 1).name, 'Cave');
});
