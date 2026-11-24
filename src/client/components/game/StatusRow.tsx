// ===================================================================
// STATUS ROW
// Shroud plus any active statuses on a combatant, as square chips
// (intents are round, so effects in play read apart from what's coming).
// Always one row: past `maxChips`, the last slot becomes an overflow
// chip ("[icon] +N", the icon of the first hidden status). Tapping it
// opens a popover listing every status with what it does.
// ===================================================================

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { STATUS_INFO } from '../../../shared/game/describe';
import type { Combatant, StatusId } from '../../../shared/game/types';
import { STATUS_LOOK } from '../../content/visuals';
import {
  placeFloating,
  type FloatingPlacement,
} from '../../lib/floatingPlacement';
import { Chip, type ChipProps } from '../ui/Chip';

// --- TYPES ---
/** One status as a chip, with its tooltip text. */
type StatusChip = Required<Pick<ChipProps, 'glyph' | 'text' | 'toneClass'>> & {
  key: StatusId | 'shroud';
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
  'dread',
];

/** The popover's width (px), and the room it needs to open upward. */
const POPOVER_WIDTH = 230;
const POPOVER_MIN_ROOM_ABOVE = 200;

// --- HELPERS ---
/** What a chip says: its stacks, except Momentum, which is a boost. */
const chipText = (id: StatusId, value: number): string =>
  id === 'momentum' ? '+50%' : String(value);

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
/**
 * Shows the statuses above zero in one row of at most `maxChips` chips;
 * any that don't fit fold into an overflow chip.
 */
export const StatusRow = ({
  combatant,
  maxChips,
}: {
  combatant: Combatant;
  maxChips: number;
}) => {
  const chips = statusChipsOf(combatant);
  if (chips.length === 0) return <div className="h-5" />;
  const isOverflowing = chips.length > maxChips;
  // The overflow chip takes the last slot, so the row never grows.
  const shown = isOverflowing ? chips.slice(0, maxChips - 1) : chips;
  const hidden = isOverflowing ? chips.slice(maxChips - 1) : [];

  return (
    <div className="flex h-5 flex-nowrap justify-center gap-1">
      {shown.map((chip) => (
        <StatusChipView key={chip.key} chip={chip} />
      ))}
      {isOverflowing && <OverflowChip hidden={hidden} all={chips} />}
    </div>
  );
};
