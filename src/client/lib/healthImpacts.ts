export type Health = { hp: number; maxHp: number };
export type HealthImpact = { delay: number; hpChange: number; maxChange: number };

/** Match the HP display to timed hit batches, without counting blocked damage or overkill. */
export function healthImpacts(before: Health, after: Health, beats: readonly { delay: number; damage: number }[]): HealthImpact[] {
  const first = beats[0]?.delay ?? 0;
  const hpChange = after.hp - before.hp;
  const maxChange = after.maxHp - before.maxHp;
  if (!hpChange && !maxChange) return [];
  if (hpChange >= 0 || !beats.some(beat => beat.damage > 0)) return [{ delay: first, hpChange, maxChange }];

  let remaining = -hpChange;
  return beats.flatMap(({ delay, damage }, index) => {
    const drained = Math.min(remaining, index === beats.length - 1 ? remaining : damage);
    remaining -= drained;
    const capacity = index === 0 ? maxChange : 0;
    return drained || capacity ? [{ delay, hpChange: -drained, maxChange: capacity }] : [];
  });
}
