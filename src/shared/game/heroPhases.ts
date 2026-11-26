type CervielSupportId = 'grandangelCerviel' | 'cervielBow';
import type { HeroDef, HeroMove, HeroUnit } from './types.ts';

/** The first lethal beat converts an opted-in boss in place, exactly once. */
export function enterHeroSecondPhase(unit: HeroUnit, definition: HeroDef): HeroUnit {
  const phase = definition.secondPhase;
  if (!phase || unit.phase === 2 || unit.hp > 0) return unit;
  return { ...unit, hp: Math.max(1, Math.ceil(unit.maxHp * phase.restoreHpFraction)), phase: 2, moveIndex: 0 };
}

export function movesForHeroPhase(unit: HeroUnit, definition: HeroDef) {
  return unit.phase === 2 && definition.secondPhase ? definition.secondPhase.moves : definition.moves;
}

/** Staff and Bow occupy opposite back-line flanks and only Sword can call them. */
export function cervielSummonMoves(staff: CervielSupportId, bow: CervielSupportId): readonly HeroMove[] {
  return [
    { name: 'Call Staff', effects: [{ kind: 'summon', heroId: staff, count: 1, onceAt: { row: 'back', col: 0 } }] },
    { name: 'Call Bow', effects: [{ kind: 'summon', heroId: bow, count: 1, onceAt: { row: 'back', col: 2 } }] },
  ];
}

export function cervielSecondPhase(staff: CervielSupportId, bow: CervielSupportId): NonNullable<HeroDef['secondPhase']> {
  return {
    restoreHpFraction: 0.5,
    visual: 'cervielBladeVolley',
    moves: [
      ...cervielSummonMoves(staff, bow),
      { name: 'Sixfold Judgment', visual: 'cervielBladeVolley',
        effects: [{ kind: 'attack', amount: 3, hits: 6, type: 'magic' }] },
    ],
  };
}
