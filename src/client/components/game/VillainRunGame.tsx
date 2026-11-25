// ===================================================================
// VILLAIN RUN GAME
// Picks the view for the run's current phase. Every view reports player
// input as a RunAction; this component never changes game state itself.
// ===================================================================

import { playSound } from '../../lib/gameAudio';
import { useEffect, useRef, useState } from 'react';
import { regionIndexOf, regionName } from '../../../shared/game/kingdom';
import { RunCharacterSheet } from './RunCharacterSheet';
import {
  computeScore,
  type RunAction,
  type RunState,
} from '../../../shared/game/run';
import { AbandonRun } from './combat/AbandonRun';
import { DeathScreen } from './DeathScreen';
import { CombatView } from './CombatView';
import { GraveView } from './GraveView';
import { OfferView } from './OfferView';
import { routeLocation } from './routeLocation';
import { RouteView } from './RouteView';
import { MAP_IMAGES } from './combat/Backdrop';
import { RunHud } from './RunHud';

// --- TYPES ---
export type VillainRunGameProps = {
  run: RunState;
  onAction: (action: RunAction) => void;
};

// --- SUBCOMPONENTS ---
/** The body for the current phase. */
const PhaseBody = ({ run, onAction }: VillainRunGameProps) => {
  const { phase } = run;
  switch (phase.kind) {
    case 'route':
      return <RouteView stopNumber={run.stop} options={phase.options} onAction={onAction} />;
    case 'combat': {
      const region = regionIndexOf(run.stop);
      return (
        <CombatView
          key={run.stop}
          combat={phase.combat}
          character={run.character}
          deck={run.deck}
          terrainIndex={routeLocation(run.stop, phase.stop.optionIndex ?? 0, phase.stop.kind).terrain}
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
          rerolls={phase.rerolled ? 0 : 1}
          subtitle="Add one card to your deck."
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

// --- COMPONENT ---
/**
 * Fills the post exactly (no page scroll inside the feed). Combat owns
 * the whole box; the other phases get the run HUD on top.
 */
export const VillainRunGame = ({ run, onAction }: VillainRunGameProps) => {
  const [showCharacter, setShowCharacter] = useState(false);
  const lastPhase = useRef(run.phase.kind);
  const leveledAtReward = run.phase.kind === 'reward' && run.phase.leveledUp;
  useEffect(() => {
    if (lastPhase.current !== run.phase.kind) {
      if (run.phase.kind === 'reward') playSound(leveledAtReward ? 'levelUp' : 'reward');
      if (run.phase.kind === 'altar') playSound('curse', .7, .6);
      if (run.phase.kind === 'grave') playSound('grave', .62, .6);
    }
    lastPhase.current = run.phase.kind;
  }, [run.phase.kind, leveledAtReward]);
  if (run.phase.kind === 'combat')
    return (
      <div className="h-full w-full overflow-hidden">
        <PhaseBody run={run} onAction={onAction} />
      </div>
    );
  return (
    <div className="run-board flex h-full w-full flex-col overflow-hidden" style={run.phase.kind === 'reward' ? undefined : { backgroundImage: `linear-gradient(#140e0bbc, #140d09e8), url("${MAP_IMAGES[regionIndexOf(run.stop) % MAP_IMAGES.length]}")` }}>
      <RunHud run={run} onOpenCharacter={() => setShowCharacter(true)} />
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center-safe overflow-y-auto p-3">
        {run.phase.kind === 'reward' && run.phase.leveledUp && (
          <button type="button" className="level-up-notice" onClick={() => setShowCharacter(true)}>
            <strong>Level up! Level {run.character.level}</strong>
            <span>Open character sheet</span>
          </button>
        )}
        <PhaseBody run={run} onAction={onAction} />
      </main>
      {showCharacter && (
        <RunCharacterSheet vitals={{ hp: run.hp, maxHp: run.maxHp }} character={run.character} onAction={onAction} onClose={() => setShowCharacter(false)} />
      )}
    </div>
  );
};
