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
import { getVolume, playAfflictionBurst, playCardSound, playCombatImpact, playUnitDeath, playSound, subscribeVolume, usesShockCue } from '../../lib/gameAudio';
import { useMapAudio } from '../../lib/mapAudio';
import { isBoss, isCreature } from "../../content/heroLooks";
import { useEffect, useCallback, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { getCard, type CardId } from '../../../shared/game/cards';
import { rowDepth } from '../../../shared/game/battlefield';
import { endTurn, movementFailsOn, SELF_TARGET_UID } from '../../../shared/game/combat';
import type { RunAction } from '../../../shared/game/run';
import type { CharacterState } from '../../../shared/game/character';
import { RunCharacterSheet } from './RunCharacterSheet';
import type {
  CardType,
  MagicElement,
  MeleeEdge,
  CombatState,
} from '../../../shared/game/types';
import type { CardBox, Point } from '../../hooks/useCardDrag';
import { BossEntrance } from './combat/BossEntrance';
import { useBossEntrance } from '../../hooks/useBossEntrance';
import { useAutoEndTurn } from '../../hooks/useAutoEndTurn';
import { useCombatControls } from '../../hooks/useCombatControls';
import { useCardFlights } from '../../hooks/useCardFlights';
import { useCardHits } from '../../hooks/useCardHits';
import { GRIFFON_DIVE_LAND_MS, HERO_SHOT_FLIGHT_MS, HERO_SHOT_RELEASE_MS, useHeroTurn } from '../../hooks/useHeroTurn';
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
import { positionForCard } from '../../../shared/game/combat';
import { CardPlayHistory } from './combat/CardPlayHistory';
import { FanHand } from './combat/FanHand';
import { HitNumbers } from './combat/HitNumbers';
import { PileDialog, type CardBrowserView, type PileId } from './combat/PileDialog';
import { PileStack } from './combat/PileStack';
import { PlayerCorner } from './combat/PlayerCorner';
import { TutorialSpotlight } from './combat/TutorialSpotlight';
import { PovImpact } from './combat/PovImpact';
import { PlayerShots } from './combat/PlayerShots';
import { GuardGainPops } from './combat/GuardGainPops';
import { SpeedLines } from './combat/SpeedLines';
import { MAP_NAMES } from './combat/Backdrop';
import { TopBar } from './combat/TopBar';
import { TurnCorner } from './combat/TurnCorner';
import { SettingsDialog } from './menu/SettingsDialog';
import { MenuPanel } from './menu/MenuPanel';
import { StatusRow } from './StatusRow';

import { useGameSettings } from '../../hooks/useGameSettings';

// --- TYPES ---
export type CombatViewProps = {
  tutorialCue?: { selector: string; label: string };
  allowCombatAction?: (action: RunAction) => boolean;
  onPileClosed?: (pile: CardBrowserView) => void;
  levelGuide?: "spend" | "close" | undefined;
  onCharacterOpened?: () => void;
  onCharacterClosed?: () => void;
  manualTurns?: boolean;
  character: CharacterState;
  onRespec?: (() => void) | undefined;
  combat: CombatState;
  deck: readonly CardId[];
  /** Terrain for this region or practice round. */
  terrainIndex: number;
  where: string;
  score: number;
  onAction: (action: RunAction) => void;
  /** Extra buttons for the pause menu (e.g. the sandbox's reshuffle). */
  pauseActions?: ReactNode;
  renderTrainingMenu?: (resume: () => void, guides: ReactNode) => ReactNode;
  /** Open the pause menu on mount (training starts on its Scenarios picker). */
  startsPaused?: boolean;
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
  level,
  lethal,
  hits,
  onEndTurn,
  onOpenPile,
  onOpenCharacter,
  onTargetSelf,
  selfTargetLocked,
}: {
  combat: CombatState;
  level: number;
  lethal: boolean;
  hits: readonly PlayerHitPop[];
  onEndTurn: () => void;
  onOpenPile: (pile: PileId) => void;
  onOpenCharacter: () => void;
  onTargetSelf?: (() => void) | undefined;
  selfTargetLocked?: boolean;
}) => {
  return (
    <div className="table-controls grid grid-cols-[minmax(max-content,1fr)_minmax(0,max-content)_minmax(max-content,1fr)] items-end gap-1 px-2">
      <div className="table-player flex items-end gap-2.5 justify-self-start">
        <PlayerCorner player={combat.player} level={level} lethal={lethal} hits={hits} onOpenCharacter={onOpenCharacter} onTargetSelf={onTargetSelf} selfTargetLocked={!!selfTargetLocked} />
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
  character,
  onRespec,
  deck,
  terrainIndex,
  where,
  score,
  onAction,
  pauseActions,
  renderTrainingMenu,
  startsPaused = false,
  manualTurns,
  tutorialCue, levelGuide, onPileClosed, onCharacterOpened, onCharacterClosed, allowCombatAction,
}: CombatViewProps) => {
  // While the heroes' turn plays out, draw its beats instead of the
  // real state, and route End Turn to the playback.
  // Likewise a multi-hit card shows each hit before it is committed.
  const heroTurn = useHeroTurn(realCombat, onAction);
  const cardHits = useCardHits(realCombat, onAction);
  const incomingImpactDelay = heroTurn.arrowStep ? HERO_SHOT_RELEASE_MS + HERO_SHOT_FLIGHT_MS
    : heroTurn.bossImpact === 'griffonDive' ? GRIFFON_DIVE_LAND_MS : 0;
  const { endTurn: playHeroTurn } = heroTurn;
  const { playCard: playCardHits } = cardHits;
  const combat = cardHits.isPlaying ? cardHits.shown : heroTurn.shown;
  const { autoEnd, bossIntros, battleMusic, controls: settingInputs } = useGameSettings();
  const hasBoss = combat.heroes.some(unit => unit.hp > 0 && isBoss(unit));
  const previousCombat = useRef(combat);
  const burstSoundSeen = useRef({ player: -1, heroes: -1 });
  const incomingAttackTimers = useRef(new Set<number>());
  const blockSound = useRef({ index: 0, nextAt: 0, lastHitAt: -Infinity });
  const impactCard = useRef<CardId | undefined>(undefined);
  const musicVolume = useSyncExternalStore(subscribeVolume, () => getVolume('music'));
  const sfxVolume = useSyncExternalStore(subscribeVolume, () => getVolume('sfx'));
  const mapName = MAP_NAMES[terrainIndex % MAP_NAMES.length] ?? MAP_NAMES[0] ?? '';
  useMapAudio({ mapId: mapName, active: realCombat.player.hp > 0, bossActive: hasBoss, alternateBattle: battleMusic === 'orchestral', musicVolume: musicVolume / 100, sfxVolume: sfxVolume / 100 });
  useEffect(() => {
    const pending = incomingAttackTimers.current;
    return () => { pending.forEach(window.clearTimeout); pending.clear(); };
  }, []);
  useEffect(() => {
    const before = previousCombat.current;
    previousCombat.current = combat;
    if (before === combat || viewRef.current?.closest('[inert]')) return;
    const after = (delay: number, cue: () => void) => {
      const pending = incomingAttackTimers.current;
      const timer = window.setTimeout(() => { pending.delete(timer); cue(); }, delay);
      pending.add(timer);
    };
    // Ignore spawns/new waves. Only a living human combatant becoming fallen
    // triggers the sound, even if the playback state is later committed.
    const deaths = before.heroes.filter(old => old.hp > 0 && !isCreature(old.heroId) &&
      (combat.heroes.find(unit => unit.uid === old.uid)?.hp ?? 0) <= 0).length;
    for (let i = 0; i < deaths; i++) {
      if (i === 0) playUnitDeath();
      else after(i * 105, playUnitDeath);
    }
    if (before.player.hp > 0 && combat.player.hp <= 0) {
      const playPlayerDeath = () => playSound('playerDeath', 1, .96);
      // Follow the lethal projectile or dive to its on-screen contact.
      if (incomingImpactDelay) after(incomingImpactDelay, playPlayerDeath);
      else playPlayerDeath();
    }
    if (heroTurn.isPlaying && combat.heroes.some(unit => unit.heroId === 'grandGriffon' &&
      unit.statuses.aloft > 0 && before.heroes.some(old => old.uid === unit.uid && old.statuses.aloft <= 0))) {
      playSound('griffonTakeoff', 1, .95);
    }
    if (heroTurn.bossImpact === 'griffonDive') playSound('griffonDiveWhoosh', 1, .9);
    if (heroTurn.bladeStep) playSound('blade', 1.12, .82);
    if (heroTurn.arrowStep) {
      const shooter = combat.heroes.find(unit => unit.uid === heroTurn.arrowStep?.actorUid);
      after(HERO_SHOT_RELEASE_MS, () =>
        playSound(shooter?.heroId === 'ballista' ? 'siegeArrow' : 'arrow', .99, .84));
    }
    if (combat.player.statuses.rush > before.player.statuses.rush) playSound('rush', 1, .82);
    if (combat.player.guard > before.player.guard) playSound('guardSet', 1, .8);
    if (combat.player.statuses.armor > before.player.statuses.armor) playSound('armorUp', 1, .85);
    if (combat.player.hp > before.player.hp) playSound('heal', 1, .82);
    else if (combat.heroes.some(unit => before.heroes.some(old => old.uid === unit.uid && unit.hp > old.hp)))
      playSound('heal', 1, .65);
    const id = impactCard.current;
    const card = id ? getCard(id) : undefined;
    const pushedPlayer = combat.forcedMovement;
    const playerKnockedBack = pushedPlayer?.move === 'backStep' && pushedPlayer.distance > 0 &&
      pushedPlayer.count > (before.forcedMovement?.count ?? 0);
    const targetKnockedBack = !heroTurn.isPlaying && card?.effects.some(effect => effect.kind === 'push') &&
      combat.heroes.some(unit => before.heroes.some(old =>
        old.uid === unit.uid && (rowDepth(unit.row) > rowDepth(old.row) || unit.col !== old.col)));
    if (playerKnockedBack) {
      const cue = () => playSound('enemyKnockback', 1, .85);
      if (heroTurn.arrowStep) after(HERO_SHOT_RELEASE_MS + HERO_SHOT_FLIGHT_MS + 45, cue);
      else cue();
    }
    if (targetKnockedBack) playSound('knockback', 1, .82);
    // The row/column changes at the start of the visual slide. Compare
    // against the previous beat to keep attack lunges and the final commit quiet.
    if (heroTurn.isPlaying) {
      const moved = combat.heroes.filter(unit => unit.hp > 0 && before.heroes.some(old =>
        old.uid === unit.uid && (old.row !== unit.row || old.col !== unit.col)));
      if (moved.length) {
        const rate = [.88, .92, .95][moved[0]!.uid % 3] ?? .92;
        playSound('enemyStep', rate, .68);
      }
    }
    if ((!card || !usesShockCue(card)) && combat.heroes.some(unit => {
      const old = before.heroes.find(prior => prior.uid === unit.uid);
      if (!old || unit.hp >= old.hp) return false;
      // Poison and Hex ticks get their own cue from the status pop.
      return !(heroTurn.isPlaying && unit.statuses.burn >= old.statuses.burn &&
        (unit.statuses.poison < old.statuses.poison || unit.statuses.hex !== old.statuses.hex));
    })) {
      const heavy = id === 'siegeBlast' || id === 'hurlAside' || !!card?.effects.some(effect => effect.kind === 'damage' && effect.amount >= 12);
      const light = !!card?.effects.some(effect => effect.kind === 'damage' && effect.amount <= 4);

      playCombatImpact(id === 'reap' ? 'curse' : card?.type, card?.element, card?.edge, card?.type === 'melee' && card.edge !== 'sharp' ? .92 : .76, heavy, light);
    }
    if (combat.heroes.some(unit => !before.heroes.some(old => old.uid === unit.uid))) playSound('move', .85, .65);
  }, [combat, heroTurn.arrowStep, heroTurn.bladeStep, heroTurn.bossImpact, heroTurn.isPlaying, incomingImpactDelay]);
  const bossEntrance = useBossEntrance(combat.heroes, bossIntros);
  const isAnimating = heroTurn.isPlaying || cardHits.isPlaying;
  const lethal = useMemo(() => realCombat.player.hp > 0 && endTurn(realCombat).player.hp <= 0, [realCombat]);
  // The card played last: its type colours its damage numbers, and a
  // Magic card's element shapes its bursts.
  const [lastCard, setLastCard] = useState<{
    type: CardType;
    element?: MagicElement | undefined;
    edge?: MeleeEdge | undefined;
  }>();
  // Speed lines for every movement, Rampage Charges included.
  const burst = useMovementBurst(combat);
  useEffect(() => {
    if (!burst || burst.label || viewRef.current?.closest('[inert]')) return;
    playSound(burst.move === 'backStep' ? 'backstep' : 'charge', 1, .82);
  }, [burst]);
  // Recent hits, so damage numbers are sized against a typical hit.
  const [hitHistory] = useState(() => new HitHistory());
  const { pops: moveFails, show: showMoveFail } = useMoveFailPops();
  const { shots, sweeps, fire: fireShots, swing } = usePlayerShots();
  // True while your shots fly, before the card lands.
  const [isShooting, setIsShooting] = useState(false);
  const routeAction = useCallback(
    (action: RunAction) => {
      if (allowCombatAction && !allowCombatAction(action)) return;
      if (action.type === 'endTurn') {
        impactCard.current = undefined;
        playSound('turnEnd', 1, .77);
        return playHeroTurn();
      }
      if (action.type === 'move') impactCard.current = undefined;
      if (action.type === 'playCard') {
        const cardId = realCombat.hand[action.handIndex];
        const card = cardId ? getCard(cardId) : undefined;
        impactCard.current = cardId;
        setLastCard(card);
        // A knockback the target shrugs off shows a cancel sign on it.
        const { targetUid } = action;
        if (targetUid === SELF_TARGET_UID) {
          if (cardId) playCardSound(cardId);
          return playCardHits(action);
        }
        if (
          cardId &&
          targetUid !== undefined &&
          movementFailsOn(realCombat, cardId, targetUid)
        )
          showMoveFail(targetUid);
        // Range and Magic cards fire first; the hits land on arrival.
        const plan = shotPlanOf(realCombat, action);
        if (plan && fireShots(plan)) {
          if (cardId) playCardSound(cardId);
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
          if (cardId) playCardSound(cardId);
          setIsShooting(true);
          window.setTimeout(() => {
            setIsShooting(false);
            playCardHits(action);
          }, MELEE_SWEEP_MS);
          return;
        }
        if (cardId) playCardSound(cardId);
        return playCardHits(action);
      }
      onAction(action);
    },
    [
      allowCombatAction, playHeroTurn,
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
  const settings = <SettingsDialog className="self-center">{settingInputs}</SettingsDialog>;
  const [isPaused, setIsPaused] = useState(startsPaused);
  const [showCharacter, setShowCharacter] = useState(false);
  // Out of plays: the turn ends itself after a beat (see useAutoEndTurn).
  useAutoEndTurn(
    realCombat,
    !!manualTurns || !autoEnd || !!bossEntrance.entering || isAnimating || isShooting || isPaused || showCharacter,
    controls.endTurn
  );
  // The pile whose cards are open in the dialog, if any.
  const [openPile, setOpenPile] = useState<CardBrowserView | null>(null);
  const closePile = useCallback(() => {
    if (openPile) onPileClosed?.(openPile);
    setOpenPile(null);
  }, [openPile, onPileClosed]);
  const pops = useHitPops(
    combat.heroes,
    combat.turn,
    heroTurn.isPlaying,
    lastCard?.type,
    lastCard?.element,
    lastCard?.edge,
    hitHistory,
    cardHits.strikeIndex,
    combat.fallen
  );
  const playerHits = usePlayerHits(
    combat.player,
    combat.turn,
    heroTurn.arrowStep ? 'range' : heroTurn.attackType,
    hitHistory,
    heroTurn.strikes,
    heroTurn.element,
    heroTurn.bladeStep ? 'sharp' : undefined,
    incomingImpactDelay,
    heroTurn.bossImpact
  );
  useEffect(() => {
    if (viewRef.current?.closest('[inert]')) return;
    const seen = burstSoundSeen.current;
    const playBlock = (partial: boolean) => {
      const block = blockSound.current;
      const variants = [
        { rate: 1, delay: 0 },
        { rate: .94, delay: 19 },
        { rate: 1.07, delay: 8 },
        { rate: .98, delay: 28 },
      ] as const;
      const variant = variants[block.index++ % variants.length]!;
      const now = performance.now();
      const when = Math.max(block.nextAt, now + (now - block.lastHitAt < 400 ? variant.delay : 0));
      block.lastHitAt = now;
      block.nextAt = when + 100; // Separate simultaneous blocks and clear the same-cue cooldown.
      const cue = () => playSound('guard', variant.rate, partial ? .53 : .88);
      if (when <= now) cue();
      else {
        const pending = incomingAttackTimers.current;
        const timer = window.setTimeout(() => { pending.delete(timer); cue(); }, when - now);
        pending.add(timer);
      }
    };
    const hasBlock = (pop: (typeof playerHits)[number]) =>
      pop.kind === 'hit' && !pop.tick && (pop.blocked > 0 || (pop.armored ?? 0) > 0);
    for (const pop of pops) {
      if (pop.id <= seen.heroes) continue;
      seen.heroes = pop.id;
      if (hasBlock(pop)) playBlock(pop.amount > 0);
      playAfflictionBurst(pop);
    }
    for (const pop of playerHits) {
      if (pop.id <= seen.player) continue;
      seen.player = pop.id;
      if (pop.kind === 'hit' && !pop.tick) {
        if (hasBlock(pop)) playBlock(pop.amount > 0);
        if (pop.bossImpact) playSound(pop.bossImpact, 1, .95);
        else if (pop.amount > 0) {
          playCombatImpact(pop.source, pop.element, pop.edge, .98, pop.edge !== 'sharp' && pop.amount >= 12, pop.amount <= 4);
        }
      } else {
        playAfflictionBurst(pop);
      }
    }
  }, [pops, playerHits]);
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
      <div inert={!!bossEntrance.entering} className="table-field-frame relative flex min-h-0 flex-1 flex-col">
        <TopBar
          location={mapName}
          where={where}
          score={score}
          onOpenMenu={() => setIsPaused(true)}
          onOpenDeck={() => setOpenPile('deck')}
          onOpenCharacter={() => { setShowCharacter(true); onCharacterOpened?.(); }}
        />
        {/* BATTLEFIELD (fills the space between the plate and the band) */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <BattlefieldView
            bossEntrance={bossEntrance}
            heroes={combat.heroes}
            player={combat.player}
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
              label={burst.label}
            />
          )}
          <HitNumbers pops={pops} />
          <MoveFailPops pops={moveFails} />
        </div>
      </div>
      {/* BOTTOM BAND: rises over the field's foreground */}
      <div inert={!!bossEntrance.entering} className="table-console relative z-30 flex shrink-0 flex-col">
        <PlayerBar
          level={character.level}
          lethal={lethal && !isAnimating}
          combat={combat}
          hits={playerHits}
          onEndTurn={controls.endTurn}
          onOpenPile={setOpenPile}
          onTargetSelf={controls.selfTargetAvailable ? controls.tapSelf : undefined}
          selfTargetLocked={controls.selfTargetLocked}
          onOpenCharacter={() => { setShowCharacter(true); onCharacterOpened?.(); }}
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
          <EnergyTray inspectable={tutorialCue?.selector === '.table-pips'} energy={combat.energy} reserve={combat.reserve} traits={combat.player.traits} traitNodes={combat.player.traitNodes} equipment={combat.player.equipment} />
          <div className="table-afflictions" role="group" aria-label="Player afflictions">
            <StatusRow combatant={combat.player} group="afflictions" align="start" />
          </div>
        </div>
      </div>
      <div className="hero-plate-layer pointer-events-none absolute inset-0 z-[32]" />
      {bossEntrance.entering && <BossEntrance boss={bossEntrance.entering} onSkip={bossEntrance.skip} />}
      <CardPlayHistory entries={(heroTurn.isPlaying ? heroTurn.shown : realCombat).playHistory ?? []} />
      <AutoAimPreview
        uids={controls.autoAimUids}
        isLethalOn={controls.isAutoAimLethal}
      />
      {drag && (draggedCardId !== undefined || draggedMove) && (
        <>
          <DraggedCard
            cardId={draggedCardId}
            usesSpent={(draggedCardId && combat.usesSpent[draggedCardId]) ?? 0}
            killsThisTurn={combat.killsThisTurn ?? 0} followUpReady={combat.followUpReady}
            attacker={draggedCardId ? positionForCard(combat, draggedCardId, drag.handIndex).player : combat.player}
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
              hitChance={controls.aimChance} critChance={controls.critChance}
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
      {tutorialCue && !isAnimating && !isShooting && !isPaused && !showCharacter && !openPile && !drag && (
        <TutorialSpotlight {...(controls.heldIndex !== null && controls.autoAimUids.length > 0
          ? { selector: '[data-hero-uid="' + controls.autoAimUids[0] + '"] .hero-flight', label: 'Choose a target' }
          : tutorialCue)} />
      )}
      {showCharacter && (
        <RunCharacterSheet levelGuide={levelGuide} vitals={{ hp: combat.player.hp, maxHp: combat.player.maxHp, guard: combat.player.guard, energy: combat.energy }} onRespec={onRespec} character={character} onAction={onAction} onClose={() => { setShowCharacter(false); onCharacterClosed?.(); }} />
      )}
      {openPile && (
        <PileDialog
          pile={openPile}
          cards={openPile === 'deck' ? deck : pileCards(combat, openPile)}
          usesSpent={combat.usesSpent}
          killsThisTurn={combat.killsThisTurn ?? 0} followUpReady={combat.followUpReady}
          attacker={combat.player}
          onClose={closePile}
        />
      )}
      {isPaused && (renderTrainingMenu ? renderTrainingMenu(() => setIsPaused(false), settings) :
        <PauseSheet
          where={where}
          score={score}
          actions={<>{settings}{pauseActions}</>}
          onClose={() => setIsPaused(false)}
        />
      )}
    </div>
  );
};
