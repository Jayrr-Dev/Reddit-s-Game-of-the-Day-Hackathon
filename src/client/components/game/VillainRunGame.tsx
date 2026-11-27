// ===================================================================
// VILLAIN RUN GAME
// Picks the view for the run's current phase. Every view reports player
// input as a RunAction; this component never changes game state itself.
// ===================================================================

import { bossArenaOf } from '../../content/bossArenas';
import { playSound } from '../../lib/gameAudio';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { traitPointsAvailable, xpToNextLevel, type CharacterState } from '../../../shared/game/character';
import { skillPointsLeft } from '../../../shared/game/skills';
import { Button } from '../ui/Button';
import { regionIndexOf } from '../../../shared/game/kingdom';
import { chosenRegion, regionOfRun } from '../../../shared/game/regionRoutes';
import { PANDORA_CURSE_BOUNTY, PANDORA_RUN_COPY } from '../../../shared/game/pandora';
import { getItem } from '../../../shared/game/items';
import { appleAtVictory, goldRewardFor } from '../../../shared/game/gold';
import { BattleCharacterSheet } from './BattleCharacterSheet';
import {
  computeScore,
  optionsFor,
  type RunAction,
  type RunState,
} from '../../../shared/game/run';
import { AbandonRun } from './combat/AbandonRun';
import { DeathScreen } from './DeathScreen';
import { CombatView } from './CombatView';
import { GraveView } from './GraveView';
import { OfferView } from './OfferView';
import { routeLocation } from './routeLocation';
import { GreedBargain } from './GreedBargain';
import { getCard } from '../../../shared/game/cards';
import { ConquestMap } from './ConquestPrelude';
import { MAP_IMAGES, MAP_NAMES } from './combat/Backdrop';
import { AreaCamp } from './AreaCamp';
import { RunHud } from './RunHud';
import { useProgressiveImage } from '../../hooks/useProgressiveImage';

// --- TYPES ---
export type VillainRunGameProps = {
  endless?: boolean | undefined;
  run: RunState;
  runId?: string | undefined;
  onAction: (action: RunAction) => void;
  onMainMenu?: (() => void) | undefined;
};

// --- AUDIO AND PACING ---
const NEXT_WAVE_PAUSE_MS = 2000;
// The victory clip is 3.32 s. Let it finish before an earned level-up cue.
const LEVEL_UP_AFTER_VICTORY_MS = 3350;

// --- SUBCOMPONENTS ---
/** The body for the current phase. */
const PhaseBody = ({ run, runId, onAction, onMainMenu, endless }: VillainRunGameProps) => {
  const { phase } = run;

  switch (phase.kind) {
    case 'greed-bargain':
      return <GreedBargain run={run} onAction={onAction} />;
    case 'route':
      return <ConquestMap key={run.stop} runControls={onMainMenu ? { run, onAction, onMainMenu } : undefined} stop={run.stop} region={regionOfRun(run)} route={chosenRegion(run)} options={phase.options} worldSeed={run.dailyKey} atlasOptions={at => optionsFor(run, at)} onChoose={option => onAction({ type: 'chooseStop', option })} />;
    case 'combat': {
      const area = run.area;
      const battle = area?.battles[area.battle];
      const wave = area ? battle?.waves[area.wave] : undefined;
      const regionTitle = 'Wave ' + run.stop + ' · ' + regionOfRun(run);
      const battleTitle = area && battle ? 'Battle ' + (area.battle + 1) + '/' + area.battles.length + ' · Wave ' + (area.wave + 1) + '/' + battle.waves.length : regionTitle;
      const mapIndex = area ? MAP_NAMES.findIndex(name => name === area.site.map)
        : routeLocation(run.stop, phase.stop.optionIndex ?? 0, phase.stop.kind, chosenRegion(run)).terrain;
      const finalArena = battle?.waves.some(part => part.heroIds.includes('archangelMikhael'))
        ? bossArenaOf(['archangelMikhael']) : undefined;
      return (
        <CombatView
          key={run.stop + ':' + (area?.battle ?? 0)}
          combat={phase.combat}
          artifacts={run.artifacts}
          character={run.character}
          deck={run.deck}
          terrainIndex={mapIndex}
          {...(area && area.site.kind !== 'dragon' && { trainingArenaOverride: finalArena ?? null })}
          {...(area && { campaignLocation: finalArena?.name ?? area.site.name })}
          where={endless ? 'Endless · Wave ' + run.stop : wave && area?.wave !== 0 ? battleTitle + ' · ' + wave.name : battleTitle}
          score={endless ? run.stats.wavesCleared : computeScore(run.stats)}
          {...(endless && { scoreUnit: 'cleared' })}
          onAction={onAction}
          pauseActions={
            <>
              {endless && onMainMenu && <Button variant="menu" onClick={onMainMenu}>Main menu</Button>}
              <AbandonRun onConfirm={() => onAction({ type: 'abandon' })} />
            </>
          }
        />
      );
    }
    case 'area-camp':
      return <AreaCamp run={run} onAction={onAction} />;
    case 'reward':
      return (
        <OfferView
          title="Spoils of war"
          goldReward={runId && phase.source ? goldRewardFor(runId, run.stop, phase.source, run.pandoraEffect, run.area?.battle) : undefined}
          rerolls={phase.rerolled ? 0 : 1}
          subtitle={phase.bonusImbue ? 'Special drop: ' + getCard(phase.bonusImbue).name + ' added. Choose one more card.' : 'Add one card to your deck.'}
          unlockedRingSlot={run.storyRingUnlocked}
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
      return <GraveView character={run.character} maxHp={run.maxHp} onAction={onAction} />;
    case 'sealing':
    case 'conquered':
    case 'fallen':
      return null;
  }
};

/** The final fight stays visible behind the defeat overlay. */
export const StoryDefeat = ({ run, onContinue }: { run: RunState; onContinue: () => void }) => {
  if (run.phase.kind !== 'fallen' || !run.phase.battlefield) return null;
  const lastFight: RunState = { ...run, phase: { ...run.phase.battlefield, kind: 'combat' } };
  return <div className="relative h-full w-full overflow-hidden">
    <div className="h-full" inert><PhaseBody run={lastFight} onAction={() => {}} /></div>
    <DeathScreen onContinue={onContinue} buttonLabel="View results" />
  </div>;
};

/** A level-up summary keeps the new level, unspent points, and next goal together. */
function LevelUpDialog({ character, onClose, onOpenCharacter }: {
  character: CharacterState; onClose: () => void; onOpenCharacter: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const xpGoal = xpToNextLevel(character.level, character.legacyProgression, character.scaledExperience);
  const earnedTraits = traitPointsAvailable(character) -
    traitPointsAvailable({ ...character, level: character.level - 1 });
  useLayoutEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);
  return <dialog ref={dialog} className="level-up-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <p className="level-up-kicker">Level up!</p>
    <h2 id={titleId}>Level {character.level}</h2>
    <dl className="level-up-points">
      <div><dt>Trait points</dt><dd><strong>+{earnedTraits}</strong> earned <span>{traitPointsAvailable(character)} available</span></dd></div>
      <div><dt>Skill points</dt><dd><strong>+1</strong> earned <span>{skillPointsLeft(character)} available</span></dd></div>
    </dl>
    {xpGoal > 0 ? <div className="level-up-xp">
      <p>{xpGoal - character.xp} XP to level {character.level + 1}</p>
      <progress aria-label={'XP toward level ' + (character.level + 1)} value={character.xp} max={xpGoal} />
      <small>{character.xp} / {xpGoal} XP</small>
    </div> : <p className="level-up-kicker">Max level reached</p>}
    <footer>
      <Button variant="menu" onClick={onOpenCharacter}>Character Sheet</Button>
      <Button variant="menuPrimary" onClick={onClose}>Continue</Button>
    </footer>
  </dialog>;
}

// --- COMPONENT ---
/**
 * Fills the post exactly (no page scroll inside the feed). Combat owns
 * the whole box; the other phases get the run HUD on top.
 */
export const VillainRunGame = ({ run, runId, onAction, onMainMenu, endless }: VillainRunGameProps) => {
  const [showCharacter, setShowCharacter] = useState(false);
  const [dismissedLevel, setDismissedLevel] = useState<string>();
  const levelKey = (runId ?? run.dailyKey) + ':' + run.attempt + ':' + run.stop + ':' + run.character.level;
  const [readyWave, setReadyWave] = useState(run.stop);
  const lastPhase = useRef(run.phase.kind);
  const leveledAtReward = run.phase.kind === 'reward' && run.phase.leveledUp;
  const apple = runId && run.phase.kind === 'reward' && run.phase.source ? appleAtVictory(runId, run.stop, run.phase.source, run.area?.battle) : undefined;
  const startingNextWave = !endless && !run.area && run.phase.kind === 'combat' && readyWave !== run.stop;
  const wavePending = run.phase.kind === 'combat' && run.area?.wavePending === true;
  useEffect(() => {
    if (!wavePending) return;
    const timer = window.setTimeout(() => onAction({ type: 'nextBattleWave' }), NEXT_WAVE_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [wavePending, onAction]);

  useEffect(() => {
    const previousPhase = lastPhase.current;
    lastPhase.current = run.phase.kind;
    if (previousPhase === run.phase.kind) return;
    if (previousPhase === 'combat' && run.phase.kind === 'reward') {
      playSound('victory', 1, .94);
      if (leveledAtReward) {
        const timer = window.setTimeout(() => playSound('levelUp'), LEVEL_UP_AFTER_VICTORY_MS);
        return () => window.clearTimeout(timer);
      }
    }
    if (run.phase.kind === 'altar') playSound('curse', .7, .6);
    if (run.phase.kind === 'grave') playSound('grave', .62, .6);
  }, [run.phase.kind, leveledAtReward]);

  useEffect(() => {
    if (!startingNextWave) return;
    const timer = window.setTimeout(() => setReadyWave(run.stop), NEXT_WAVE_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [startingNextWave, run.stop]);

  const regionArt = useProgressiveImage(MAP_IMAGES[regionIndexOf(run.stop) % MAP_IMAGES.length] ?? '');

  if (startingNextWave)
    return (
      <div className="run-board flex h-full flex-col items-center justify-center gap-2 text-center" role="status">
        <strong>Wave {run.stop}</strong>
        <span>{regionOfRun(run)}</span>
      </div>
    );
  if (run.phase.kind === 'combat')
    return (
      <div className="relative h-full w-full overflow-hidden">
        <PhaseBody run={run} runId={runId} onAction={onAction} onMainMenu={onMainMenu} endless={endless} />
      </div>
    );
  return (
    <div className="run-board flex h-full w-full flex-col overflow-hidden" style={run.phase.kind === 'reward' ? undefined : { backgroundImage: `linear-gradient(#140e0bbc, #140d09e8), url("${regionArt.src}")` }}>
      {run.phase.kind !== 'route' && <RunHud run={run} onOpenCharacter={() => setShowCharacter(true)}
        {...(endless && onMainMenu && { onReturnFromEndless: onMainMenu })} />}
      <main data-route-board={run.phase.kind === 'route' || undefined} className={run.phase.kind === 'area-camp'
        ? 'flex min-h-0 flex-1' : 'flex min-h-0 flex-1 flex-col items-center justify-center-safe overflow-y-auto p-3'}>
        {apple && (
          <p className="mb-2 text-center text-xs text-accent">Found: {getItem(apple).name}. Give it to Metatron to refresh the shop.</p>
        )}
        {run.pandoraEffect && run.stop === 1 && run.phase.kind === 'route' && (
          <p className="mb-2 text-center text-xs text-ink"><strong>{PANDORA_RUN_COPY[run.pandoraEffect].title}:</strong> {PANDORA_RUN_COPY[run.pandoraEffect].detail.replace('your next conquest', 'this conquest')} This run is unranked.</p>
        )}
        {run.pandoraEffect === 'half-life' && run.phase.kind === 'reward' && run.goldVictories.length === 1 && (
          <p className="mb-2 text-center text-xs text-accent">Curse cleared: +{PANDORA_CURSE_BOUNTY} Gold</p>
        )}
        <PhaseBody run={run} runId={runId} onAction={onAction} onMainMenu={onMainMenu} />
      </main>
      {leveledAtReward && dismissedLevel !== levelKey && !showCharacter && (
        <LevelUpDialog key={levelKey} character={run.character}
          onClose={() => setDismissedLevel(levelKey)}
          onOpenCharacter={() => { setDismissedLevel(levelKey); setShowCharacter(true); }} />
      )}
      {showCharacter && (
        <BattleCharacterSheet deck={run.deck} artifacts={run.artifacts} vitals={{ hp: run.hp, maxHp: run.maxHp }} character={run.character} onAction={onAction} onClose={() => setShowCharacter(false)} />
      )}
    </div>
  );
};
