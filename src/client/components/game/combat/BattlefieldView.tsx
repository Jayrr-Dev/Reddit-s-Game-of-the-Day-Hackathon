// ===================================================================
// BATTLEFIELD VIEW
// The 3 x 2 battlefield as a parallax scene. Layers, back to front:
// backdrop -> back row -> ground shade -> front row -> foreground. The
// front row always draws over the back row. The camera (--cam) leans
// toward the focused hero, and the stage sways gently on its own.
// ===================================================================

import type { ReactNode } from 'react';
import { sizeOf } from '../../../../shared/game/battlefield';
import { BATTLEFIELD_COLUMNS } from '../../../../shared/game/rules';
import type { HeroRow, HeroUnit } from '../../../../shared/game/types';
import { FIELD_ATTR } from '../../../hooks/useCardDrag';
import { cssVars, depthStyle } from '../../../lib/cssVars';
import { Backdrop, Foreground } from './Backdrop';
import type { AimState } from '../../../hooks/useCombatControls';
import { HeroOnField } from './HeroOnField';

// --- TYPES ---
export type BattlefieldViewProps = {
  heroes: readonly HeroUnit[];
  hue: number;
  focusUid: number | null;
  /** Aim state per hero uid while a card is held (empty when none). */
  aimOf: (uid: number) => AimState;
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
  onTapHero,
}: BattlefieldViewProps) => {
  const focused = heroes.find((unit) => unit.uid === focusUid);
  /** Renders the heroes standing in one row. */
  const renderRow = (row: HeroRow) =>
    heroes
      .filter((unit) => unit.row === row)
      .map((unit) => (
        <HeroOnField
          key={unit.uid}
          unit={unit}
          isFocused={unit.uid === focusUid}
          aim={aimOf(unit.uid)}
          onTap={onTapHero}
        />
      ));

  return (
    <div
      className="parallax-stage relative min-h-0 flex-1 overflow-hidden"
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
    </div>
  );
};
