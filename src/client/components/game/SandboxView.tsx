// ===================================================================
// SANDBOX VIEW (TARGET DUMMIES)
// A practice fight for testing cards: random heroes in random spots,
// every card, endless energy. The pause menu rolls new dummies or
// leaves. Nothing here is scored, saved or sent to the server.
// ===================================================================

import { TEST_CREATURE_IDS } from '../../../shared/game/heroes';
import { useSandbox } from '../../hooks/useSandbox';
import { Button } from '../ui/Button';
import { CombatView } from './CombatView';

// --- CONSTANTS ---
/** The sandbox's backdrop hue (a neutral dusk). */
const SANDBOX_HUE = 30;
/**
 * The horde summoned with the test creatures: they hold the front, and
 * two grunts stand behind so area and back-row cards have targets.
 */
const TEST_HORDE = [...TEST_CREATURE_IDS, 'archer', 'priest'] as const;

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
            <Button
              variant="menu"
              className="max-w-60"
              onClick={() => summon(TEST_HORDE)}
            >
              Summon test creature
            </Button>
            <Button variant="menu" className="max-w-60" onClick={onExit}>
              Leave practice
            </Button>
          </>
        }
      />
    </div>
  );
};
