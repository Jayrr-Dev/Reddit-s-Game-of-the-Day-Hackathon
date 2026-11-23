// ===================================================================
// COMBAT VIEW
// One fight, laid out to fit the 512 px Reddit post (top to bottom):
//   FocusHud      location and score
//   Battlefield   3 x 2 parallax scene; every hero wears its HP plate
//   VillainDock   portrait + HP, energy, statuses, draw pile, End Turn
//   FanHand       the cards in hand
//   DraggedCard   the card under the finger while it is dragged
//   AimArrow      the targeting line from that card to the aim tip
// All game state comes from the engine; this view only routes input.
// ===================================================================

import type { RunAction } from '../../../shared/game/run';
import type { CombatState } from '../../../shared/game/types';
import type { CardBox, Point } from '../../hooks/useCardDrag';
import { useCombatControls } from '../../hooks/useCombatControls';
import { useSmoothPoint } from '../../hooks/useSmoothPoint';
import { AimArrow } from './combat/AimArrow';
import { BattlefieldView } from './combat/BattlefieldView';
import { DraggedCard } from './combat/DraggedCard';
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

// --- HELPERS ---
/** The middle of a card's top edge, where the arrow leaves the card. */
const cardTop = ({ center, height }: CardBox): Point => ({
  x: center.x,
  y: center.y - height / 2,
});

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
  const { drag } = controls;
  const draggedCardId = drag ? combat.hand[drag.handIndex] : undefined;
  // The arrow is hidden until it has a target, then flies out from the
  // card and glides onto the snapped hero rather than jumping to it.
  const aimShown = useSmoothPoint(
    controls.aimPoint,
    drag ? cardTop(drag.card) : null
  );
  const isHolding = controls.heldIndex !== null;

  return (
    <div className="flex h-full w-full flex-col">
      <FocusHud where={where} score={score} />
      <div className="relative -mt-5 flex min-h-0 flex-1 flex-col">
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
        draggedIndex={drag?.handIndex ?? null}
      />
      {drag && draggedCardId !== undefined && (
        <>
          <DraggedCard
            cardId={draggedCardId}
            attacker={combat.player}
            box={drag.card}
            glow={controls.selfGlow}
          />
          {aimShown && (
            <AimArrow
              from={cardTop(drag.card)}
              to={aimShown}
              isLive={controls.isDropLive}
            />
          )}
        </>
      )}
    </div>
  );
};
