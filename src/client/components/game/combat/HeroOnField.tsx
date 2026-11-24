// ===================================================================
// HERO ON FIELD
// One hero placed on the 3 x 2 battlefield. Front-row heroes are drawn
// tall and low; back-row heroes small, higher and dimmer, so depth
// reads at a glance. Each hero wears its own health plate on top. Tapping a hero focuses it (and aims the selected
// card at it when that is a legal target).
// ===================================================================

import type { CSSProperties } from 'react';
import { isDeep, sizeOf } from '../../../../shared/game/battlefield';
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
import {
  drawSizeOf,
  isBoss,
  type HeroAction,
  type HeroActionStyle,
} from '../../../content/heroLooks';
import { figureAspect, headTopShare } from '../../../lib/heroFigure';
import { moodOf } from '../../../lib/heroMood';
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
  /**
   * The newest hit whose number still floats over this hero, or null.
   * The hero winces while it floats and flinches once per new hit.
   */
  lastHitId: number | null;
  /** True for a fallen hero playing its death (display only). */
  isDying?: boolean;
  /** Every hero on the field (what this one plans depends on them). */
  field: readonly HeroUnit[];
  onTap: (uid: number) => void;
};

// --- CONSTANTS ---
/** Where each row stands, as a share of the battlefield height. */
// Boxes include the plate on top. Front plates end below where back
// plates begin, so the two rows' plates never cover each other.
type RowBox = { bottom: string; height: string };
const ROW_BOX: Record<HeroRow, RowBox> = {
  front: { bottom: '2%', height: '56%' },
  back: { bottom: '63%', height: '25%' },
};
/**
 * A 2-deep hero fills both rows, from the front row's foot. It stops
 * short of the back row's top: its plate is taller (name, bar, chips)
 * and would otherwise clip under the top bar.
 */
const DEEP_BOX: RowBox = { bottom: '2%', height: '78%' };
/**
 * A boss is drawn as wide as the field, centred on its own slot, and
 * far taller than its row; in the back row it stands higher, behind
 * anyone in front. Its plate stays clear of the top bar either way.
 */
const BOSS_BOX: Record<HeroRow, RowBox> = {
  front: { bottom: '2%', height: '74%' },
  back: { bottom: '20%', height: '60%' },
};
/** How many columns wide a boss is drawn. */
const BOSS_DRAW_COLUMNS = 3;
/**
 * A boss may be drawn this much wider than the field, so it fills both
 * rows' height; only its wingtips spill past the edges.
 */
const BOSS_OVERSPILL = 1.25;

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
  if (isBoss(unit) && !isDeep(unit)) {
    // Centred on its slot: half the extra width spills to each side.
    const centre = unit.col + sizeOf(unit) / 2;
    return {
      left: `${(centre - BOSS_DRAW_COLUMNS / 2) * columnShare}%`,
      width: `${BOSS_DRAW_COLUMNS * columnShare}%`,
      ...BOSS_BOX[unit.row],
    };
  }
  return {
    left: `${unit.col * columnShare}%`,
    width: `${sizeOf(unit) * columnShare}%`,
    ...(isDeep(unit) ? DEEP_BOX : ROW_BOX[unit.row]),
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
  const size = drawSizeOf(unit);
  return (
    <div
      className="pointer-events-none absolute"
      style={boxStyle(unit)}
      aria-hidden="true"
    >
      <div className="relative h-full w-full [container-type:size]">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 origin-bottom animate-hero-death"
          style={bodyStyleOf(size, isBoss(unit))}
        >
          <HeroFigure heroId={unit.heroId} size={size} mood="wince" />
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

/**
 * Motes of holy light a fallen boss dissolves into:
 * [left %, bottom %, delay ms, drift px].
 */
const BOSS_MOTES: readonly (readonly [number, number, number, number])[] = [
  [32, 30, 520, -14],
  [40, 52, 600, 8],
  [47, 38, 560, -6],
  [52, 60, 680, 12],
  [58, 34, 620, 16],
  [64, 50, 740, -10],
  [36, 44, 800, 10],
  [44, 24, 860, -12],
  [55, 46, 900, 6],
  [61, 26, 960, -8],
  [49, 66, 1000, 14],
  [42, 58, 1060, -16],
];

/**
 * A boss's death, in its last spot: it staggers and roars, its halo
 * cracks and shatters, light bursts out of it, its wings crumple, and
 * it dissolves into rising motes of holy light. The drawing's own parts
 * play their share through [data-dying] (index.css, "BOSS DEATH"); the
 * field flashes and shakes too (BattlefieldView).
 */
const BossDeath = ({ unit }: { unit: HeroUnit }) => {
  const size = drawSizeOf(unit);
  return (
    <div
      className="pointer-events-none absolute"
      style={boxStyle(unit)}
      aria-hidden="true"
      data-dying=""
    >
      <div className="relative h-full w-full [container-type:size]">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 origin-bottom animate-boss-death"
          style={bodyStyleOf(size, true)}
        >
          <HeroFigure heroId={unit.heroId} size={size} mood="fierce" />
        </div>
        {BOSS_MOTES.map(([left, bottom, delay, drift]) => (
          <span
            key={`${left}-${delay}`}
            className="absolute size-1.5 rounded-full bg-[#fff4c8] opacity-0 shadow-[0_0_8px_#ffe58a] animate-holy-mote"
            style={{
              left: `${left}%`,
              bottom: `${bottom}%`,
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
const bodyStyleOf = (size: HeroSize, isBoss = false): CSSProperties => ({
  height: `min(100cqh, ${(isBoss ? BOSS_OVERSPILL : 1) * (100 / figureAspect(size))}cqw)`,
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
  lastHitId,
  isDying = false,
  field,
  onTap,
}: HeroOnFieldProps) => {
  if (isDying)
    return isBoss(unit) ? <BossDeath unit={unit} /> : <DyingHero unit={unit} />;
  const hero = getHero(unit.heroId);
  const size = drawSizeOf(unit);
  const isBack = unit.row === 'back';
  const focusClass = isFocused
    ? 'drop-shadow-[0_0_10px_var(--color-accent)]'
    : '';
  const bodyStyle = bodyStyleOf(size, isBoss(unit));
  const mood = moodOf({
    isHurt: lastHitId !== null,
    isActing: action !== null,
    hp: unit.hp,
    maxHp: unit.maxHp,
  });
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
              {/* FLINCH: re-keyed by each new hit, so it plays once per hit */}
              <div
                key={lastHitId ?? 'steady'}
                className={`h-full w-full origin-bottom ${lastHitId === null ? '' : 'animate-flinch'}`}
              >
                <HeroFigure
                  heroId={unit.heroId}
                  size={size}
                  action={action}
                  mood={mood}
                />
              </div>
            </div>
            {pickMarker && <PickMark marker={pickMarker} />}
            <div
              className="absolute left-1/2 flex -translate-x-1/2 justify-center"
              style={plateStyle(size)}
            >
              <HeroPlate unit={unit} field={field} isFocused={isFocused} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};
