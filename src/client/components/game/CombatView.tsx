// ===================================================================
// COMBAT VIEW
// One fight, laid out like a mobile card battler and sized to the
// 512 px Reddit post. Layers, top to bottom:
//   TopBar        a thin strip: where you are, score, and the pause gear
//   Battlefield   3 x 2 parallax scene; every hero wears its own plate
//   HitNumbers    damage numbers that pop over the hero that was hit
// Charge (when the front row is empty) brings the back row up with a
// speed-lines burst (SpeedLines) and grants Momentum. A Rampage kill
// Charges on its own (a Distance kill Back Steps), with the same burst.
// End Turn plays the heroes' turn out (useHeroTurn): heroes attack in
// speed order, staggered, before the real state takes over.
//   Bottom band   PlayerCorner (portrait + HP) + discard pile | your
//                 effects + energy | TurnCorner (draw pile + End Turn),
//                 then the hand. A "+N" chip floats up when you gain
//                 Guard.
//   DraggedCard   the card under the finger while it is dragged
//   AimArrow      the targeting line from that card to its target
// All game state comes from the engine; this view only routes input.
// ===================================================================

import './combat/dueling-table.css';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { getCard, type CardId } from '../../../shared/game/cards';
import { activeRows } from '../../../shared/game/battlefield';
import { movementFailsOn } from '../../../shared/game/combat';
import type { RunAction } from '../../../shared/game/run';
import type {
  CardType,
  MagicElement,
  MeleeEdge,
  CombatState,
} from '../../../shared/game/types';
import type { CardBox, Point } from '../../hooks/useCardDrag';
import { useAutoEndTurn } from '../../hooks/useAutoEndTurn';
import { useCombatControls } from '../../hooks/useCombatControls';
import { useCardFlights } from '../../hooks/useCardFlights';
import { useCardHits } from '../../hooks/useCardHits';
import { useHeroTurn } from '../../hooks/useHeroTurn';
import { useMoveFailPops } from '../../hooks/useMoveFailPops';
import { useMovementBurst } from '../../hooks/useMovementBurst';
import {
  PLAYER_SHOT_FLIGHT_MS,
  MELEE_SWEEP_MS,
  shotPlanOf,
  sweepPlanOf,
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
import { MoveFailPops } from './combat/MoveFailPops';
import { MOVEMENT_SLOT } from '../../hooks/useCardDrag';
import { movementCost, offeredMovement } from '../../../shared/game/movement';
import { MovementCard } from './CardView';
import { DraggedCard } from './combat/DraggedCard';
import { EnergyTray } from './combat/EnergyTray';
import { FanHand } from './combat/FanHand';
import { HitNumbers } from './combat/HitNumbers';
import { PileDialog, type PileId } from './combat/PileDialog';
import { PileStack } from './combat/PileStack';
import { PlayerCorner } from './combat/PlayerCorner';
import { PovImpact } from './combat/PovImpact';
import { PlayerShots } from './combat/PlayerShots';
import { GuardGainPops } from './combat/GuardGainPops';
import { SpeedLines } from './combat/SpeedLines';
import { BATTLEFIELD_COLUMNS } from '../../../shared/game/rules';
import { HORIZON_SLOT_SPAN, rowPerspective } from './combat/rowPerspective';
import { TopBar } from './combat/TopBar';
import { TurnCorner } from './combat/TurnCorner';
import { MenuPanel } from './menu/MenuPanel';
import { StatusRow } from './StatusRow';

// --- TYPES ---
export type CombatViewProps = {
  combat: CombatState;
  /** Terrain for this region or practice round. */
  terrainIndex: number;
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

/** The cards in each pile, by its id. */
const pileCards = (combat: CombatState, pile: PileId): readonly CardId[] =>
  ({
    draw: combat.drawPile,
    discard: combat.discardPile,
    removed: combat.removedPile,
  })[pile];

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
  onOpenPile,
}: {
  combat: CombatState;
  hits: readonly PlayerHitPop[];
  onEndTurn: () => void;
  onOpenPile: (pile: PileId) => void;
}) => {
  return (
    <div className="table-controls grid grid-cols-[minmax(max-content,1fr)_minmax(0,max-content)_minmax(max-content,1fr)] items-end gap-1 px-2">
      <div className="table-player flex items-end gap-2.5 justify-self-start">
        <PlayerCorner player={combat.player} hits={hits} />
        <PileStack
          count={combat.discardPile.length}
          label="Cards in the discard pile"
          toneClass="bg-surface-raised"
          side="left"
          pile="discard"
          onOpen={() => onOpenPile('discard')}
        />
        <PileStack
          count={combat.removedPile.length}
          label="Cards removed from play this fight"
          toneClass="bg-surface-sunken"
          side="left"
          pile="removed"
          onOpen={() => onOpenPile('removed')}
        />
      </div>
      <div className="table-energy relative flex min-w-0 flex-col items-center gap-1 pb-1">
        <GuardGainPops guard={combat.player.guard} />
      </div>
      <div className="table-turn justify-self-end">
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
  terrainIndex,
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
  // The card played last: its type colours its damage numbers, and a
  // Magic card's element shapes its bursts.
  const [lastCard, setLastCard] = useState<{
    type: CardType;
    element?: MagicElement | undefined;
    edge?: MeleeEdge | undefined;
  }>();
  // Speed lines for every movement, Rampage Charges included.
  const burst = useMovementBurst(combat);
  // Recent hits, so damage numbers are sized against a typical hit.
  const [hitHistory] = useState(() => new HitHistory());
  const { pops: moveFails, show: showMoveFail } = useMoveFailPops();
  const { shots, sweeps, fire: fireShots, swing } = usePlayerShots();
  // True while your shots fly, before the card lands.
  const [isShooting, setIsShooting] = useState(false);
  const routeAction = useCallback(
    (action: RunAction) => {
      if (action.type === 'endTurn') return playHeroTurn();
      if (action.type === 'playCard') {
        const cardId = realCombat.hand[action.handIndex];
        setLastCard(cardId ? getCard(cardId) : undefined);
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
        // Melee cards swing across their targets; the slices follow.
        const swept = sweepPlanOf(realCombat, action);
        if (swept && swing(swept)) {
          setIsShooting(true);
          window.setTimeout(() => {
            setIsShooting(false);
            playCardHits(action);
          }, MELEE_SWEEP_MS);
          return;
        }
        return playCardHits(action);
      }
      onAction(action);
    },
    [
      playHeroTurn,
      playCardHits,
      onAction,
      realCombat,
      showMoveFail,
      fireShots,
      swing,
    ]
  );
  const controls = useCombatControls(combat, routeAction);
  const cardFlights = useCardFlights(combat);
  const [showGuides, setShowGuides] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // Out of plays: the turn ends itself after a beat (see useAutoEndTurn).
  useAutoEndTurn(
    realCombat,
    isAnimating || isShooting || isPaused,
    controls.endTurn
  );
  // The pile whose cards are open in the dialog, if any.
  const [openPile, setOpenPile] = useState<PileId | null>(null);
  const closePile = useCallback(() => setOpenPile(null), []);
  const pops = useHitPops(
    combat.heroes,
    combat.turn,
    heroTurn.isPlaying,
    lastCard?.type,
    lastCard?.element,
    lastCard?.edge,
    hitHistory,
    cardHits.strikeIndex,
    heroTurn.fallenFromTick
  );
  const playerHits = usePlayerHits(
    combat.player,
    combat.turn,
    heroTurn.attackType,
    hitHistory,
    heroTurn.strikes
  );
  // The whole view shakes when a hit lands on you (see PovImpact).
  const viewRef = useRef<HTMLDivElement>(null);
  const { drag } = controls;
  const draggedMove = drag?.handIndex === MOVEMENT_SLOT ? offeredMovement(combat) : null;
  const draggedCardId = drag ? combat.hand[drag.handIndex] : undefined;
  // The arrow is hidden until it has a target, then flies out from the
  // card and glides onto the snapped hero rather than jumping to it.
  const aimShown = useSmoothPoint(
    controls.aimPoint,
    drag ? cardTop(drag.card) : null
  );

  return (
    <div
      ref={viewRef}
      className="dueling-table relative flex h-full w-full flex-col overflow-hidden"
    >
      <div className="table-field-frame relative flex min-h-0 flex-1 flex-col">
        <TopBar
          where={where}
          score={score}
          onOpenMenu={() => setIsPaused(true)}
          onOpenDraw={() => setOpenPile('draw')}
        />
        {/* BATTLEFIELD (fills the space between the plate and the band) */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <BattlefieldView
            heroes={combat.heroes}
            travelRows={combat.travelRows ?? 0}
            terrainIndex={terrainIndex}
            focusUid={controls.focusUid}
            aimOf={controls.aimOf}
            pickMarkerOf={controls.pickMarkerOf}
            acting={heroTurn.acting}
            lastHitIds={lastHitIdsOf(pops)}
            onTapHero={controls.tapHero}
          />
          <HeroShots acting={heroTurn.acting} />
          <PlayerShots shots={shots} sweeps={sweeps} />
          {burst && (
            <SpeedLines
              key={burst.count}
              direction={MOVEMENT_LOOK[burst.move].speedLines}
            />
          )}
          <HitNumbers pops={pops} />
          <MoveFailPops pops={moveFails} />
        </div>
      </div>
      {/* BOTTOM BAND: rises over the field's foreground */}
      <div className="table-console relative z-30 flex shrink-0 flex-col">
        <PlayerBar
          combat={combat}
          hits={playerHits}
          onEndTurn={controls.endTurn}
          onOpenPile={setOpenPile}
        />
        <FanHand
          combat={combat}
          heldIndex={controls.heldIndex}
          imbueSlots={controls.imbueSlots}
          imbueAimedSlot={controls.imbueAimedSlot}
          onTapCard={controls.tapCard}
          onPressCard={controls.pressCard}
          draggedIndex={drag?.handIndex ?? null}
          draggedBox={drag?.card ?? null}
        />
        <div className="table-status-dock">
          <div className="table-buffs" role="group" aria-label="Player buffs">
            <StatusRow combatant={combat.player} group="buffs" timedBuffs={combat.timedBuffs} align="end" />
          </div>
          <EnergyTray energy={combat.energy} reserve={combat.reserve} />
          <div className="table-afflictions" role="group" aria-label="Player afflictions">
            <StatusRow combatant={combat.player} group="afflictions" align="start" />
          </div>
        </div>
      </div>
      <div className="hero-plate-layer pointer-events-none absolute inset-0 z-[32]" />
      {showGuides && (
        <div className="layout-guides" aria-hidden="true">
          <div className="guide-lanes">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
              {activeRows().includes('horizon') && Array.from({ length: BATTLEFIELD_COLUMNS }, (_, col) => (
                <rect key={col} x={50 * (1 - HORIZON_SLOT_SPAN) + col * 100 * HORIZON_SLOT_SPAN / BATTLEFIELD_COLUMNS}
                  y="0" width={100 * HORIZON_SLOT_SPAN / BATTLEFIELD_COLUMNS}
                  height={100 * rowPerspective('horizon').boundary}
                  fill="none" stroke="#fb755b" vectorEffect="non-scaling-stroke" />
              ))}
              {Array.from({ length: BATTLEFIELD_COLUMNS + 1 }, (_, col) => (
                <line key={col} x1="50" y1="0" x2={100 * col / BATTLEFIELD_COLUMNS} y2="100" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
            <i className="guide-vanishing-point" />
          </div>
          <div className="guide-line guide-horizon"><span>Horizon · 20%</span></div>
          {activeRows().slice(1).map((row) => (
            <div key={row} className="guide-line" style={{ top: `calc(var(--horizon) + (100% - var(--horizon) - var(--hand-zone)) * ${rowPerspective(row).boundary})` }} />
          ))}
          <div className="guide-center"><span>Center</span></div>
          <div className="guide-line guide-hand"><span>Hand · 73⅓%</span></div>
        </div>
      )}
      <AutoAimPreview
        uids={controls.autoAimUids}
        isLethalOn={controls.isAutoAimLethal}
      />
      {drag && (draggedCardId !== undefined || draggedMove) && (
        <>
          <DraggedCard
            cardId={draggedCardId}
            slain={combat.slain} followUpReady={combat.followUpReady}
            attacker={combat.player}
            target={combat.heroes.find(
              (unit) => unit.uid === controls.hoverUid
            )}
            box={drag.card}
            glow={controls.selfGlow}
          >
            {draggedMove ? <MovementCard move={draggedMove} cost={movementCost(combat, draggedMove)} disabled={false} blockReason={null} onPlay={() => {}} /> : undefined}
          </DraggedCard>
          {aimShown && (
            <AimArrow
              from={cardTop(drag.card)}
              to={aimShown}
              isLive={controls.isDropLive}
              isLethal={controls.isLethal}
              damageFactor={controls.aimFactor}
              hitChance={controls.aimChance}
              retract={controls.arrowRetract}
            />
          )}
          {/* PIERCING: one more arrow to each hero behind the lock */}
          {aimShown &&
            controls.pierceAimPoints.map((point) => (
              <AimArrow
                key={`${point.x},${point.y}`}
                from={cardTop(drag.card)}
                to={point}
                isLive={controls.isDropLive}
              />
            ))}
        </>
      )}
      {controls.imbueArrow && (
        <AimArrow
          from={controls.imbueArrow.from}
          to={controls.imbueArrow.to}
          isLive={controls.imbueArrow.isLive}
          arc="lob"
          hasLockRing={false}
        />
      )}
      <CardFlights flights={cardFlights} />
      {/* A TURN OR A CARD'S HITS ARE PLAYING: SWALLOW TAPS UNTIL DONE */}
      {/* HITS ON YOU LAND ON THE WHOLE SCREEN */}
      <PovImpact hits={playerHits} shakeRef={viewRef} />
      {(isAnimating || isShooting) && <div className="absolute inset-0 z-50" />}
      {openPile && (
        <PileDialog
          pile={openPile}
          cards={pileCards(combat, openPile)}
          slain={combat.slain} followUpReady={combat.followUpReady}
          attacker={combat.player}
          onClose={closePile}
        />
      )}
      {isPaused && (
        <PauseSheet
          where={where}
          score={score}
          actions={<><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} />Layout guides</label>{pauseActions}</>}
          onClose={() => setIsPaused(false)}
        />
      )}
    </div>
  );
};
