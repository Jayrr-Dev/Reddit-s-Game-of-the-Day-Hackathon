// ===================================================================
// RUN HUD
// The strip along the top during a run: where you are in the kingdom,
// your HP between fights, deck size and the score so far.
// ===================================================================

import { regionOfRun } from '../../../shared/game/regionRoutes';
import { STOPS_PER_REGION } from '../../../shared/game/rules';
import { computeScore, type RunState } from '../../../shared/game/run';
import { endlessWaveNumber } from '../../../shared/game/endless';
import { Glyph } from '../ui/Glyph';

/** Shows region, progress through it, HP, deck and score. */
export const RunHud = ({ run, onOpenCharacter, onReturnFromEndless }: {
  run: RunState; onOpenCharacter: () => void; onReturnFromEndless?: () => void;
}) => {
  const stepInRegion = ((run.stop - 1) % STOPS_PER_REGION) + 1;
  const hp = run.phase.kind === 'combat' ? run.phase.combat.player.hp : run.hp;
  return (
    <header className="flex w-full items-center justify-between gap-2 border-b border-edge px-3 py-2 text-xs">
      <div className="flex flex-col">
        <span className="font-display text-sm font-bold text-accent">
          {onReturnFromEndless ? 'Endless' : regionOfRun(run)}
        </span>
        <span className="text-ink-muted">
          {onReturnFromEndless ? 'Wave ' + endlessWaveNumber(run) : `Stop ${stepInRegion}/${STOPS_PER_REGION} · Wave ${run.stop}`}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {onReturnFromEndless && <button type="button" aria-label="Endless menu" title="Endless menu" className="text-accent" onClick={onReturnFromEndless}><Glyph name="back" className="size-5" /></button>}
        <button type="button" aria-label="Character sheet" title="Character sheet" className="text-accent" onClick={onOpenCharacter}>
          <Glyph name="breastplate" className="size-5" />
        </button>
        <span className="flex items-center gap-1 text-hp">
          <Glyph name="heart" className="size-3.5" />
          {hp}/{run.maxHp}
        </span>
        <span className="text-ink-muted">Deck {run.deck.length}</span>
        <span className="font-bold">{onReturnFromEndless ? run.stats.wavesCleared + ' cleared' : computeScore(run.stats) + ' pts'}</span>
      </div>
    </header>
  );
};
