// ===================================================================
// COMBAT VIEW
// The battlefield: the horde on top, the villain and the hand below.
// The only local state is which hero is targeted; everything else is
// the engine's CombatState passed down from the run.
// ===================================================================

import { useState } from 'react';
import type { RunAction } from '../../../shared/game/run';
import type { CombatState } from '../../../shared/game/types';
import { Button } from '../ui/Button';
import { HandView } from './HandView';
import { HeroUnitView } from './HeroUnitView';
import { PlayerPanel } from './PlayerPanel';

// --- TYPES ---
export type CombatViewProps = {
  combat: CombatState;
  onAction: (action: RunAction) => void;
};

// --- HOOKS ---
/**
 * Tracks the targeted hero. If the target falls, the first living hero
 * becomes the target, derived on render so it never points at a ghost.
 */
const useTarget = (combat: CombatState) => {
  const [chosenUid, setChosenUid] = useState<number | null>(null);
  const isChosenAlive = combat.heroes.some((unit) => unit.uid === chosenUid);
  const targetUid = isChosenAlive ? chosenUid : (combat.heroes[0]?.uid ?? null);
  return { targetUid, setTargetUid: setChosenUid } as const;
};

// --- COMPONENT ---
/** Renders one fight. */
export const CombatView = ({ combat, onAction }: CombatViewProps) => {
  const { targetUid, setTargetUid } = useTarget(combat);

  /** Plays a hand slot at the current target. */
  const handlePlay = (handIndex: number) =>
    onAction({ type: 'playCard', handIndex, targetUid: targetUid ?? 0 });

  return (
    <div className="flex w-full flex-1 flex-col justify-between gap-3">
      <section
        className="flex flex-wrap justify-center gap-2"
        aria-label="Heroes"
      >
        {combat.heroes.map((unit) => (
          <HeroUnitView
            key={unit.uid}
            unit={unit}
            isTargeted={unit.uid === targetUid}
            onSelect={setTargetUid}
          />
        ))}
      </section>

      <section className="flex flex-col gap-2" aria-label="Your turn">
        <div className="flex items-end gap-2 px-2">
          <PlayerPanel player={combat.player} energy={combat.energy} />
          <Button
            onClick={() => onAction({ type: 'endTurn' })}
            className="shrink-0"
          >
            End turn
          </Button>
        </div>
        <HandView combat={combat} onPlay={handlePlay} />
        <p className="text-center text-[10px] text-ink-muted">
          Turn {combat.turn} · Draw {combat.drawPile.length} · Discard{' '}
          {combat.discardPile.length}
        </p>
      </section>
    </div>
  );
};
