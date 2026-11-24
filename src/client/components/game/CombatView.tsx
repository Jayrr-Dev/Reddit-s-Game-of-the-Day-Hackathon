// ===================================================================
// COMBAT VIEW
// One fight, laid out like a mobile card battler and sized to the
// 512 px Reddit post. Layers, top to bottom:
//   TopBar        a thin strip: where you are, score, and the pause gear
//   Battlefield   3 x 2 parallax scene; every hero wears its own plate
//   HitNumbers    damage numbers that pop over the hero that was hit
// Charge (when the front row is empty) brings the back row up with a
// speed-lines burst (SpeedLines) and grants Momentum.
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
import { movementFailsOn } from '../../../shared/game/combat';
import {
  canMove,
  movementBlockReason,
  movementCost,
  offeredMovement,
} from '../../../shared/game/movement';
import type { RunAction } from '../../../shared/game/run';
import type {
  CardType,
  CombatState,
  MovementId,
} from '../../../shared/game/types';
import type { CardBox, Point } from '../../hooks/useCardDrag';
import { useCombatControls } from '../../hooks/useCombatControls';
import { useCardFlights } from '../../hooks/useCardFlights';
import { useCardHits } from '../../hooks/useCardHits';
import { useHeroTurn } from '../../hooks/useHeroTurn';
import { useMoveFailPops } from '../../hooks/useMoveFailPops';
import {
  PLAYER_SHOT_FLIGHT_MS,
  shotPlanOf,
  usePlayerShots,
} from '../../hooks/usePlayerShots';
import {
  useHitPops,
  usePlayerHits,
  type HitPop,
  type PlayerHitPop,
} from '../../hooks/useHitPops';
import { useSmoothPoint } from '../../hooks/useSmoothPoint';
import { HitHistory } from '../../lib/popSize';
import { AimArrow } from './combat/AimArrow';
import { AutoAimPreview } from './combat/AutoAimPreview';
import { CardFlights } from './combat/CardFlights';
import { BattlefieldView } from './combat/BattlefieldView';
import { HeroShots } from './combat/HeroShots';
import { MOVEMENT_LOOK } from '../../content/visuals';
import { MovementButton } from './combat/MovementButton';
import { MoveFailPops } from './combat/MoveFailPops';
import { DraggedCard } from './combat/DraggedCard';
import { EnergyTray } from './combat/EnergyTray';
import { FanHand } from './combat/FanHand';
import { HitNumbers } from './combat/HitNumbers';
import { PileDialog, type PileId } from './combat/PileDialog';
import { PileStack } from './combat/PileStack';
import { PlayerCorner } from './combat/PlayerCorner';
import { PlayerShots } from './combat/PlayerShots';
import { ShroudGainPops } from './combat/ShroudGainPops';
import { SpeedLines } from './combat/SpeedLines';
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
/**
 * The newest real hit (HP lost) on each hero whose number still floats,
 * by uid: they wince, and a new id flinches them again.
 */
const lastHitIdsOf = (pops: readonly HitPop[]): ReadonlyMap<number, number> =>
  new Map(
    pops
      .filter((pop) => pop.kind === 'hit' && pop.amount > 0)
      .map((pop) => [pop.uid, pop.id])
  );

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
  onMove,
  onOpenPile,
}: {
  combat: CombatState;
  hits: readonly PlayerHitPop[];
  onEndTurn: () => void;
  onMove: (move: MovementId) => void;
  onOpenPile: (pile: PileId) => void;
}) => {
  const movement = offeredMovement(combat);
  return (
    <div className="grid grid-cols-[minmax(max-content,1fr)_minmax(0,max-content)_minmax(max-content,1fr)] items-end gap-1 px-2">
      <div className="flex items-end gap-2.5 justify-self-start">
        <PlayerCorner player={combat.player} hits={hits} />
        <PileStack
          count={combat.discardPile.length}
          label="Cards in the discard pile"
          toneClass="bg-surface-raised"
          side="left"
          pile="discard"
          onOpen={() => onOpenPile('discard')}
        />
      </div>
      <div className="relative flex min-w-0 flex-col items-center gap-1 pb-1">
        {/* CHARGE / BACK STEP float above the chips, so showing one never
          moves the bar */}
        {movement && (
          <div className="absolute bottom-full mb-2">
            <MovementButton
              move={movement}
              cost={movementCost(combat, movement)}
              isAffordable={canMove(combat, movement)}
              blockReason={movementBlockReason(combat, movement)}
              onPress={() => onMove(movement)}
            />
          </div>
        )}
        <ShroudGainPops shroud={combat.player.shroud} />
        <StatusRow combatant={combat.player} />
        <EnergyTray energy={combat.energy} />
      </div>
      <div className="justify-self-end">
        <TurnCorner
          drawCount={combat.drawPile.length}
          onEndTurn={onEndTurn}
          onOpenDraw={() => onOpenPile('draw')}
        />
      </div>
    </div>
  );
};

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
  // The last movement with a running count, so each one re-keys (and
  // replays) its speed lines.
  const [burst, setBurst] = useState<{ move: MovementId; count: number }>();
  // Recent hits, so damage numbers are sized against a typical hit.
  const [hitHistory] = useState(() => new HitHistory());
  const { pops: moveFails, show: showMoveFail } = useMoveFailPops();
  const { shots, fire: fireShots } = usePlayerShots();
  // True while your shots fly, before the card lands.
  const [isShooting, setIsShooting] = useState(false);
  const routeAction = useCallback(
    (action: RunAction) => {
      if (action.type === 'endTurn') return playHeroTurn();
      if (action.type === 'move') {
        const { move } = action;
        setBurst((last) => ({ move, count: (last?.count ?? 0) + 1 }));
      }
      if (action.type === 'playCard') {
        const cardId = realCombat.hand[action.handIndex];
        setLastCardType(cardId ? getCard(cardId).type : undefined);
        // A knockback the target shrugs off shows a cancel sign on it.
        const { targetUid } = action;
        if (
          cardId &&
          targetUid !== undefined &&
          movementFailsOn(realCombat, cardId, targetUid)
        )
          showMoveFail(targetUid);
        // Range and Magic cards fire first; the hits land on arrival.
        const plan = shotPlanOf(realCombat, action);
        if (plan && fireShots(plan)) {
          setIsShooting(true);
          window.setTimeout(() => {
            setIsShooting(false);
            playCardHits(action);
          }, PLAYER_SHOT_FLIGHT_MS);
          return;
        }
        return playCardHits(action);
      }
      onAction(action);
    },
    [playHeroTurn, playCardHits, onAction, realCombat, showMoveFail, fireShots]
  );
  const controls = useCombatControls(combat, routeAction);
  const cardFlights = useCardFlights(combat);
  const [isPaused, setIsPaused] = useState(false);
  // The pile whose cards are open in the dialog, if any.
  const [openPile, setOpenPile] = useState<PileId | null>(null);
  const closePile = useCallback(() => setOpenPile(null), []);
  const pops = useHitPops(
    combat.heroes,
    combat.turn,
    heroTurn.isPlaying,
    lastCardType,
    hitHistory
  );
  const playerHits = usePlayerHits(
    combat.player,
    combat.turn,
    heroTurn.attackType,
    hitHistory
  );
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
          pickMarkerOf={controls.pickMarkerOf}
          acting={heroTurn.acting}
          lastHitIds={lastHitIdsOf(pops)}
          onTapHero={controls.tapHero}
        />
        <HeroShots acting={heroTurn.acting} />
        <PlayerShots shots={shots} />
        {burst && (
          <SpeedLines
            key={burst.count}
            direction={MOVEMENT_LOOK[burst.move].speedLines}
          />
        )}
        <HitNumbers pops={pops} />
        <MoveFailPops pops={moveFails} />
      </div>
      {/* BOTTOM BAND: rises over the field's foreground */}
      <div className="relative z-30 -mt-8 flex shrink-0 flex-col">
        <PlayerBar
          combat={combat}
          hits={playerHits}
          onEndTurn={controls.endTurn}
          onMove={(move) => routeAction({ type: 'move', move })}
          onOpenPile={setOpenPile}
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
      <AutoAimPreview
        uids={controls.autoAimUids}
        isLethalOn={controls.isAutoAimLethal}
      />
      {drag && draggedCardId !== undefined && (
        <>
          <DraggedCard
            cardId={draggedCardId}
            attacker={combat.player}
            target={combat.heroes.find(
              (unit) => unit.uid === controls.hoverUid
            )}
            box={drag.card}
            glow={controls.selfGlow}
          />
          {aimShown && (
            <AimArrow
              from={cardTop(drag.card)}
              to={aimShown}
              isLive={controls.isDropLive}
              isLethal={controls.isLethal}
              damageFactor={controls.aimFactor}
              retract={controls.arrowRetract}
            />
          )}
        </>
      )}
      <CardFlights flights={cardFlights} />
      {/* A TURN OR A CARD'S HITS ARE PLAYING: SWALLOW TAPS UNTIL DONE */}
      {(isAnimating || isShooting) && <div className="absolute inset-0 z-50" />}
      {openPile && (
        <PileDialog
          pile={openPile}
          cards={openPile === 'draw' ? combat.drawPile : combat.discardPile}
          attacker={combat.player}
          onClose={closePile}
        />
      )}
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
