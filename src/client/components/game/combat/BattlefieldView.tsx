// ===================================================================
// BATTLEFIELD VIEW
// The 3 x 3 battlefield as a parallax scene. Layers, back to front:
// backdrop -> Horizon -> Backline -> ground shade -> Front line ->
// foreground. A nearer row always draws over a farther one. The camera (--cam) leans
// toward the focused hero, and rests when focus is still.
// Heroes that change rows glide there (see useRowMoves); fallen heroes
// play their death in place first (see useFallenHeroes). A boss's first
// appearance plays its entrance over the field (see useBossEntrance).
// ===================================================================

import { useRef, type ReactNode } from 'react';
import { activeRows, sizeOf } from '../../../../shared/game/battlefield';
import { BATTLEFIELD_COLUMNS } from '../../../../shared/game/rules';
import type { HeroRow, HeroUnit } from '../../../../shared/game/types';
import { isBoss, type HeroAction } from '../../../content/heroLooks';
import { FIELD_ATTR } from '../../../hooks/useCardDrag';
import { cssVars, depthStyle } from '../../../lib/cssVars';
import { Backdrop } from './Backdrop';
import type { AimState, PickMarker } from '../../../hooks/useCombatControls';
import { useBossEntrance } from '../../../hooks/useBossEntrance';
import { useFallenHeroes } from '../../../hooks/useFallenHeroes';
import { usePlateSpacing } from '../../../hooks/usePlateSpacing';
import { useRowMoves } from '../../../hooks/useRowMoves';
import { BossEntrance } from './BossEntrance';
import { HeroOnField } from './HeroOnField';

// --- TYPES ---
export type BattlefieldViewProps = {
  heroes: readonly HeroUnit[];
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
/** Rows past the front, drawn farthest first (nearer rows on top). */
const farRowsFarthestFirst = (): HeroRow[] =>
  activeRows()
    .filter((row) => row !== 'front')
    .toReversed();

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
  depth,
  children,
}: {
  depth: number;
  children: ReactNode;
}) => (
  <div
    className="table-hero-row parallax-layer pointer-events-none absolute -inset-x-8 inset-y-0"
    style={depthStyle(depth)}
  >
    <div className="absolute inset-y-0 left-10 right-10">{children}</div>
  </div>
);

// --- COMPONENT ---
/** Renders the scene with every hero in its row and columns. */
export const BattlefieldView = ({
  heroes,
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
  useRowMoves(fieldRef, heroes);
  const ghosts = useFallenHeroes(heroes);
  const bossEntrance = useBossEntrance(heroes);
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
  const skipClass = bossEntrance.isSkipped ? 'boss-entrance-skipped' : '';
  const focused = heroes.find((unit) => unit.uid === focusUid);
  /** Renders the heroes standing in one row, then any falling there. */
  const renderRow = (row: HeroRow) => [
    ...heroes
      .filter((unit) => unit.row === row)
      .map((unit) => (
        <HeroOnField
          key={unit.uid}
          unit={unit}
          isFocused={unit.uid === focusUid}
          aim={aimOf(unit.uid)}
          pickMarker={pickMarkerOf(unit.uid)}
          action={acting.get(unit.uid) ?? null}
          lastHitId={lastHitIds.get(unit.uid) ?? null}
          field={heroes}
          onTap={onTapHero}
        />
      )),
    ...ghosts
      .filter((unit) => unit.row === row)
      .map((unit) => (
        <HeroOnField
          key={`fallen-${unit.uid}`}
          unit={unit}
          isFocused={false}
          aim="idle"
          pickMarker={null}
          action={null}
          lastHitId={null}
          isDying
          field={heroes}
          onTap={onTapHero}
        />
      )),
  ];

  return (
    <div
      ref={fieldRef}
      className={`parallax-stage relative min-h-0 flex-1 overflow-hidden ${shakeClass} ${skipClass}`}
      {...{ [FIELD_ATTR]: true }}
      style={cssVars({ '--cam': cameraFor(focused) })}
    >
      <div className="absolute inset-0">
        <div className="field-camera pointer-events-none absolute inset-0" style={{ ...cssVars({ '--travel-rows': travelRows }), transformOrigin: '50% var(--horizon)' }}>
          <Backdrop terrainIndex={terrainIndex} depths={ROW_DEPTH} hasHorizon={activeRows().includes('horizon')} />
        </div>
        {farRowsFarthestFirst().map((row) => (
          <RowLayer key={row} depth={ROW_DEPTH[row]}>
            {renderRow(row)}
          </RowLayer>
        ))}
        <div
          className="parallax-layer pointer-events-none absolute -inset-x-8 bottom-0 h-1/2"
          style={{
            ...depthStyle(0.8),
            background: `linear-gradient(transparent, rgb(20 14 24 / 0.18))`,
          }}
        />
        <RowLayer depth={ROW_DEPTH.front}>{renderRow('front')}</RowLayer>
      </div>

      {bossEntrance.entering && (
        <BossEntrance boss={bossEntrance.entering} onSkip={bossEntrance.skip} />
      )}
      {isBossFalling && (
        <div className="pointer-events-none absolute inset-0 bg-[#fffbe8] opacity-0 animate-boss-flash" />
      )}
    </div>
  );
};
