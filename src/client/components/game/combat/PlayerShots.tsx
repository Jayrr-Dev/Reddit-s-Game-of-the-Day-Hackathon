// ===================================================================
// PLAYER SHOTS
// Draws your arrows and magic bolts in flight (see usePlayerShots) on a
// fixed, click-through layer above the fight.
// ===================================================================

import { Projectile, type ProjectileFlight } from './Projectile';

// --- COMPONENT ---
/** Renders every shot of yours in flight. */
export const PlayerShots = ({
  shots,
}: {
  shots: readonly ProjectileFlight[];
}) => (
  <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
    {shots.map((shot) => (
      <Projectile key={shot.id} flight={shot} />
    ))}
  </div>
);
