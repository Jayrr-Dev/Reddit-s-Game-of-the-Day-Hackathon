import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HEROES, type HeroId } from '../../shared/game/heroes.ts';
import { bossEntranceOf } from './bossEntrances.ts';

// --- BOSS DIALOGUE ---
void test('every boss has a distinct, short introduction without naming the player', () => {
  const bossIds = Object.keys(HEROES).filter((id): id is HeroId => Object.hasOwn(HEROES, id)).filter((id) => HEROES[id].tier === 'boss');
  const lines = bossIds.map((id) => {
    const { epithet, line } = bossEntranceOf(id);
    assert.notEqual(epithet, 'Champion of the Realm', id);
    assert.ok(line.trim() && line.length <= 100, id);
    assert.doesNotMatch(line, /\b(?:wrath|wraith)\b/i, id);
    return line;
  });
  assert.equal(new Set(lines).size, lines.length);
});

void test('Rio captions and Sol dialogue still match their recorded scripts', () => {
  const rio = bossEntranceOf('grandGriffon');
  assert.equal(rio.voice?.cue, 'bossRioVoice');
  assert.equal(rio.voice?.captions?.map(({ text }) => text).join(' ').toLowerCase(), rio.line.toLowerCase());
  const sol = bossEntranceOf('holyDragon');
  assert.equal(sol.voice?.cue, 'bossUncVoice');
  assert.equal(sol.line, 'I kept this flame when your kingdom was ash.');
});
