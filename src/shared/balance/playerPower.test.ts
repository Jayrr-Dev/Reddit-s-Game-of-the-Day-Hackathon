import assert from 'node:assert/strict';
import test from 'node:test';
import { COST_CURVE_CONFIG } from './costCurveConfig.ts';
import { playerPower, skillBonusAt } from './playerPower.ts';
import { PLAY_STYLES } from './playerStyles.ts';

void test('Skill steps are bought in order while points last', () => {
  const steps = [
    { name: 'Entry', points: 3 },
    { name: 'Edge', points: 5, damage: 1.25 },
    { name: 'Cap', points: 1, damage: 1.2 },
  ];
  assert.deepEqual(skillBonusAt(steps, 7).bought, ['Entry']);
  assert.equal(skillBonusAt(steps, 9).damage, 1.25 * 1.2);
});

void test('Every style gets stronger from level 1 to level 50', () => {
  for (const style of PLAY_STYLES) {
    const early = playerPower(COST_CURVE_CONFIG, style, 1);
    const late = playerPower(COST_CURVE_CONFIG, style, 50);
    assert.ok(late.power > early.power, style.id);
    assert.ok(late.hp >= early.hp && late.damagePerTurn > early.damagePerTurn, style.id);
  }
});
