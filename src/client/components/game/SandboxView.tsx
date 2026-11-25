// ===================================================================
// SANDBOX VIEW (TARGET DUMMIES)
// A practice fight for testing cards: random heroes in random spots,
// every card, standard turn energy. The pause menu rolls new dummies, picks
// a preset scenario or a themed test deck, or leaves. Practice progression is local.
// ===================================================================

import { useState } from 'react';
import { useSandbox } from '../../hooks/useSandbox';
import { Button } from '../ui/Button';
import { DeathScreen } from './DeathScreen';
import { CombatView } from './CombatView';
import {
  MAP_IMAGES,
  MAP_NAMES,
  PRACTICE_TERRAIN_START,
} from './combat/Backdrop';
import { ScenarioPicker } from './ScenarioPicker';

// --- COMPONENT ---
/** Renders the practice fight with reshuffle and leave in its pause menu. */
export const SandboxView = ({ onExit }: { onExit: () => void }) => {
  const {
    combat,
    character,
    round, retry, retries,
    deckId,
    deck,
    activeCustomId,
    customDecks,
    saveCustomDeck,
    pickCustomDeck,
    act,
    respec,
    reshuffle,
    summon,
    pickDeck,
  } = useSandbox();
  const [selectedMap, setSelectedMap] = useState<number | null>(null);
  const terrainIndex =
    selectedMap ?? (PRACTICE_TERRAIN_START + round) % MAP_NAMES.length;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="h-full" inert={combat.player.hp <= 0}>
      <CombatView
        key={`${round}:${retries}`}
        combat={combat}
        character={character}
        onRespec={respec}
        deck={deck}
        terrainIndex={terrainIndex}
        where="Illusion Training"
        // Entering training opens the menu on Scenarios; later rounds don't.
        startsPaused={round === 0 && retries === 0}
        score={0}
        onAction={act}
        renderTrainingMenu={(resume, settings) => (
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Illusion Training"
            className="training-menu"
          >
            <header
              className="training-header flex items-center justify-between gap-2"
              style={{
                backgroundImage: `linear-gradient(90deg, #21150e 8%, #21150e70), url("${MAP_IMAGES[terrainIndex]}")`,
              }}
            >
              <div>
                <h2>Illusion Training</h2>
                <span>{MAP_NAMES[terrainIndex]}</span>
              </div>
              {settings}
            </header>
            <ScenarioPicker
              renderTools={openDeck => (
                <div className="training-tools">
                  <div className="training-actions">
                    <Button variant="menu" onClick={openDeck}>Custom deck</Button>
                    <Button variant="menu" onClick={reshuffle}>New opponents</Button>
                  </div>
                </div>
              )}
              terrainIndex={terrainIndex}
              onPickMap={setSelectedMap}
              deckId={deckId}
              customDecks={customDecks}
              activeCustomId={activeCustomId}
              onPickCustom={pickCustomDeck}
              onSaveCustom={saveCustomDeck}
              onPickScenario={(scenario) =>
                summon(scenario.heroIds, scenario.startsInPlace)
              }
              onPickDeck={pickDeck}
            />
            <footer className="training-footer">
              <Button variant="menu" onClick={onExit}>
                Leave training
              </Button>
              <Button
                variant="menuPrimary"
                
                onClick={resume}
              >
                Resume
              </Button>
            </footer>
          </section>
        )}
      />
      </div>
      {combat.player.hp <= 0 && <DeathScreen title="Illusion broken" epitaph="The spell breaks. The wound leaves no mark." buttonLabel="Retry training" onContinue={retry} />}
    </div>
  );
};
