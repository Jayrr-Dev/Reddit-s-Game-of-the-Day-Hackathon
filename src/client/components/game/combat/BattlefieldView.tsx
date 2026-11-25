// ===================================================================
// BATTLEFIELD VIEW
// The 3 x 3 battlefield as a parallax scene. Layers, back to front:
// backdrop -> Horizon -> Backline -> ground shade -> Front line ->
// foreground. A nearer row always draws over a farther one. The camera (--cam) leans
// toward the focused hero, and rests when focus is still.
// Heroes keep their field slots as they glide between rows; fallen heroes
// play their death in place first (see useFallenHeroes). A boss's first
// appearance plays its entrance over the field (see useBossEntrance).
// ===================================================================

import { BOSS_ENTRANCE_MS, BOSS_LANDING_MS, bossEntranceOf } from '../../../content/bossEntrances';
import { useRef, type ReactNode } from 'react';
import { activeRows, rowDepth, sizeOf } from '../../../../shared/game/battlefield';
import { BATTLEFIELD_COLUMNS } from '../../../../shared/game/rules';
import type { Combatant, HeroRow, HeroUnit } from '../../../../shared/game/types';
import { isBoss, type HeroAction } from '../../../content/heroLooks';
import { FIELD_ATTR } from '../../../hooks/useCardDrag';
import { cssVars, depthStyle } from '../../../lib/cssVars';
import { Backdrop } from './Backdrop';
import type { AimState, PickMarker } from '../../../hooks/useCombatControls';
import type { useBossEntrance } from '../../../hooks/useBossEntrance';
import { useFallenHeroes } from '../../../hooks/useFallenHeroes';
import { usePlateSpacing } from '../../../hooks/usePlateSpacing';

import { HeroOnField } from './HeroOnField';

// --- TYPES ---
export type BattlefieldViewProps = {
  bossEntrance: ReturnType<typeof useBossEntrance>;
  heroes: readonly HeroUnit[];
  player: Combatant;
  terrainIndex: number;
  travelRows: number;
  focusUid: number | null;
  /** Aim state per hero uid while a card is held (empty when none). */
  aimOf: (uid: number) => AimState;
  /** The Target pick marker on a hero, if a held card picked it. */
  pickMarkerOf: (uid: number) => PickMarker | null;
  /** Heroes whose move is playing right now, with its style (hero turn). */
  acting: ReadonlyMap<number, HeroAction>;
  /** The newest hit still floating over each hurt hero, by uid. */
  lastHitIds: ReadonlyMap<number, number>;
  onTapHero: (uid: number) => void;
};

// --- CONSTANTS ---
/** How far (px) the camera leans per column away from the centre. */
const CAMERA_LEAN_PX = 1;
/** Parallax depth of each row's layer. */
const ROW_DEPTH: Record<HeroRow, number> = {
  horizon: 0.45,
  back: 0.65,
  front: 1,
};

// --- HELPERS ---
/** Camera offset (px) that leans toward the focused hero. */
const cameraFor = (focused: HeroUnit | undefined): number => {
  if (!focused) return 0;
  const centre = focused.col + sizeOf(focused) / 2;
  return -(centre - BATTLEFIELD_COLUMNS / 2) * CAMERA_LEAN_PX;
};

// --- SUBCOMPONENTS ---
/** One parallax layer holding a row; the inner box keeps the columns aligned. */
const RowLayer = ({
  row,
  children,
}: {
  row: HeroRow;
  children: ReactNode;
}) => (
  <div
    className="table-hero-row parallax-layer pointer-events-none absolute -inset-x-8 inset-y-0"
    style={{ ...depthStyle(ROW_DEPTH[row]), zIndex: 4 - rowDepth(row) * 2 }}
  >
    <div className="absolute inset-y-0 left-10 right-10">{children}</div>
  </div>
);

// --- COMPONENT ---
/** Renders the scene with every hero in its row and columns. */
export const BattlefieldView = ({
  bossEntrance,
  heroes,
  player,
  terrainIndex,
  travelRows,
  focusUid,
  aimOf,
  pickMarkerOf,
  acting,
  lastHitIds,
  onTapHero,
}: BattlefieldViewProps) => {
  const fieldRef = useRef<HTMLDivElement>(null);
  usePlateSpacing(fieldRef, heroes);
  const ghosts = useFallenHeroes(heroes);

  // A boss's death shakes the whole field and flashes it white.
  const isBossFalling = ghosts.some(isBoss);
  // A signature blow struck in Melee (a dive from the sky) lands hard.
  const isHeavyBlow = [...acting.values()].some(
    (action) => action.isSignature && action.style === 'melee'
  );
  const shakeClass = isBossFalling
    ? 'animate-field-shake'
    : isHeavyBlow
      ? 'animate-dive-shake'
      : bossEntrance.entering
        ? 'boss-entrance-shake'
        : '';
  const entrance = bossEntrance.entering && bossEntranceOf(bossEntrance.entering.heroId);
  const skipClass = bossEntrance.isSkipped ? 'boss-entrance-skipped' : '';
  const focused = heroes.find((unit) => unit.uid === focusUid);

  return (
    <div
      ref={fieldRef}
      className={`parallax-stage relative min-h-0 flex-1 overflow-hidden ${skipClass}`}
      {...{ [FIELD_ATTR]: true }}
      style={cssVars({ '--cam': cameraFor(focused), '--intro-ms': entrance?.durationMs ?? BOSS_ENTRANCE_MS, '--landing-ms': entrance?.landingMs ?? BOSS_LANDING_MS })}
    >
      <div className={`absolute isolate inset-0 ${shakeClass}`}>
        <div className="field-camera pointer-events-none absolute inset-0" style={{ ...cssVars({ '--travel-rows': travelRows }), transformOrigin: '50% var(--horizon)' }}>
          <Backdrop terrainIndex={terrainIndex} depths={ROW_DEPTH} hasHorizon={activeRows().includes('horizon')} />
        </div>
        <div
          className="parallax-layer pointer-events-none absolute -inset-x-8 bottom-0 h-1/2"
          style={{
            ...depthStyle(0.8),
            zIndex: 3,
            background: `linear-gradient(transparent, rgb(20 14 24 / 0.18))`,
          }}
        />
        {heroes.map(unit => (
          <RowLayer key={unit.uid} row={unit.row}>
            <HeroOnField unit={unit} player={player} isFocused={unit.uid === focusUid}
              aim={aimOf(unit.uid)} pickMarker={pickMarkerOf(unit.uid)}
              action={acting.get(unit.uid) ?? null} lastHitId={lastHitIds.get(unit.uid) ?? null}
              field={heroes} onTap={onTapHero} />
          </RowLayer>
        ))}
        {ghosts.map(unit => (
          <RowLayer key={`fallen-${unit.uid}`} row={unit.row}>
            <HeroOnField unit={unit} player={player} isFocused={false} aim="idle" pickMarker={null}
              action={null} lastHitId={null} isDying field={heroes} onTap={onTapHero} />
          </RowLayer>
        ))}
      </div>
      {isBossFalling && (
        <div className="pointer-events-none absolute inset-0 bg-[#fffbe8] opacity-0 animate-boss-flash" />
      )}
    </div>
  );
};
