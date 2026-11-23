// ===================================================================
// HERO ON FIELD
// One hero placed on the 3 x 2 battlefield. Front-row heroes are drawn
// tall and low; back-row heroes small, higher and dimmer, so depth
// reads at a glance. Each hero wears its own health plate on top. Tapping a hero focuses it (and aims the selected
// card at it when that is a legal target).
// ===================================================================

import type { CSSProperties } from 'react';
import { sizeOf } from '../../../../shared/game/battlefield';
import { getHero } from '../../../../shared/game/heroes';
import { BATTLEFIELD_COLUMNS } from '../../../../shared/game/rules';
import type { HeroRow, HeroUnit } from '../../../../shared/game/types';
import {
  HERO_ANCHOR_ATTR,
  HERO_ROW_ATTR,
  HERO_UID_ATTR,
} from '../../../hooks/useCardDrag';
import type { AimState } from '../../../hooks/useCombatControls';
import { figureAspect } from '../../../lib/heroFigure';
import { HeroFigure } from './HeroFigure';
import { HeroPlate } from './HeroPlate';

// --- TYPES ---
export type HeroOnFieldProps = {
  unit: HeroUnit;
  isFocused: boolean;
  aim: AimState;
  onTap: (uid: number) => void;
};

// --- CONSTANTS ---
/** Where each row stands, as a share of the battlefield height. */
// Boxes include the plate on top. Front plates end below where back
// plates begin, so the two rows' plates never cover each other.
const ROW_BOX: Record<HeroRow, { bottom: string; height: string }> = {
  front: { bottom: '2%', height: '58%' },
  back: { bottom: '46%', height: '26%' },
};

const AIM_CLASS: Record<AimState, string> = {
  idle: '',
  legal: 'drop-shadow-[0_0_8px_var(--color-accent)]',
  locked: 'scale-105 drop-shadow-[0_0_14px_var(--color-accent)]',
  illegal: 'opacity-35 grayscale',
  marked: 'drop-shadow-[0_0_8px_var(--color-hp)]',
  struck: 'scale-105 drop-shadow-[0_0_16px_var(--color-hp)] brightness-110',
};

// --- HELPERS ---
/** Absolute box for a hero from its row, column and size. */
const boxStyle = (unit: HeroUnit): CSSProperties => {
  const columnShare = 100 / BATTLEFIELD_COLUMNS;
  return {
    left: `${unit.col * columnShare}%`,
    width: `${sizeOf(unit) * columnShare}%`,
    ...ROW_BOX[unit.row],
  };
};

// --- COMPONENT ---
/**
 * Renders the hero with its health plate sitting on its head.
 * LAYOUT: the box is a size container; the drawing is fitted inside it
 * (height = min(box height, box width / aspect)) and pinned to the
 * bottom, and the plate is pinned to the drawing's top edge. So the
 * plate always rests just above the head, whatever the box shape.
 */
export const HeroOnField = ({
  unit,
  isFocused,
  aim,
  onTap,
}: HeroOnFieldProps) => {
  const hero = getHero(unit.heroId);
  const size = sizeOf(unit);
  const isBack = unit.row === 'back';
  const focusClass = isFocused
    ? 'drop-shadow-[0_0_10px_var(--color-accent)]'
    : '';
  const bodyStyle: CSSProperties = {
    height: `min(100cqh, ${100 / figureAspect(size)}cqw)`,
    aspectRatio: figureAspect(size),
  };
  return (
    <button
      type="button"
      onClick={() => onTap(unit.uid)}
      {...{ [HERO_UID_ATTR]: unit.uid, [HERO_ROW_ATTR]: unit.row }}
      aria-label={`${hero.name}, ${unit.hp} of ${unit.maxHp} HP, ${unit.row} row`}
      className={`pointer-events-auto absolute transition-all duration-700 ${AIM_CLASS[aim]}`}
      style={boxStyle(unit)}
    >
      <div className="relative h-full w-full [container-type:size]">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={bodyStyle}
          {...{ [HERO_ANCHOR_ATTR]: true }}
        >
          <div
            className={`h-full w-full ${isBack ? 'brightness-75' : ''} ${focusClass} ${aim === 'legal' ? 'animate-pulse' : ''}`}
          >
            <HeroFigure hue={hero.hue} tier={hero.tier} size={size} />
          </div>
          <div className="absolute bottom-full left-1/2 mb-1 flex -translate-x-1/2 justify-center">
            <HeroPlate unit={unit} isFocused={isFocused} />
          </div>
        </div>
      </div>
    </button>
  );
};
