// --- ILLUSION TRAINING ---
import { useState, type ReactNode } from 'react';
import { useGameSettings } from '../../hooks/useGameSettings';
import { useSandbox } from '../../hooks/useSandbox';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { IconButton } from '../ui/IconButton';
import { DeathScreen } from './DeathScreen';
import { CombatView } from './CombatView';
import { MAP_IMAGES, MAP_NAMES, PRACTICE_TERRAIN_START } from './combat/Backdrop';
import { SettingsDialog } from './menu/SettingsDialog';
import { bossArenaOf, type BossArena } from '../../content/bossArenas';
import type { SandboxScenario } from '../../../shared/game/sandbox';
import { ScenarioPicker } from './ScenarioPicker';
import { useThemePreview } from '../../hooks/useThemePreview';
import { useProgressiveImage } from '../../hooks/useProgressiveImage';
import { useUnlocks } from '../../hooks/useUnlocks';
import { canRollDummies } from '../../../shared/game/sandbox';
import { dummyHeroes, isMapUnlocked, type UnlockAccess } from '../../../shared/game/unlocks';

// --- PRACTICE TERRAIN ---
/**
 * The backdrop a fight uses when no map is picked: it cycles every map
 * from the elven forest for admins, and only visited maps for everyone
 * else (the first map before any run).
 */
const practiceTerrain = (access: UnlockAccess, round: number): number => {
  if (access === null) return (PRACTICE_TERRAIN_START + round) % MAP_NAMES.length;
  const visited = MAP_NAMES.flatMap((name, index) => (isMapUnlocked(access, name) ? [index] : []));
  return visited.length > 0 ? visited[round % visited.length] ?? 0 : 0;
};

/** Setup uses the same settings as the combat pause menu. */
const SetupSettings = () => {
  const { controls } = useGameSettings();
  return <SettingsDialog className="self-center">{controls}</SettingsDialog>;
};

/** Opens configuration before a scenario or random fight is chosen. */
export const SandboxView = ({ onExit }: { onExit: () => void }) => {
  const access = useUnlocks();
  const canRandomFight = canRollDummies(dummyHeroes(access));
  const {
    combat, character, round, retry, leaveFight, retries, deckId, deck, activeCustomId,
    customDecks, saveCustomDeck, pickCustomDeck, act, respec, reshuffle, summon, pickDeck,
  } = useSandbox(access);
  const [selectedMap, setSelectedMap] = useState<number | null>(null);
  const [arenaOverride, setArenaOverride] = useState<BossArena | null | undefined>(undefined);
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);
  const arena = arenaOverride !== undefined ? arenaOverride ?? undefined : combat ? bossArenaOf(combat.heroes.map(unit => unit.heroId), combat.fallen.map(unit => unit.heroId)) : undefined;
  const terrainIndex = selectedMap ?? practiceTerrain(access, round);
  const themePreview = useThemePreview(MAP_NAMES[terrainIndex] ?? '');
  const headerArt = useProgressiveImage(arena?.image ?? MAP_IMAGES[terrainIndex] ?? '');
  /** Runs a menu action after silencing any theme preview, so fight music takes over. */
  const thenStopPreview = <A extends unknown[]>(action: (...args: A) => void) => (...args: A) => { themePreview.stop(); action(...args); };

  const trainingMenu = (resume: (() => void) | undefined, settings: ReactNode) => (
    <section role="dialog" aria-modal="true" aria-label="Illusion Training" className="training-menu">
      <ScenarioPicker
        renderHeader={openDeck => (
          <header
            className="training-header"
            style={{ backgroundImage: 'linear-gradient(90deg, #21150e 8%, #21150e70), url("' + headerArt.src + '")' }}
          >
            <IconButton icon="back" label="Back to menu" onClick={thenStopPreview(onExit)} />
            <div className="min-w-0 mr-auto">
              <h2>Illusion Training</h2>
              <span>{arena?.name ?? MAP_NAMES[terrainIndex]}</span>
            </div>
            {/* Banner actions sit on the image so the picker keeps the vertical space. */}
            <div className="training-actions">
              <Button variant="menu" onClick={openDeck}>Custom deck</Button>
              {resume && canRandomFight && <Button variant="menu" onClick={reshuffle}>New opponents</Button>}
              {settings}
            </div>
          </header>
        )}
        terrainIndex={terrainIndex}
        access={access}
        onPickMap={thenStopPreview((index: number) => { setSelectedMap(index); setArenaOverride(null); })}
        activeArena={arena}
        onPickArena={thenStopPreview(setArenaOverride)}
        deckId={deckId}
        customDecks={customDecks}
        activeCustomId={activeCustomId}
        onPickCustom={pickCustomDeck}
        onSaveCustom={saveCustomDeck}
        onPickScenario={thenStopPreview((scenario: SandboxScenario) => { setArenaOverride(undefined); summon(scenario.heroIds, scenario.startsInPlace); })}
        onPickDeck={pickDeck}
        themePreview={themePreview}
      />
      <footer className="training-footer">
        <Button variant="menu" onClick={thenStopPreview(onExit)}>Leave training</Button>
        <Button variant="menuPrimary" disabled={!resume && !canRandomFight} onClick={thenStopPreview(resume ?? reshuffle)}>
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
              musicMuted={themePreview.isPreviewing}
              where="Illusion Training"
              score={0}
              onAction={act}
              renderTrainingMenu={trainingMenu}
              onExitBattle={() => setIsConfirmingExit(true)}
            />
          </div>
          {/* A corner tap mid-fight is easy to make by accident, so ask first. */}
          {isConfirmingExit && (
            <ConfirmDialog title="Exit battle?" confirmLabel="Exit" cancelLabel="Keep fighting"
              onConfirm={thenStopPreview(() => { setIsConfirmingExit(false); leaveFight(); })}
              onCancel={() => setIsConfirmingExit(false)}>
              This illusion ends and you return to the training scenarios.
            </ConfirmDialog>
          )}
          {combat.player.hp <= 0 && (
            <DeathScreen title="Illusion broken" epitaph="The spell breaks. The wound leaves no mark."
              buttonLabel="Retry training" onContinue={retry} />
          )}
        </>
      )}
    </div>
  );
};

