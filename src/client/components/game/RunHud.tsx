// ===================================================================
// RUN HUD
// The strip along the top during a run: where you are in the kingdom,
// your HP between fights, deck size and the score so far.
// ===================================================================

import { regionIndexOf, regionName } from '../../../shared/game/kingdom';
import { STOPS_PER_REGION } from '../../../shared/game/rules';
import { computeScore, type RunState } from '../../../shared/game/run';
import { Glyph } from '../ui/Glyph';

/** Shows region, progress through it, HP, deck and score. */
export const RunHud = ({ run }: { run: RunState }) => {
  const stepInRegion = ((run.stop - 1) % STOPS_PER_REGION) + 1;
  const hp = run.phase.kind === 'combat' ? run.phase.combat.player.hp : run.hp;
  return (
    <header className="flex w-full items-center justify-between gap-2 border-b border-edge px-3 py-2 text-xs">
      <div className="flex flex-col">
        <span className="font-display text-sm font-bold text-accent">
          {regionName(regionIndexOf(run.stop))}
        </span>
        <span className="text-ink-muted">
          Stop {stepInRegion}/{STOPS_PER_REGION} · Wave {run.stop}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-hp">
          <Glyph name="heart" className="size-3.5" />
          {hp}/{run.maxHp}
        </span>
        <span className="text-ink-muted">Deck {run.deck.length}</span>
        <span className="font-bold">{computeScore(run.stats)} pts</span>
      </div>
    </header>
  );
};
