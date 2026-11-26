import type { Hit } from '../hooks/useHitPops';

export type CombatFxKind = 'silver-slash' | 'weapon-impact' | 'ground-slam' | 'projectile-speed';

/** Only actual physical hits get these effects. Magic and status ticks keep their own art. */
export function physicalImpactOf(hit: Pick<Hit, 'amount' | 'source' | 'tick' | 'edge'>) {
  if (hit.amount <= 0 || hit.tick !== undefined || hit.source !== 'melee') return null;
  return hit.edge === 'blunt' ? 'ground-slam' : 'weapon-impact';
}
