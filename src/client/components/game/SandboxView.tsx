// --- ILLUSION TRAINING ---
import { useState, type ReactNode } from 'react';
import { useGameSettings } from '../../hooks/useGameSettings';
import { useSandbox } from '../../hooks/useSandbox';
import { Button } from '../ui/Button';
import { DeathScreen } from './DeathScreen';
import { CombatView } from './CombatView';
import { MAP_IMAGES, MAP_NAMES, PRACTICE_TERRAIN_START } from './combat/Backdrop';
import { SettingsDialog } from './menu/SettingsDialog';
import { bossArenaOf, type BossArena } from '../../content/bossArenas';
import { ScenarioPicker } from './ScenarioPicker';

/** Setup uses the same settings as the combat pause menu. */
const SetupSettings = () => {
  const { controls } = useGameSettings();
  return <SettingsDialog className="self-center">{controls}</SettingsDialog>;
};

/** Opens configuration before a scenario or random fight is chosen. */
export const SandboxView = ({ onExit }: { onExit: () => void }) => {
  const {
    combat, character, round, retry, retries, deckId, deck, activeCustomId,
    customDecks, saveCustomDeck, pickCustomDeck, act, respec, reshuffle, summon, pickDeck,
  } = useSandbox();
  const [selectedMap, setSelectedMap] = useState<number | null>(null);
  const [arenaOverride, setArenaOverride] = useState<BossArena | null | undefined>(undefined);
  const arena = arenaOverride !== undefined ? arenaOverride ?? undefined : combat ? bossArenaOf(combat.heroes.map(unit => unit.heroId), combat.fallen.map(unit => unit.heroId)) : undefined;
  const terrainIndex = selectedMap ?? (PRACTICE_TERRAIN_START + round) % MAP_NAMES.length;

  const trainingMenu = (resume: (() => void) | undefined, settings: ReactNode) => (
    <section role="dialog" aria-modal="true" aria-label="Illusion Training" className="training-menu">
      <header
        className="training-header flex items-center justify-between gap-2"
        style={{ backgroundImage: 'linear-gradient(90deg, #21150e 8%, #21150e70), url("' + (arena?.image ?? MAP_IMAGES[terrainIndex]) + '")' }}
      >
        <div>
          <h2>Illusion Training</h2>
          <span>{arena?.name ?? MAP_NAMES[terrainIndex]}</span>
        </div>
        {settings}
      </header>
      <ScenarioPicker
        renderTools={openDeck => (
          <div className="training-tools">
            <div className="training-actions">
              <Button variant="menu" onClick={openDeck}>Custom deck</Button>
              {resume && <Button variant="menu" onClick={reshuffle}>New opponents</Button>}
            </div>
          </div>
        )}
        terrainIndex={terrainIndex}
        onPickMap={index => { setSelectedMap(index); setArenaOverride(null); }}
        activeArena={arena}
        onPickArena={setArenaOverride}
        deckId={deckId}
        customDecks={customDecks}
        activeCustomId={activeCustomId}
        onPickCustom={pickCustomDeck}
        onSaveCustom={saveCustomDeck}
        onPickScenario={scenario => { setArenaOverride(undefined); summon(scenario.heroIds, scenario.startsInPlace); }}
        onPickDeck={pickDeck}
      />
      <footer className="training-footer">
        <Button variant="menu" onClick={onExit}>Leave training</Button>
        <Button variant="menuPrimary" onClick={resume ?? reshuffle}>
          {resume ? 'Resume' : 'Start random fight'}
        </Button>
      </footer>
    </section>
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!combat ? trainingMenu(undefined, <SetupSettings />) : (
        <>
          <div className="h-full" inert={combat.player.hp <= 0}>
            <CombatView
              key={round + ':' + retries}
              combat={combat}
              character={character}
              onRespec={respec}
              deck={deck}
              terrainIndex={terrainIndex}
              trainingArenaOverride={arenaOverride}
              where="Illusion Training"
              score={0}
              onAction={act}
              renderTrainingMenu={trainingMenu}
            />
          </div>
          {combat.player.hp <= 0 && (
            <DeathScreen title="Illusion broken" epitaph="The spell breaks. The wound leaves no mark."
              buttonLabel="Retry training" onContinue={retry} />
          )}
        </>
      )}
    </div>
  );
};

