// ===================================================================
// VILLAIN ARC GAME
// Picks the view for the run's current phase. Every view reports player
// input as a RunAction; this component never changes game state itself.
// ===================================================================

import type { RunAction, RunState } from '../../../shared/game/run';
import { CombatView } from './CombatView';
import { GraveView } from './GraveView';
import { OfferView } from './OfferView';
import { RouteView } from './RouteView';
import { RunHud } from './RunHud';

// --- TYPES ---
export type VillainArcGameProps = {
  run: RunState;
  onAction: (action: RunAction) => void;
};

// --- SUBCOMPONENTS ---
/** The body for the current phase. */
const PhaseBody = ({ run, onAction }: VillainArcGameProps) => {
  const { phase } = run;
  switch (phase.kind) {
    case 'route':
      return <RouteView options={phase.options} onAction={onAction} />;
    case 'combat':
      return (
        <CombatView key={run.stop} combat={phase.combat} onAction={onAction} />
      );
    case 'reward':
      return (
        <OfferView
          title="Spoils of war"
          subtitle="Add one card to your deck."
          offers={phase.offers}
          onAction={onAction}
        />
      );
    case 'altar':
      return (
        <OfferView
          title="The Dark Altar"
          subtitle="Power, for a price you already paid."
          offers={phase.offers}
          onAction={onAction}
        />
      );
    case 'grave':
      return <GraveView maxHp={run.maxHp} onAction={onAction} />;
    case 'fallen':
      return null;
  }
};

// --- COMPONENT ---
/** HUD on top, the phase view filling the rest. */
export const VillainArcGame = ({ run, onAction }: VillainArcGameProps) => (
  <div className="flex min-h-screen w-full flex-col">
    <RunHud run={run} />
    <main className="flex flex-1 flex-col items-center justify-center p-3">
      <PhaseBody run={run} onAction={onAction} />
    </main>
  </div>
);
