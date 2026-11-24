// ===================================================================
// STATUS ROW
// A boss's passives (gold), then Shroud and any active statuses on a
// combatant, as square chips
// (intents are round, so effects in play read apart from what's coming).
// Always one row, as many chips as fit the space it is given (measured
// live, see useFitCount); the rest fold into an overflow chip ("[icon]
// +N", the icon of the first hidden status). Tapping it opens a popover
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
import { PASSIVE_INFO, STATUS_INFO } from '../../../shared/game/describe';
import type {
  Combatant,
  PassiveId,
  StatusId,
} from '../../../shared/game/types';
import { PASSIVE_LOOK, STATUS_LOOK, toneVarOf } from '../../content/visuals';
import {
  placeFloating,
  type FloatingPlacement,
} from '../../lib/floatingPlacement';
import { useFitCount } from '../../hooks/useFitCount';
import { Chip, type ChipProps } from '../ui/Chip';

// --- TYPES ---
/** One status as a chip, with its tooltip text. */
type StatusChip = Required<Pick<ChipProps, 'glyph' | 'text' | 'toneClass'>> &
  Pick<ChipProps, 'fill'> & {
    key: StatusId | PassiveId | 'shroud';
    title: string;
    description: string;
  };

// --- CONSTANTS ---
/**
 * Left to right, grouped by what they do (Guard itself is drawn first):
 * defence, then attack, then magic, then debuffs.
 */
const STATUS_ORDER: readonly StatusId[] = [
  // DEFENCE
  'aloft',
  'protection',
  // ATTACK
  'wrath',
  'might',
  'piercing',
  'momentum',
  // MAGIC
  'surge',
  // DEBUFFS
  'hex',
  'poison',
  'burn',
  'frost',
  'dread',
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

/**
 * Hex fires only on odd counts, so its chip says which turn this is:
 * odd, it is PRIMED (a solid purple tile: it burns before the next
 * turn); even, it is a plain dark tile and the tooltip says it waits.
 * Adding a stack flips it, which is the choice: burst now or hold.
 */
const hexChipOf = (hex: number): Partial<StatusChip> => {
  const isPrimed = hex % 2 === 1;
  return isPrimed
    ? {
        fill: toneVarOf(STATUS_LOOK.hex),
        description: `Odd: burns for ${hex} before its next turn, then +1.`,
      }
    : {
        description: `Even: no burn this turn, just +1 (burns for ${hex + 1} the turn after).`,
      };
};

/** Every active effect on a combatant as chips, Guard first. */
const statusChipsOf = (combatant: Combatant): StatusChip[] => {
  const shroud: StatusChip[] =
    combatant.shroud > 0
      ? [
          {
            key: 'shroud',
            ...STATUS_LOOK.shroud,
            text: String(combatant.shroud),
            title: STATUS_INFO.shroud.label,
            description: STATUS_INFO.shroud.description,
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
    })
  );
  return [...shroud, ...statuses];
};

/** A chip with its tooltip. */
const StatusChipView = ({ chip }: { chip: StatusChip }) => (
  <Chip
    glyph={chip.glyph}
    text={chip.text}
    toneClass={chip.toneClass}
    fill={chip.fill}
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
 * Shows the statuses above zero in one row, as many as fit the space it
 * is given; any that don't fit fold into an overflow chip. The space's
 * natural width is the whole row's (the measure row sets it), so a
 * layout that has room gives it all.
 */
export const StatusRow = ({
  combatant,
  passives = [],
  align = 'center',
}: {
  combatant: Combatant;
  /** A boss's passives, drawn first as gold chips. */
  passives?: readonly PassiveId[];
  align?: keyof typeof ALIGN_CLASS;
}) => {
  const chips = [...passiveChipsOf(passives), ...statusChipsOf(combatant)];
  const { spaceRef, measureRef, overflowRef, fitCount } = useFitCount(
    chips.length
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
      <div className={`flex h-5 flex-nowrap gap-1 ${ALIGN_CLASS[align]}`}>
        {shown.map((chip) => (
          <StatusChipView key={chip.key} chip={chip} />
        ))}
        {isOverflowing && <OverflowChip hidden={hidden} all={chips} />}
      </div>
    </div>
  );
};
