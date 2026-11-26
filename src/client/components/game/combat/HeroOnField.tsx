// ===================================================================
// HERO ON FIELD
// One hero placed on the 3 x 2 battlefield. Front-row heroes are drawn
// tall and low; Backline heroes smaller, higher and dimmer, Horizon
// heroes smallest and faded (Out of Range), so depth
// reads at a glance. Each hero wears its own health plate on top. Tapping a hero focuses it (and aims the selected
// card at it when that is a legal target).
// ===================================================================

import { useState, type CSSProperties } from 'react';
import {
  isAloft,
  isDeep,
  rowDepth,
  sizeOf,
} from '../../../../shared/game/battlefield';
import { rowLabel } from '../../../../shared/game/describe';
import { HORIZON_SLOT_SPAN, rowPerspective } from './rowPerspective';
import { getHero } from '../../../../shared/game/heroes';
import { BATTLEFIELD_COLUMNS } from '../../../../shared/game/rules';
import type {
  Combatant,
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
  bossStageOf,
  type BossStage,
  drawSizeOf,
  isBoss,
  type HeroAction,
  type HeroActionStyle,
} from '../../../content/heroLooks';
import { bossEntranceOf } from '../../../content/bossEntrances';
import { figureAspect, headTopShare } from '../../../lib/heroFigure';
import { moodOf } from '../../../lib/heroMood';
import { seeded } from '../../../lib/seeded';
import { GroundShadow } from './GroundShadow';
import { HexAura } from './HexAura';
import { HeroFigure } from './HeroFigure';
import { HeroPlate } from './HeroPlate';
import { PickMark } from './PickMark';

// --- TYPES ---
export type HeroOnFieldProps = {
  unit: HeroUnit;
  player: Combatant;
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
/** How many columns wide a boss is drawn. */
const BOSS_DRAW_COLUMNS = 3;
/**
 * A boss may be drawn this much wider than the field, so it fills both
 * rows' height; only its wingtips spill past the edges.
 */
const BOSS_OVERSPILL = 1.25;
/**
 * A staged boss's drawing may be this wide, as a share of the field (its
 * wingtips spill a little past the drawing itself).
 */
const STAGED_BOSS_SPAN = 0.95;

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

/**
 * Moves that lift the unit off the ground (index.css, UNIT LIFT): set on
 * the field box, so the shadow, which sits outside the body, answers it.
 */
const LIFT_ACTION_CLASS: Partial<Record<HeroActionStyle, string>> = {
  magic: 'animate-unit-cast-lift',
};

/** The body's motion for a move; a forward cut lunges deeper. */
const bodyActionClass = (action: HeroAction): string =>
  action.style === 'melee' &&
  (action.swing === 'forward' || action.swing === 'forwardRight')
    ? 'animate-hero-lunge-deep'
    : BODY_ACTION_CLASS[action.style];

/**
 * March-in stagger (ms): heroes enter one column after another, each
 * row a beat behind the one nearer, so a new wave reads as a march.
 */
const MARCH_STAGGER_PER_COL_MS = 70;
const MARCH_ROW_DELAY_MS = 90;

/** When this hero starts marching in. */
const marchDelayMs = (unit: HeroUnit): number =>
  unit.col * MARCH_STAGGER_PER_COL_MS + rowDepth(unit.row) * MARCH_ROW_DELAY_MS;

/**
 * How far-off each row looks: the Backline a little dimmed, the Horizon
 * dimmed and faded (it is Out of Range). Filter and opacity only.
 */
const ROW_TINT_CLASS: Record<HeroRow, string> = {
  front: '',
  back: 'brightness-75',
  horizon: 'brightness-60 opacity-70',
};

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
  horizon: { min: 0.6, spread: 0.4 },
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
  const { feet } = rowPerspective(unit.row);
  const boss = isBoss(unit);
  const depthScale = feet / rowPerspective('front').feet;
  const columnCenter = (unit.col + sizeOf(unit) / 2) / BATTLEFIELD_COLUMNS;
  const horizontalSpan = unit.row === 'horizon' ? HORIZON_SLOT_SPAN : feet;
  const span =
    unit.heroId === 'angelArcher'
      ? Math.max(horizontalSpan, 0.96)
      : horizontalSpan;
  const center = 0.5 + (columnCenter - 0.5) * span;
  const columns = boss ? BOSS_DRAW_COLUMNS : sizeOf(unit);
  const width = (columns / BATTLEFIELD_COLUMNS) * depthScale;
  const heightAtFeet = isDeep(unit) ? 0.82 : boss ? 0.76 : 0.58;
  return {
    left: `${100 * (center - width / 2)}%`,
    width: `${100 * width}%`,
    bottom: `max(0%, calc(${100 * (1 - feet)}% - min(3%, 8px)))`,
    height: `${100 * feet * heightAtFeet}%`,
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
/** Dust puffs a landing boss kicks up: [left %, drift as % of the box]. */
const BOSS_DUST: readonly (readonly [number, string])[] = [
  [30, '-40cqw'],
  [40, '-22cqw'],
  [48, '-8cqw'],
  [52, '8cqw'],
  [60, '22cqw'],
  [70, '40cqw'],
];

/**
 * A boss's landing, played once as its entrance ends (index.css, BOSS
 * ENTRANCE): its halo flares around it and dust kicks up at its feet.
 */
const BossLanding = () => (
  <>
    <span className="boss-flare pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[95%] rounded-full bg-[radial-gradient(circle,var(--color-accent-hover)_0%,transparent_62%)] mix-blend-screen" />
    {BOSS_DUST.map(([left, dx]) => (
      <span
        key={left}
        className="boss-dust pointer-events-none absolute bottom-0 aspect-[2/1] w-[22%] rounded-full bg-[radial-gradient(ellipse,rgb(214_200_176/0.7)_0%,transparent_70%)]"
        style={{ left: `${left}%`, ['--dx' as string]: dx }}
      />
    ))}
  </>
);

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
          style={bodyStyleOf(unit, size)}
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
 * A hero summoned or revived mid-fight arrives in a shaft of holy
 * light: it plays once, when the hero first appears.
 */
const ArrivalLight = () => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute inset-x-[15%] -top-[40%] bottom-0 origin-bottom rounded-t-full bg-gradient-to-t from-[#fff4c8] via-[#fff4c8]/60 to-transparent opacity-0 animate-holy-arrival"
  />
);

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
          style={bodyStyleOf(unit, size)}
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

/** Enlarge the foot-anchored figure within its lane, with extra legibility at distance. */
const bodyStyleOf = (unit: HeroUnit, size: HeroSize): CSSProperties => {
  const rowScale = { front: 1.28, back: 1.45, horizon: 1.65 }[unit.row];
  const scale = isDeep(unit)
    ? Math.min(rowScale, 1.2)
    : isBoss(unit)
      ? Math.min(rowScale, 1.3)
      : rowScale;
  const stage = isBoss(unit) ? bossStageOf(unit.heroId) : undefined;
  if (stage) return stagedBodyStyle(stage, scale, size);
  const widthLimit =
    ((isBoss(unit) ? BOSS_OVERSPILL : 1) * 100) / figureAspect(size);
  return {
    height: `min(${100 * scale}cqh, ${widthLimit * scale}cqw)`,
    aspectRatio: figureAspect(size),
  };
};

/**
 * A staged boss (heroLooks, bossStageOf): it grows from its usual height
 * (`scale`) up to its reach, as far as the field's width allows, and
 * sinks by its `forward` share of whatever it grew, so it comes toward
 * the player instead of climbing under its name plate.
 */
const stagedBodyStyle = (
  stage: BossStage,
  scale: number,
  size: HeroSize
): CSSProperties => {
  const widthLimit = (STAGED_BOSS_SPAN * 100) / figureAspect(size);
  const height = `min(${100 * stage.reach}cqh, ${widthLimit}cqw)`;
  const growth = `max(0px, ${height} - ${100 * scale}cqh)`;
  return {
    height,
    aspectRatio: figureAspect(size),
    bottom: `calc(${growth} * ${-stage.forward})`,
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
  player,
  isFocused,
  aim,
  pickMarker,
  action,
  lastHitId,
  isDying = false,
  field,
  onTap,
}: HeroOnFieldProps) => {
  const [arrivalDelay] = useState(() => marchDelayMs(unit));
  if (isDying)
    return isBoss(unit) ? <BossDeath unit={unit} /> : <DyingHero unit={unit} />;
  const hero = getHero(unit.heroId);
  const size = drawSizeOf(unit);
  const focusClass = isFocused
    ? 'drop-shadow-[0_0_10px_var(--color-accent)]'
    : '';
  const bodyStyle = bodyStyleOf(unit, size);
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
      aria-label={`${hero.name}, ${unit.hp} of ${unit.maxHp} HP, ${rowLabel(unit.row)}`}
      className={`pointer-events-auto absolute transition-[left,bottom,width,height,scale,opacity,filter] duration-500 ease-in-out motion-reduce:transition-none ${AIM_CLASS[aim]} ${action ? (LIFT_ACTION_CLASS[action.style] ?? '') : ''}`}
      style={boxStyle(unit)}
      data-aloft={isAloft(unit) ? '' : undefined}
      data-acting={action ? '' : undefined}
    >
      {/* STAGE: holds the unit's lift (index.css, UNIT LIFT), which every
          reason to leave the ground feeds (Aloft, a boss's entrance, a
          spell's rise). The shadow and the body both read it: the body
          climbs, the shadow stays on its spot and shrinks. */}
      <div
        className="unit-stage relative h-full w-full [container-type:size]"
        data-arrival={
          isBoss(unit) ? bossEntranceOf(unit.heroId).arrival : undefined
        }
      >
        <GroundShadow
          unit={unit}
          restStyle={bodyStyle}
          marchDelayMs={arrivalDelay}
        />
        {/* ENTERS ONCE, WHEN THE HERO FIRST APPEARS: A WAVE MARCHES IN, A
            BOSS DESCENDS OR RISES (its entrance, see BossEntrance) */}
        <div
          className={`absolute inset-0 origin-bottom ${isBoss(unit) ? 'boss-arrive' : 'animate-hero-march'}`}
          style={
            isBoss(unit) ? undefined : { animationDelay: `${arrivalDelay}ms` }
          }
        >
          {isBoss(unit) && <BossLanding />}
          <div
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${action ? bodyActionClass(action) : ''}`}
            style={bodyStyle}
          >
            <div
              className="hero-flight relative h-full w-full"
              {...{ [HERO_ANCHOR_ATTR]: true }}
            >
              <div className="hero-step-gait h-full w-full">
                {/* IDLE SWAY: figure and pick mark rock together */}
                <div
                  className="relative h-full w-full origin-bottom animate-hero-sway"
                  style={swayStyle(unit)}
                >
                  <div
                    className={`h-full w-full ${isDeep(unit) ? '' : ROW_TINT_CLASS[unit.row]} ${focusClass} ${aim === 'legal' ? 'animate-pulse' : ''}`}
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
                  <HexAura hex={unit.statuses.hex} />
                  {pickMarker && <PickMark marker={pickMarker} />}
                  {unit.joinedMidFight && <ArrivalLight />}
                </div>
              </div>
              {/* PLATE: outside the sway, so its text never tilts (a tilted,
                scaled-down plate rasterizes blurry) and its chips hold
                still under the finger. */}
              <div
                className="absolute inset-x-0 flex justify-center"
                style={
                  unit.heroId === 'angelArcher'
                    ? { bottom: '82%' }
                    : plateStyle(size)
                }
              >
                <HeroPlate unit={unit} field={field} player={player} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};
