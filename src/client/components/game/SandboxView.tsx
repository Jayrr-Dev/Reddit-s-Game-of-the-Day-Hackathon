// ===================================================================
// SANDBOX VIEW (TARGET DUMMIES)
// A practice fight for testing cards: random heroes in random spots,
// every card, endless energy. The pause menu rolls new dummies, picks
// a preset scenario or a themed test deck, or leaves. Nothing here is scored, saved or sent to the server.
// ===================================================================

import { useState } from 'react';
import { useSandbox } from '../../hooks/useSandbox';
import { Button } from '../ui/Button';
import { CombatView } from './CombatView';
import { MAP_NAMES, PRACTICE_TERRAIN_START } from './combat/Backdrop';
import { ScenarioPicker } from './ScenarioPicker';

// --- COMPONENT ---
/** Renders the practice fight with reshuffle and leave in its pause menu. */
export const SandboxView = ({ onExit }: { onExit: () => void }) => {
  const { combat, round, deckId, act, reshuffle, summon, pickDeck } =
    useSandbox();
  const [selectedMap, setSelectedMap] = useState<number | null>(null);
  const terrainIndex = selectedMap ?? ((PRACTICE_TERRAIN_START + round) % MAP_NAMES.length);
  return (
    <div className="h-full w-full overflow-hidden">
      <CombatView
        key={round}
        combat={combat}
        terrainIndex={terrainIndex}
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
              terrainIndex={terrainIndex}
              onPickMap={setSelectedMap}
              deckId={deckId}
              onPickScenario={(scenario) =>
                summon(scenario.heroIds, scenario.startsInPlace)
              }
              onPickDeck={pickDeck}
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
