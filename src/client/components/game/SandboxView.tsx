// ===================================================================
// SANDBOX VIEW (TARGET DUMMIES)
// A practice fight for testing cards: random heroes in random spots,
// every card, endless energy. The pause menu rolls new dummies, picks
// a preset scenario, or leaves. Nothing here is scored, saved or sent to the server.
// ===================================================================

import { useSandbox } from '../../hooks/useSandbox';
import { Button } from '../ui/Button';
import { CombatView } from './CombatView';
import { ScenarioPicker } from './ScenarioPicker';

// --- CONSTANTS ---
/** The sandbox's backdrop hue (a neutral dusk). */
const SANDBOX_HUE = 30;

// --- COMPONENT ---
/** Renders the practice fight with reshuffle and leave in its pause menu. */
export const SandboxView = ({ onExit }: { onExit: () => void }) => {
  const { combat, round, act, reshuffle, summon } = useSandbox();
  return (
    <div className="h-full w-full overflow-hidden">
      <CombatView
        key={round}
        combat={combat}
        hue={SANDBOX_HUE}
        where="Target dummies · practice"
        score={0}
        onAction={act}
        pauseActions={
          <>
            <Button
              variant="menuPrimary"
              className="max-w-60"
              onClick={reshuffle}
            >
              New dummies
            </Button>
            <ScenarioPicker
              onPick={(scenario) =>
                summon(scenario.heroIds, scenario.startsInPlace)
              }
            />
            <Button variant="menu" className="max-w-60" onClick={onExit}>
              Leave practice
            </Button>
          </>
        }
      />
    </div>
  );
};
