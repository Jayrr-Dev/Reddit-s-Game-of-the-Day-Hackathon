// ===================================================================
// COMBAT VIEW
// One fight, laid out like a mobile card battler and sized to the
// 512 px Reddit post. Layers, top to bottom:
//   TopBar        a thin strip: where you are, score, and the pause gear
//   Battlefield   3 x 2 parallax scene; every hero wears its own plate
//   HitNumbers    damage numbers that pop over the hero that was hit
// End Turn plays the heroes' turn out (useHeroTurn): heroes attack in
// speed order, staggered, before the real state takes over.
//   Bottom band   PlayerCorner (portrait + HP) + discard pile | your
//                 effects + energy | TurnCorner (draw pile + End Turn),
//                 then the hand. A "+N" chip floats up when you gain
//                 Shroud.
//   DraggedCard   the card under the finger while it is dragged
//   AimArrow      the targeting line from that card to its target
// All game state comes from the engine; this view only routes input.
// ===================================================================

import { useCallback, useState, type ReactNode } from 'react';
import { getCard } from '../../../shared/game/cards';
import type { RunAction } from '../../../shared/game/run';
import type { CardType, CombatState } from '../../../shared/game/types';
import type { CardBox, Point } from '../../hooks/useCardDrag';
import { useCombatControls } from '../../hooks/useCombatControls';
import { useCardHits } from '../../hooks/useCardHits';
import { useHeroTurn } from '../../hooks/useHeroTurn';
import {
  useHitPops,
  usePlayerHits,
  type PlayerHitPop,
} from '../../hooks/useHitPops';
import { useSmoothPoint } from '../../hooks/useSmoothPoint';
import { AimArrow } from './combat/AimArrow';
import { BattlefieldView } from './combat/BattlefieldView';
import { DraggedCard } from './combat/DraggedCard';
import { EnergyTray } from './combat/EnergyTray';
import { FanHand } from './combat/FanHand';
import { HitNumbers } from './combat/HitNumbers';
import { PileStack } from './combat/PileStack';
import { PlayerCorner } from './combat/PlayerCorner';
import { ShroudGainPops } from './combat/ShroudGainPops';
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
  /** Extra buttons for the pause menu (e.g. the sandbox's reshuffle). */
  pauseActions?: ReactNode;
};

// --- HELPERS ---
/** The middle of a card's top edge, where the arrow leaves the card. */
const cardTop = ({ center, height }: CardBox): Point => ({
  x: center.x,
  y: center.y - height / 2,
});

// --- SUBCOMPONENTS ---
/**
 * The row above the hand: portrait + discard pile | effects + energy |
 * draw pile + End Turn. A 3-column grid whose side columns share the
 * leftover space equally, so the energy tray sits exactly on the
 * screen's centre line (the hand's axis) whatever the corners' widths.
 */
const PlayerBar = ({
  combat,
  hits,
  onEndTurn,
}: {
  combat: CombatState;
  hits: readonly PlayerHitPop[];
  onEndTurn: () => void;
}) => (
  <div className="grid grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-end gap-1 px-2">
    <div className="flex items-end gap-5 justify-self-start">
      <PlayerCorner player={combat.player} hits={hits} />
      <PileStack
        count={combat.discardPile.length}
        label="Cards in the discard pile"
        toneClass="bg-surface-raised"
        side="left"
      />
    </div>
    <div className="relative flex min-w-0 flex-col items-center gap-1 pb-1">
      <ShroudGainPops shroud={combat.player.shroud} />
      <StatusRow combatant={combat.player} />
      <EnergyTray energy={combat.energy} />
    </div>
    <div className="justify-self-end">
      <TurnCorner drawCount={combat.drawPile.length} onEndTurn={onEndTurn} />
    </div>
  </div>
);

/** The pause sheet: where you are, your score, and Back to resume. */
const PauseSheet = ({
  where,
  score,
  actions,
  onClose,
}: {
  where: string;
  score: number;
  actions?: ReactNode;
  onClose: () => void;
}) => (
  <MenuPanel title="Paused" onClose={onClose}>
    <p className="text-center text-sm text-ink">{where}</p>
    <p className="text-center font-display text-2xl font-black text-accent">
      {score} pts
    </p>
    {actions}
  </MenuPanel>
);

// --- COMPONENT ---
/** Renders one fight. */
export const CombatView = ({
  combat: realCombat,
  hue,
  where,
  score,
  onAction,
  pauseActions,
}: CombatViewProps) => {
  // While the heroes' turn plays out, draw its beats instead of the
  // real state, and route End Turn to the playback.
  // Likewise a multi-hit card shows each hit before it is committed.
  const heroTurn = useHeroTurn(realCombat, onAction);
  const cardHits = useCardHits(realCombat, onAction);
  const { endTurn: playHeroTurn } = heroTurn;
  const { playCard: playCardHits } = cardHits;
  const combat = cardHits.isPlaying ? cardHits.shown : heroTurn.shown;
  const isAnimating = heroTurn.isPlaying || cardHits.isPlaying;
  // The type of the card played last colours its damage numbers.
  const [lastCardType, setLastCardType] = useState<CardType>();
  const routeAction = useCallback(
    (action: RunAction) => {
      if (action.type === 'endTurn') return playHeroTurn();
      if (action.type === 'playCard') {
        const cardId = realCombat.hand[action.handIndex];
        setLastCardType(cardId ? getCard(cardId).type : undefined);
        return playCardHits(action);
      }
      onAction(action);
    },
    [playHeroTurn, playCardHits, onAction, realCombat.hand]
  );
  const controls = useCombatControls(combat, routeAction);
  const [isPaused, setIsPaused] = useState(false);
  const pops = useHitPops(
    combat.heroes,
    combat.turn,
    heroTurn.isPlaying,
    lastCardType
  );
  const playerHits = usePlayerHits(combat.player, combat.turn);
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
          actingUids={heroTurn.actingUids}
          onTapHero={controls.tapHero}
        />
        <HitNumbers pops={pops} />
      </div>
      {/* BOTTOM BAND: rises over the field's foreground */}
      <div className="relative z-30 -mt-8 flex shrink-0 flex-col">
        <PlayerBar
          combat={combat}
          hits={playerHits}
          onEndTurn={controls.endTurn}
        />
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
      {/* A TURN OR A CARD'S HITS ARE PLAYING: SWALLOW TAPS UNTIL DONE */}
      {isAnimating && <div className="absolute inset-0 z-50" />}
      {isPaused && (
        <PauseSheet
          where={where}
          score={score}
          actions={pauseActions}
          onClose={() => setIsPaused(false)}
        />
      )}
    </div>
  );
};
