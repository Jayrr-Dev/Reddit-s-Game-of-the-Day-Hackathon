// ===================================================================
// VILLAIN ARC GAME
// Picks the view for the run's current phase. Every view reports player
// input as a RunAction; this component never changes game state itself.
// ===================================================================

import { regionIndexOf, regionName } from '../../../shared/game/kingdom';
import {
  computeScore,
  type RunAction,
  type RunState,
} from '../../../shared/game/run';
import { regionHue } from '../../content/visuals';
import { AbandonRun } from './combat/AbandonRun';
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
    case 'combat': {
      const region = regionIndexOf(run.stop);
      return (
        <CombatView
          key={run.stop}
          combat={phase.combat}
          hue={regionHue(region)}
          where={`Wave ${run.stop} · ${regionName(region)}`}
          score={computeScore(run.stats)}
          onAction={onAction}
          pauseActions={
            <AbandonRun onConfirm={() => onAction({ type: 'abandon' })} />
          }
        />
      );
    }
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
/**
 * Fills the post exactly (no page scroll inside the feed). Combat owns
 * the whole box; the other phases get the run HUD on top.
 */
export const VillainArcGame = ({ run, onAction }: VillainArcGameProps) => {
  if (run.phase.kind === 'combat')
    return (
      <div className="h-full w-full overflow-hidden">
        <PhaseBody run={run} onAction={onAction} />
      </div>
    );
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <RunHud run={run} />
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center p-3">
        <PhaseBody run={run} onAction={onAction} />
      </main>
    </div>
  );
};
