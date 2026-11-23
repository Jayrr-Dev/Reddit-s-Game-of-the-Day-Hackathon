// ===================================================================
// COMBAT VIEW
// One fight, laid out like a mobile card battler and sized to the
// 512 px Reddit post. Layers, top to bottom:
//   TopBar        a thin strip: where you are, score, and the pause gear
//   Battlefield   3 x 2 parallax scene; every hero wears its own plate
//   HitNumbers    big damage numbers that pop on a hit
//   Bottom band   PlayerCorner (portrait + HP) | your effects + energy |
//                 TurnCorner (deck count + End Turn), then the hand
//   DraggedCard   the card under the finger while it is dragged
//   AimArrow      the targeting line from that card to its target
// All game state comes from the engine; this view only routes input.
// ===================================================================

import { useState } from 'react';
import type { RunAction } from '../../../shared/game/run';
import type { CombatState } from '../../../shared/game/types';
import type { CardBox, Point } from '../../hooks/useCardDrag';
import { useCombatControls } from '../../hooks/useCombatControls';
import { useHitPops } from '../../hooks/useHitPops';
import { useSmoothPoint } from '../../hooks/useSmoothPoint';
import { AimArrow } from './combat/AimArrow';
import { BattlefieldView } from './combat/BattlefieldView';
import { DraggedCard } from './combat/DraggedCard';
import { EnergyTray } from './combat/EnergyTray';
import { FanHand } from './combat/FanHand';
import { HitNumbers } from './combat/HitNumbers';
import { PlayerCorner } from './combat/PlayerCorner';
import { TopBar } from './combat/TopBar';
import { TurnCorner } from './combat/TurnCorner';
import { MenuPanel } from './menu/MenuPanel';
import { StatusRow } from './StatusRow';

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

// --- SUBCOMPONENTS ---
/** The row above the hand: your portrait, effects + energy, End Turn. */
const PlayerBar = ({
  combat,
  onEndTurn,
}: {
  combat: CombatState;
  onEndTurn: () => void;
}) => (
  <div className="flex items-end justify-between gap-2 px-3">
    <PlayerCorner player={combat.player} />
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 pb-1">
      <StatusRow combatant={combat.player} />
      <EnergyTray energy={combat.energy} />
    </div>
    <TurnCorner drawCount={combat.drawPile.length} onEndTurn={onEndTurn} />
  </div>
);

/** The pause sheet: where you are, your score, and Back to resume. */
const PauseSheet = ({
  where,
  score,
  onClose,
}: {
  where: string;
  score: number;
  onClose: () => void;
}) => (
  <MenuPanel title="Paused" onClose={onClose}>
    <p className="text-center text-sm text-ink">{where}</p>
    <p className="text-center font-display text-2xl font-black text-accent">
      {score} pts
    </p>
  </MenuPanel>
);

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
  const [isPaused, setIsPaused] = useState(false);
  const pops = useHitPops(combat.heroes);
  const { drag } = controls;
  const draggedCardId = drag ? combat.hand[drag.handIndex] : undefined;
  // The arrow is hidden until it has a target, then flies out from the
  // card and glides onto the snapped hero rather than jumping to it.
  const aimShown = useSmoothPoint(
    controls.aimPoint,
    drag ? cardTop(drag.card) : null
  );

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <TopBar
        where={where}
        score={score}
        onOpenMenu={() => setIsPaused(true)}
      />
      {/* BATTLEFIELD (fills the space between the plate and the band) */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <BattlefieldView
          heroes={combat.heroes}
          hue={hue}
          focusUid={controls.focusUid}
          aimOf={controls.aimOf}
          onTapHero={controls.tapHero}
        />
        <HitNumbers pops={pops} />
      </div>
      {/* BOTTOM BAND: rises over the field's foreground */}
      <div className="relative z-30 -mt-8 flex shrink-0 flex-col">
        <PlayerBar combat={combat} onEndTurn={controls.endTurn} />
        <FanHand
          combat={combat}
          heldIndex={controls.heldIndex}
          onTapCard={controls.tapCard}
          onPressCard={controls.pressCard}
          draggedIndex={drag?.handIndex ?? null}
          draggedBox={drag?.card ?? null}
        />
      </div>
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
              retract={controls.arrowRetract}
            />
          )}
        </>
      )}
      {isPaused && (
        <PauseSheet
          where={where}
          score={score}
          onClose={() => setIsPaused(false)}
        />
      )}
    </div>
  );
};
