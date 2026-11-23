// ===================================================================
// COMBAT VIEW
// One fight, laid out to fit the 512 px Reddit post (top to bottom):
//   FocusHud      location, focused hero's HP emblem, intent, statuses
//   Battlefield   3 x 2 parallax scene with every hero
//   VillainDock   portrait + HP, energy, statuses, draw pile, End Turn
//   FanHand       the cards in hand
//   AimArrow      the targeting line while a card is dragged
// All game state comes from the engine; this view only routes input.
// ===================================================================

import type { RunAction } from '../../../shared/game/run';
import type { CombatState } from '../../../shared/game/types';
import { useCombatControls } from '../../hooks/useCombatControls';
import { AimArrow } from './combat/AimArrow';
import { BattlefieldView } from './combat/BattlefieldView';
import { FanHand } from './combat/FanHand';
import { FocusHud } from './combat/FocusHud';
import { VillainDock } from './combat/VillainDock';

// --- TYPES ---
export type CombatViewProps = {
  combat: CombatState;
  /** Backdrop hue of the current region. */
  hue: number;
  where: string;
  score: number;
  onAction: (action: RunAction) => void;
};

// --- COMPONENT ---
/** Renders one fight. */
export const CombatView = ({
  combat,
  hue,
  where,
  score,
  onAction,
}: CombatViewProps) => {
  const controls = useCombatControls(combat, onAction);
  const focused = combat.heroes.find((unit) => unit.uid === controls.focusUid);
  const { drag } = controls;
  const isHolding = controls.heldIndex !== null;

  return (
    <div className="flex h-full w-full flex-col">
      <FocusHud where={where} score={score} unit={focused} />
      <div className="relative -mt-12 flex min-h-0 flex-1 flex-col">
        <BattlefieldView
          heroes={combat.heroes}
          hue={hue}
          focusUid={controls.focusUid}
          aimOf={controls.aimOf}
          onTapHero={controls.tapHero}
        />
        {isHolding && !drag && (
          <p className="pointer-events-none absolute inset-x-0 bottom-1 z-30 text-center text-[11px] font-semibold text-accent drop-shadow">
            Tap or drag to a glowing hero
          </p>
        )}
      </div>
      <VillainDock combat={combat} onEndTurn={controls.endTurn} />
      <FanHand
        combat={combat}
        heldIndex={controls.heldIndex}
        onTapCard={controls.tapCard}
        onPressCard={controls.pressCard}
      />
      {drag && (
        <AimArrow from={drag.from} to={drag.to} isLive={controls.isDropLive} />
      )}
    </div>
  );
};
