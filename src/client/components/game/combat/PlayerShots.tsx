// ===================================================================
// PLAYER SHOTS
// Draws your arrows and magic bolts in flight, and your Melee swings
// (see usePlayerShots), on a fixed, click-through layer above the fight.
// ===================================================================

import type { SweepFlight } from '../../../lib/meleeSweep';
import { MeleeSweep } from './MeleeSweep';
import { Projectile, type ProjectileFlight } from './Projectile';
import { CombatFxPreload } from './CombatFx';

// --- COMPONENT ---
/** Renders every shot of yours in flight and every swing. */
export const PlayerShots = ({
  shots,
  sweeps,
}: {
  shots: readonly ProjectileFlight[];
  sweeps: readonly SweepFlight[];
}) => (
  <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
    <CombatFxPreload />
    {sweeps.map((sweep) => (
      <MeleeSweep key={sweep.id} sweep={sweep} />
    ))}
    {shots.map((shot) => (
      <Projectile key={shot.id} flight={shot} />
    ))}
  </div>
);
