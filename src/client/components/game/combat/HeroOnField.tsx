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
import type {
  HeroRow,
  HeroSize,
  HeroUnit,
} from '../../../../shared/game/types';
import {
  HERO_ANCHOR_ATTR,
  HERO_ROW_ATTR,
  HERO_UID_ATTR,
} from '../../../hooks/useCardDrag';
import type { AimState, PickMarker } from '../../../hooks/useCombatControls';
import type { HeroAction, HeroActionStyle } from '../../../content/heroLooks';
import { figureAspect, headTopShare } from '../../../lib/heroFigure';
import { seeded } from '../../../lib/seeded';
import { HeroFigure } from './HeroFigure';
import { HeroPlate } from './HeroPlate';
import { PickMark } from './PickMark';

// --- TYPES ---
export type HeroOnFieldProps = {
  unit: HeroUnit;
  isFocused: boolean;
  aim: AimState;
  /** Set while a held Target card has picked this hero. */
  pickMarker: PickMarker | null;
  /** How this hero's move animates while it plays; null when idle. */
  action: HeroAction | null;
  /** True for a fallen hero playing its death (display only). */
  isDying?: boolean;
  onTap: (uid: number) => void;
};

// --- CONSTANTS ---
/** Where each row stands, as a share of the battlefield height. */
// Boxes include the plate on top. Front plates end below where back
// plates begin, so the two rows' plates never cover each other.
const ROW_BOX: Record<HeroRow, { bottom: string; height: string }> = {
  front: { bottom: '2%', height: '56%' },
  back: { bottom: '63%', height: '25%' },
};

/**
 * How the whole body moves during each kind of move (the prop's own
 * swing, draw or cast is drawn inside HeroFigure):
 *   melee    steps forward into the swing
 *   range    leans back as the shot recoils
 *   magic    rises as the spell is cast
 *   support  swells briefly
 */
const BODY_ACTION_CLASS: Record<HeroActionStyle, string> = {
  melee: 'animate-hero-lunge',
  range: 'animate-hero-recoil',
  magic: 'animate-hero-cast',
  support: 'animate-hero-pulse',
};

/** The body's motion for a move; a forward cut lunges deeper. */
const bodyActionClass = (action: HeroAction): string =>
  action.style === 'melee' &&
  (action.swing === 'forward' || action.swing === 'forwardRight')
    ? 'animate-hero-lunge-deep'
    : BODY_ACTION_CLASS[action.style];

/**
 * March-in stagger (ms): heroes enter one column after another, the
 * back row a beat behind the front, so a new wave reads as a march.
 */
const MARCH_STAGGER_PER_COL_MS = 70;
const MARCH_BACK_ROW_DELAY_MS = 90;

/** When this hero starts marching in. */
const marchDelayMs = (unit: HeroUnit): number =>
  unit.col * MARCH_STAGGER_PER_COL_MS +
  (unit.row === 'back' ? MARCH_BACK_ROW_DELAY_MS : 0);

/**
 * Idle sway: each hero rocks on its own period, phase and strength, so
 * the horde never moves in lockstep. Parallax: the front row (nearer)
 * sways about twice as far as the back row.
 */
const SWAY_PERIOD_MIN_MS = 3200;
const SWAY_PERIOD_SPREAD_MS = 2000;
const SWAY_PX: Record<HeroRow, { min: number; spread: number }> = {
  front: { min: 2.5, spread: 1.5 },
  back: { min: 1.2, spread: 0.8 },
};
/** Tilt (deg) per px of sway, so the rock reads as weight shifting. */
const SWAY_TILT_PER_PX = 0.3;

/** Gap (px) kept between the plate and the top of the drawing space. */
const PLATE_REST_PX = 2;

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

/**
 * Seats the plate just above the helmet. The drawing has empty space
 * above the head (headTopShare of its height); the plate sinks into
 * half of it, so the plate sits half as far above the head as it would
 * resting on the drawing's top edge (PLATE_REST_PX is the old 4 px gap,
 * halved too). Percentages are of the drawing's height.
 */
const plateStyle = (size: HeroSize): CSSProperties => ({
  bottom: `calc(${100 - (headTopShare(size) * 100) / 2}% + ${PLATE_REST_PX}px)`,
});

/**
 * One hero's sway timing and strength, fixed by its uid. A negative
 * delay starts it mid-cycle, so heroes that appear together still drift
 * apart at once. PERFORMANCE: the keyframes animate transform only, on
 * this hero's own layer (no inherited properties, no restyle).
 */
const swayStyle = (unit: HeroUnit): CSSProperties => {
  const period =
    SWAY_PERIOD_MIN_MS + seeded(unit.uid, 1) * SWAY_PERIOD_SPREAD_MS;
  const { min, spread } = SWAY_PX[unit.row];
  const px = min + seeded(unit.uid, 2) * spread;
  return {
    animationDuration: `${Math.round(period)}ms`,
    animationDelay: `${-Math.round(seeded(unit.uid, 3) * period)}ms`,
    ['--sway-px' as string]: px.toFixed(2),
    ['--sway-tilt' as string]: (px * SWAY_TILT_PER_PX).toFixed(2),
  };
};

// --- SUBCOMPONENTS ---
/** Embers that rise off a falling hero: [left %, delay ms, drift px]. */
const EMBERS: readonly (readonly [number, number, number])[] = [
  [30, 0, -10],
  [45, 60, 6],
  [55, 20, -4],
  [65, 90, 12],
  [38, 120, 8],
  [60, 150, -12],
];

/**
 * A fallen hero's death, in its last spot: a white hit flash, a stagger,
 * then it slumps and burns away while embers rise. No uid, so nothing
 * can target or tap it.
 */
const DyingHero = ({ unit }: { unit: HeroUnit }) => {
  const size = sizeOf(unit);
  return (
    <div
      className="pointer-events-none absolute"
      style={boxStyle(unit)}
      aria-hidden="true"
    >
      <div className="relative h-full w-full [container-type:size]">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 origin-bottom animate-hero-death"
          style={bodyStyleOf(size)}
        >
          <HeroFigure heroId={unit.heroId} size={size} />
        </div>
        {EMBERS.map(([left, delay, drift]) => (
          <span
            key={`${left}-${delay}`}
            className="absolute bottom-[35%] size-1.5 rounded-full bg-wrath shadow-[0_0_6px_var(--color-wrath)] animate-ember"
            style={{
              left: `${left}%`,
              animationDelay: `${delay}ms`,
              ['--drift' as string]: `${drift}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

/** The drawing's size: as tall as fits the box at its aspect ratio. */
const bodyStyleOf = (size: HeroSize): CSSProperties => ({
  height: `min(100cqh, ${100 / figureAspect(size)}cqw)`,
  aspectRatio: figureAspect(size),
});

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
  pickMarker,
  action,
  isDying = false,
  onTap,
}: HeroOnFieldProps) => {
  if (isDying) return <DyingHero unit={unit} />;
  const hero = getHero(unit.heroId);
  const size = sizeOf(unit);
  const isBack = unit.row === 'back';
  const focusClass = isFocused
    ? 'drop-shadow-[0_0_10px_var(--color-accent)]'
    : '';
  const bodyStyle = bodyStyleOf(size);
  return (
    <button
      type="button"
      onClick={() => onTap(unit.uid)}
      {...{ [HERO_UID_ATTR]: unit.uid, [HERO_ROW_ATTR]: unit.row }}
      aria-label={`${hero.name}, ${unit.hp} of ${unit.maxHp} HP, ${unit.row} row`}
      className={`pointer-events-auto absolute transition-[left,bottom,width,height,scale,opacity,filter] duration-700 ${AIM_CLASS[aim]}`}
      style={boxStyle(unit)}
    >
      {/* MARCHES IN ONCE, WHEN THE HERO FIRST APPEARS (A NEW WAVE) */}
      <div
        className="relative h-full w-full origin-bottom animate-hero-march [container-type:size]"
        style={{ animationDelay: `${marchDelayMs(unit)}ms` }}
      >
        <div
          className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${action ? bodyActionClass(action) : ''}`}
          style={bodyStyle}
          {...{ [HERO_ANCHOR_ATTR]: true }}
        >
          {/* IDLE SWAY: figure, pick mark and plate rock together */}
          <div
            className="relative h-full w-full origin-bottom animate-hero-sway"
            style={swayStyle(unit)}
          >
            <div
              className={`h-full w-full ${isBack ? 'brightness-75' : ''} ${focusClass} ${aim === 'legal' ? 'animate-pulse' : ''}`}
            >
              <HeroFigure heroId={unit.heroId} size={size} action={action} />
            </div>
            {pickMarker && <PickMark marker={pickMarker} />}
            <div
              className="absolute left-1/2 flex -translate-x-1/2 justify-center"
              style={plateStyle(size)}
            >
              <HeroPlate unit={unit} isFocused={isFocused} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};
