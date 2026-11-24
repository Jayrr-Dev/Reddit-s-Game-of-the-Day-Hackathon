// ===================================================================
// STATUS ROW
// A boss's passives (gold), then Guard and any active statuses on a
// combatant, as square chips
// (intents are round, so effects in play read apart from what's coming).
// Up to `rows` lines of chips (wrapping), as many as fit the space it
// is given (measured live, see useFitCount); only once the last line is
// full do the rest fold into an overflow chip ("[icon] +N", the icon of
// the first hidden status). Tapping it opens a popover
// listing every status with what it does.
// ===================================================================

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  OUT_OF_RANGE_INFO,
  PASSIVE_INFO,
  SHARPSHOOTER_BONUS_TEXT,
  STATUS_INFO,
} from '../../../shared/game/describe';
import { dodgeChanceOf } from '../../../shared/game/combat';
import {
  hexAfterTurn,
  hexBurnAmount,
  isEmpoweredHex,
} from '../../../shared/game/combatant';
import {
  SHOCK_BURST_FACTOR,
  SHOCK_HITS,
  OUT_OF_RANGE_HIT_CHANCE,
} from '../../../shared/game/rules';
import type {
  Combatant,
  PassiveId,
  StatusId,
} from '../../../shared/game/types';
import {
  OUT_OF_RANGE_LOOK,
  PASSIVE_LOOK,
  STATUS_LOOK,
  toneVarOf,
} from '../../content/visuals';
import {
  placeFloating,
  type FloatingPlacement,
} from '../../lib/floatingPlacement';
import { useFitCount } from '../../hooks/useFitCount';
import { useShockSplash } from '../../hooks/useShockSplash';
import { Chip, type ChipProps } from '../ui/Chip';
import {
  SHOCK_SPLASH,
  shockChargeOf,
  type ShockCharge as Charge,
} from '../../lib/shockStage';
import { ShockCharge } from './ShockCharge';

// --- TYPES ---
/** One status as a chip, with its tooltip text. */
type StatusChip = Required<Pick<ChipProps, 'glyph' | 'text' | 'toneClass'>> &
  Pick<ChipProps, 'fill'> & {
    /** Shock's drop stage, drawn in place of its glyph. */
    shockCharge?: Charge;
    key: StatusId | PassiveId | 'guard' | 'outOfRange';
    title: string;
    description: string;
  };

// --- CONSTANTS ---
/** A tiered status's tier as its chip shows it (index = tier). */
const TIER_NUMERALS = ['', 'I', 'II', 'III'] as const;
/** Statuses whose value is a tier (see TIERED_CUT_BY_TIER). */
const TIERED_STATUSES: ReadonlySet<StatusId> = new Set([
  'protection',
  'enfeeble',
]);
/**
 * Left to right, grouped by what they do (Guard itself is drawn first):
 * defence, then attack, then magic, then debuffs.
 */
const STATUS_ORDER: readonly StatusId[] = [
  // DEFENCE
  'aloft',
  'instinct',
  'protection',
  'reinforce',
  'brace',
  // ATTACK
  'wrath',
  'might',
  'hone',
  'sharpshooter',
  'berserker',
  'bane',
  'momentum',
  'rush',
  'armor',
  // MAGIC
  'surge',
  // DEBUFFS
  'hex',
  'poison',
  'burn',
  'frost',
  'shock',
  'bleed',
  'weaken',
  'vex',
  'enfeeble',
];

/** The popover's width (px), and the room it needs to open upward. */
const POPOVER_WIDTH = 230;
const POPOVER_MIN_ROOM_ABOVE = 200;

// --- HELPERS ---
/**
 * What a chip says: its stacks, except Momentum (a boost) and Aloft
 * (on or off, so the wing says it all).
 */
const chipText = (id: StatusId, value: number): string => {
  if (id === 'momentum') return '+50%';
  if (id === 'sharpshooter') return SHARPSHOOTER_BONUS_TEXT;
  if (id === 'instinct') return `${Math.round(dodgeChanceOf(value) * 100)}%`;
  if (TIERED_STATUSES.has(id)) return TIER_NUMERALS[value] ?? '';
  return id === 'aloft' ? '' : String(value);
};

/** A boss's passives as gold chips (always on, so they come first). */
const passiveChipsOf = (passives: readonly PassiveId[]): StatusChip[] =>
  passives.map((id) => ({
    key: id,
    ...PASSIVE_LOOK[id],
    fill: toneVarOf(PASSIVE_LOOK[id]),
    title: PASSIVE_INFO[id].label,
    description: PASSIVE_INFO[id].description,
  }));

/** The Out of Range chip: the chance a shot lands, e.g. "50%". */
const OUT_OF_RANGE_CHIP: StatusChip = {
  key: 'outOfRange',
  ...OUT_OF_RANGE_LOOK,
  text: `${Math.round(OUT_OF_RANGE_HIT_CHANCE * 100)}%`,
  title: OUT_OF_RANGE_INFO.label,
  description: OUT_OF_RANGE_INFO.description,
};

/**
 * Hex fires only on odd counts, so its chip says which turn this is:
 * odd, it is PRIMED (a solid purple tile: it burns before the next
 * turn); even, it is a plain dark tile and the tooltip says it waits.
 * Adding a stack flips it, which is the choice: burst now or hold.
 * Odd, it burns double; odd and ending in 3, triple: the chip says x3.
 */
const hexChipOf = (hex: number): Partial<StatusChip> => {
  const burn = hexBurnAmount(hex);
  const isPrimed = burn > 0;
  const isTripled = isEmpoweredHex(hex);
  if (!isPrimed)
    return {
      description: `Even: no burn this turn, grows to ${hexAfterTurn(hex)} (and burns the turn after).`,
    };
  if (isTripled)
    return {
      fill: toneVarOf(STATUS_LOOK.hex),
      // The tripled burn is the big hit: show what it really deals (the
      // unit itself wears a throbbing sigil, see HexAura).
      text: `${hex}\u00d73`,
      description: `Ends in 3: burns for ${burn} (triple) before its next turn, then clears.`,
    };
  return {
    fill: toneVarOf(STATUS_LOOK.hex),
    description: `Odd: burns for ${burn} (double) before its next turn, then drops to ${hexAfterTurn(hex)}.`,
  };
};

/**
 * Shock's chip: its value, with a drop that fills as the hits in a row
 * add up (see ShockCharge). One hit from bursting it is PRIMED: full and
 * pulsing.
 */
const shockChipOf = (combatant: Combatant): Partial<StatusChip> => {
  const hits = combatant.shockHits ?? 0;
  const isPrimed = hits >= SHOCK_HITS - 1;
  return {
    shockCharge: shockChargeOf(hits),
    ...(isPrimed
      ? {
          description: `Primed: the next hit bursts it for ${combatant.statuses.shock * SHOCK_BURST_FACTOR}.`,
        }
      : {}),
  };
};

/** The chip a burst Shock leaves for a moment: its drop splashing. */
const splashChipOf = (value: number): StatusChip => ({
  key: 'shock',
  ...STATUS_LOOK.shock,
  text: String(value),
  title: STATUS_INFO.shock.label,
  description: `Burst for ${value}.`,
  shockCharge: SHOCK_SPLASH,
});

/** A chip's own drawing in place of its glyph, if it has one. */
const chipIconOf = (chip: StatusChip) =>
  chip.shockCharge ? <ShockCharge charge={chip.shockCharge} /> : undefined;

/**
 * Every active effect on a combatant as chips, Guard first; `splashed`
 * adds a Shock that just burst, splashing (see useShockSplash).
 */
const statusChipsOf = (
  combatant: Combatant,
  splashed: number | null
): StatusChip[] => {
  const guard: StatusChip[] =
    combatant.guard > 0
      ? [
          {
            key: 'guard',
            ...STATUS_LOOK.guard,
            text: String(combatant.guard),
            title: STATUS_INFO.guard.label,
            description: STATUS_INFO.guard.description,
          },
        ]
      : [];
  const statuses = STATUS_ORDER.filter((id) => combatant.statuses[id] > 0).map(
    (id): StatusChip => ({
      key: id,
      ...STATUS_LOOK[id],
      text: chipText(id, combatant.statuses[id]),
      title: STATUS_INFO[id].label,
      description: STATUS_INFO[id].description,
      ...(id === 'hex' ? hexChipOf(combatant.statuses[id]) : {}),
      ...(id === 'shock' ? shockChipOf(combatant) : {}),
    })
  );
  const splash =
    splashed !== null && combatant.statuses.shock === 0
      ? [splashChipOf(splashed)]
      : [];
  return [...guard, ...statuses, ...splash];
};

/** A chip with its tooltip. */
const StatusChipView = ({ chip }: { chip: StatusChip }) => (
  <Chip
    glyph={chip.glyph}
    text={chip.text}
    toneClass={chip.toneClass}
    fill={chip.fill}
    icon={chipIconOf(chip)}
    shape="square"
    info={{ title: chip.title, description: chip.description }}
  />
);

// --- SUBCOMPONENTS ---
/** The popover: every status, its chip, name and what it does. */
const StatusPopover = ({
  chips,
  placement,
}: {
  chips: readonly StatusChip[];
  placement: FloatingPlacement;
}) => (
  <div
    role="dialog"
    aria-label="All effects"
    className={`fixed z-[100] flex flex-col gap-1.5 rounded-md border border-edge bg-surface-raised p-2 shadow-[0_6px_18px_rgb(0_0_0/0.5)] animate-tooltip-in ${placement.isAbove ? '-translate-y-full' : ''}`}
    style={{ left: placement.left, top: placement.top, width: POPOVER_WIDTH }}
    onPointerDown={(event) => event.stopPropagation()}
  >
    {chips.map((chip) => (
      <div key={chip.key} className="flex items-start gap-2">
        <span className="shrink-0 pt-0.5">
          <Chip
            glyph={chip.glyph}
            text={chip.text}
            toneClass={chip.toneClass}
            fill={chip.fill}
            icon={chipIconOf(chip)}
            shape="square"
          />
        </span>
        <p className="text-[11px] leading-snug text-ink-muted">
          <span className="font-semibold text-ink">{chip.title}. </span>
          {chip.description}
        </p>
      </div>
    ))}
  </div>
);

/**
 * The "+N" chip that stands in for the hidden statuses. Not a <button>:
 * hero plates sit inside the hero's own button. Its click is kept from
 * reaching the hero, so opening it never aims a card.
 */
const OverflowChip = ({
  hidden,
  all,
}: {
  hidden: readonly StatusChip[];
  all: readonly StatusChip[];
}) => {
  const [placement, setPlacement] = useState<FloatingPlacement | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const first = hidden[0];

  // CLOSE ON ANY PRESS OUTSIDE (the popover stops its own presses)
  useEffect(() => {
    if (!placement) return;
    const close = () => setPlacement(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [placement]);

  /** Opens the popover over the chip, or closes it if open. */
  const toggle = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (placement || !rect) return setPlacement(null);
    setPlacement(placeFloating(rect, POPOVER_WIDTH, POPOVER_MIN_ROOM_ABOVE));
  };

  if (!first) return null;
  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={`${hidden.length} more effects`}
        aria-expanded={placement !== null}
        onClick={toggle}
        onKeyDown={(event) => event.key === 'Enter' && toggle(event)}
        onPointerDown={(event) => event.stopPropagation()}
        className="pointer-events-auto inline-flex cursor-pointer"
      >
        <Chip
          glyph={first.glyph}
          text={`+${hidden.length}`}
          toneClass="text-ink"
          shape="square"
        />
      </span>
      {placement &&
        createPortal(
          <StatusPopover chips={all} placement={placement} />,
          document.body
        )}
    </>
  );
};

// --- COMPONENT ---
/** How the chips sit in their space. */
const ALIGN_CLASS = { center: 'justify-center', end: 'justify-end' } as const;

/**
 * Shows the statuses above zero in up to `rows` wrapping lines, as many as fit the space it
 * is given; any that don't fit fold into an overflow chip. The space's
 * natural width is the whole row's (the measure row sets it), so a
 * layout that has room gives it all.
 */
export const StatusRow = ({
  combatant,
  passives = [],
  isOutOfRange = false,
  align = 'center',
  rows = 1,
}: {
  combatant: Combatant;
  /** True for a hero in Out of Range (its first chip says so). */
  isOutOfRange?: boolean;
  /** A boss's passives, drawn first as gold chips. */
  passives?: readonly PassiveId[];
  align?: keyof typeof ALIGN_CLASS;
  /** Lines the chips may wrap onto before folding into +N. */
  rows?: number;
}) => {
  const splashed = useShockSplash(combatant);
  const chips = [
    ...(isOutOfRange ? [OUT_OF_RANGE_CHIP] : []),
    ...passiveChipsOf(passives),
    ...statusChipsOf(combatant, splashed),
  ];
  const { spaceRef, measureRef, overflowRef, fitCount } = useFitCount(
    chips.length,
    rows
  );
  const isOverflowing = fitCount < chips.length;
  const shown = chips.slice(0, fitCount);
  const hidden = chips.slice(fitCount);

  return (
    <div ref={spaceRef} className="relative w-full min-w-0 max-w-max">
      {/* MEASURE ROW: every chip, invisible and zero-height */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="invisible flex h-0 flex-nowrap gap-1 overflow-hidden"
      >
        {chips.map((chip) => (
          <Chip
            key={chip.key}
            glyph={chip.glyph}
            text={chip.text}
            toneClass={chip.toneClass}
            fill={chip.fill}
            icon={chipIconOf(chip)}
            shape="square"
          />
        ))}
      </div>
      <span
        ref={overflowRef}
        aria-hidden="true"
        className="invisible absolute left-0 top-0"
      >
        <Chip glyph="eye" text="+9" toneClass="text-ink" shape="square" />
      </span>
      <div className={`flex min-h-5 flex-wrap gap-1 ${ALIGN_CLASS[align]}`}>
        {shown.map((chip) => (
          <StatusChipView key={chip.key} chip={chip} />
        ))}
        {isOverflowing && <OverflowChip hidden={hidden} all={chips} />}
      </div>
    </div>
  );
};
