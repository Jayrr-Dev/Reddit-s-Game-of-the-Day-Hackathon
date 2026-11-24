// ===================================================================
// BATTLEFIELD VIEW
// The 3 x 2 battlefield as a parallax scene. Layers, back to front:
// backdrop -> back row -> ground shade -> front row -> foreground. The
// front row always draws over the back row. The camera (--cam) leans
// toward the focused hero, and the stage sways gently on its own.
// Heroes that change rows glide there (see useRowMoves); fallen heroes
// play their death in place first (see useFallenHeroes).
// ===================================================================

import { useRef, type ReactNode } from 'react';
import { sizeOf } from '../../../../shared/game/battlefield';
import { BATTLEFIELD_COLUMNS } from '../../../../shared/game/rules';
import type { HeroRow, HeroUnit } from '../../../../shared/game/types';
import { isBoss, type HeroAction } from '../../../content/heroLooks';
import { FIELD_ATTR } from '../../../hooks/useCardDrag';
import { cssVars, depthStyle } from '../../../lib/cssVars';
import { Backdrop, Foreground } from './Backdrop';
import type { AimState, PickMarker } from '../../../hooks/useCombatControls';
import { useFallenHeroes } from '../../../hooks/useFallenHeroes';
import { usePlateSpacing } from '../../../hooks/usePlateSpacing';
import { ROW_LAYER_ATTR, useRowMoves } from '../../../hooks/useRowMoves';
import { HeroOnField } from './HeroOnField';

// --- TYPES ---
export type BattlefieldViewProps = {
  heroes: readonly HeroUnit[];
  hue: number;
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
const CAMERA_LEAN_PX = 26;
/** Parallax depth of each row's layer. */
const ROW_DEPTH: Record<HeroRow, number> = { back: 0.65, front: 1 };

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
    className="parallax-layer pointer-events-none absolute -inset-x-8 inset-y-0"
    style={depthStyle(depth)}
    {...{ [ROW_LAYER_ATTR]: true }}
  >
    <div className="absolute inset-y-0 left-10 right-10">{children}</div>
  </div>
);

// --- COMPONENT ---
/** Renders the scene with every hero in its row and columns. */
export const BattlefieldView = ({
  heroes,
  hue,
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
      : '';
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
      className={`parallax-stage relative min-h-0 flex-1 overflow-hidden ${shakeClass}`}
      {...{ [FIELD_ATTR]: true }}
      style={cssVars({ '--cam': cameraFor(focused) })}
    >
      <Backdrop hue={hue} />
      <RowLayer depth={ROW_DEPTH.back}>{renderRow('back')}</RowLayer>
      <div
        className="parallax-layer pointer-events-none absolute -inset-x-8 bottom-0 h-1/2"
        style={{
          ...depthStyle(0.8),
          background: `linear-gradient(transparent, hsl(${hue} 35% 6% / 0.85))`,
        }}
      />
      <RowLayer depth={ROW_DEPTH.front}>{renderRow('front')}</RowLayer>
      <Foreground hue={hue} />
      {isBossFalling && (
        <div className="pointer-events-none absolute inset-0 bg-[#fffbe8] opacity-0 animate-boss-flash" />
      )}
    </div>
  );
};
