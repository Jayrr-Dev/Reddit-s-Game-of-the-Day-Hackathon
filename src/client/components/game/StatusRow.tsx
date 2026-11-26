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
  tierNumeral,
  OUT_OF_RANGE_INFO,
  PASSIVE_INFO,
  STATUS_INFO,
} from '../../../shared/game/describe';
import {
  incomingAfflictionDamage,
  bleedBiteOf,
  hexAfterTurn,
  hexBurnAmount,
  isEmpoweredHex,
  tierCut,
} from '../../../shared/game/combatant';
import {
  STATUS_IS_AFFLICTION,
  WEAKEN_DAMAGE_FACTOR,
  SHOCK_BURST_FACTOR,
  SHOCK_HITS,
  OUT_OF_RANGE_HIT_CHANCE,
  TIERED_MAX_TIER,
  MALAISE_TURNS,
} from '../../../shared/game/rules';
import type {
  Combatant,
  PassiveId,
  StatusId,
  TimedBuff,
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
import { Chip, TurnsLeft, type ChipProps } from '../ui/Chip';
import { Glyph } from '../ui/Glyph';
import { TintedText } from '../ui/RichText';
import { Tooltip } from '../ui/Tooltip';
import {
  SHOCK_SPLASH,
  shockChargeOf,
  type ShockCharge as Charge,
} from '../../lib/shockStage';
import { ShockCharge } from './ShockCharge';
import { reflexDodgeOf } from '../../../shared/game/skills';

// --- TYPES ---
/** One status as a chip, with its tooltip text. */
type StatusChip = Required<Pick<ChipProps, 'glyph' | 'text' | 'toneClass'>> &
  Pick<ChipProps, 'fill' | 'turnsLeft'> & {
    /** Shock's drop stage, drawn in place of its glyph. */
    shockCharge?: Charge;
    key: StatusId | PassiveId | 'guard' | 'outOfRange';
    title: string;
    description: string;
  };

// --- CONSTANTS ---
/** Statuses whose value is a tier (see TIERED_CUT_BY_TIER). */
const TIERED_STATUSES: ReadonlySet<StatusId> = new Set([
  'protection',
  'enfeeble',
  'instinct',
]);
/**
 * Left to right, grouped by what they do (Guard itself is drawn first):
 * defence, then attack, then magic, then debuffs.
 */
const STATUS_ORDER: readonly StatusId[] = [
  // DEFENCE
  'aloft',
  'instinct',
  'reflex',
  'invincible',
  'protection',
  'reinforce',
  'brace',
  'cloak',
  // ATTACK
  'wrath',
  'might',
  'hone',
  'sharpshooter',
  'berserker',
  'bane',
  'momentum',
  'move',
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
  'malaise',
  'hitLimit',
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
  if (TIERED_STATUSES.has(id)) return tierNumeral(value);
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
const hexChipOf = (hex: number, target: Combatant, source?: Combatant): Partial<StatusChip> => {
  const burn = incomingAfflictionDamage(target, hexBurnAmount(hex, source), source);
  const isPrimed = burn > 0;
  const isTripled = isEmpoweredHex(hex, source);
  if (!isPrimed)
    return {
      description: `Even: no burn this turn, grows to ${hexAfterTurn(hex, source)} (and burns the turn after).`,
    };
  if (isTripled)
    return {
      fill: toneVarOf(STATUS_LOOK.hex),
      // The tripled burn is the big hit: show what it really deals (the
      // unit itself wears a throbbing sigil, see HexAura).
      text: `${hex}\u00d73`,
      description: `${hex % 10 === 6 ? 'Ends in 6' : 'Ends in 3'}: burns for ${burn} (triple) before its next turn, then clears.`,
    };
  return {
    fill: toneVarOf(STATUS_LOOK.hex),
    text: `${hex}\u00d72`,
    description: `Odd: burns for ${burn} (double) before its next turn, then drops to ${hexAfterTurn(hex, source)}.`,
  };
};

/**
 * Shock's chip: its value, with a drop that fills as the hits in a row
 * add up (see ShockCharge). One hit from bursting it is PRIMED: full and
 * pulsing.
 */
const shockChipOf = (combatant: Combatant, source?: Combatant): Partial<StatusChip> => {
  const hits = combatant.shockHits ?? 0;
  const isPrimed = hits >= SHOCK_HITS - 1;
  return {
    shockCharge: shockChargeOf(hits),
    ...(isPrimed
      ? {
          description: `Primed: the next hit bursts it for ${incomingAfflictionDamage(combatant, combatant.statuses.shock * SHOCK_BURST_FACTOR, source)}.`,
        }
      : {}),
  };
};

/** Only the next-action share of a stacked attack buff belongs over the hand. */
const oneUseAmount = (id: StatusId, total: number, buffs: readonly TimedBuff[]) => {
  if (id === 'momentum') return total;
  if (id !== 'hone' && id !== 'might' && id !== 'surge') return 0;
  return Math.min(total, buffs.reduce((sum, buff) =>
    buff.buff === id && buff.duration === 'action' ? sum + buff.amount : sum, 0));
};

type StatusGroup = 'buffs' | 'afflictions' | 'hand';

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
  splashed: number | null,
  group?: StatusGroup,
  timedBuffs: readonly TimedBuff[] = [],
  source?: Combatant
): StatusChip[] => {
  const guard: StatusChip[] =
    group === undefined && combatant.guard > 0
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
  const statuses = STATUS_ORDER.flatMap((id): StatusChip[] => {
    const total = combatant.statuses[id];
    if (!total) return [];
    if (group === 'afflictions' && !STATUS_IS_AFFLICTION[id]) return [];
    if (group === 'buffs' && STATUS_IS_AFFLICTION[id]) return [];
    const handModifier = id === 'momentum' || id === 'sharpshooter' ||
      id === 'weaken' || id === 'reflex' || TIERED_STATUSES.has(id);
    if (handModifier && (group === 'buffs' || group === 'afflictions')) return [];
    const once = oneUseAmount(id, total, timedBuffs);
    const amount = group === 'hand' ? (handModifier ? total : once) : group === 'buffs' ? total - once : total;
    if (amount <= 0) return [];
    const timedTurns = id === 'protection' ? combatant.cardProtectionTurns ?? 0
      : id === 'enfeeble' ? combatant.enfeebleTurns ?? 0
      : id === 'instinct' ? combatant.instinctTurns ?? 0 : 0;
    // TURNS LEFT: timed tiers count down; card Protection and Reflex last until the unit's next turn.
    const turnsLeft = timedTurns > 0 ? timedTurns
      : id === 'protection' || id === 'reflex' ? 1 : undefined;
    const durationText = timedTurns > 0
      ? timedTurns + (timedTurns === 1 ? ' enemy turn left.' : ' enemy turns left.')
      : id === 'protection' ? 'Expires when this unit next starts its turn.' : '';
    return [{
      ...(turnsLeft !== undefined && { turnsLeft }),
      key: id,
      ...STATUS_LOOK[id],
      text: id === 'reflex' ? `+${Math.round(reflexDodgeOf(combatant) * 100)}%`
        : group === 'hand' && (id === 'weaken' || TIERED_STATUSES.has(id))
        ? `${id === 'instinct' ? '+' : '-'}${Math.round(100 * (id === 'weaken' ? 1 - WEAKEN_DAMAGE_FACTOR : tierCut(amount)))}%`
        : chipText(id, amount),
      title: id === 'instinct' && amount === TIERED_MAX_TIER ? 'Ultra Instinct' : STATUS_INFO[id].label,
      description: TIERED_STATUSES.has(id)
        ? [
            `Tier ${tierNumeral(amount)}: **${Math.round(100 * tierCut(amount))}%** ${id === 'protection'
              ? 'less hit and affliction damage.' : id === 'enfeeble'
                ? 'less attack damage dealt.' : 'dodge chance. Hex cannot be dodged.'}`,
            ...(durationText ? [durationText] : []),
            ...(amount === TIERED_MAX_TIER ? [`On expiry: **Malaise ${MALAISE_TURNS}**.`] : []),
          ].join('\n')
        : id === 'malaise'
          ? `Cannot use Buff cards or buff moves for ${total} more ${total === 1 ? 'turn' : 'turns'}.`
          : id === 'cloak'
          ? `Untargetable for ${total} more enemy ${total === 1 ? 'turn' : 'turns'} or until attacking. Area effects and existing afflictions still apply.`
          : STATUS_INFO[id].description + (group === 'hand' && !handModifier ? ' Expires after your next card.' : ''),
      ...(id === 'hex' ? hexChipOf(total, combatant, source) : {}),
      ...(id === 'shock' ? shockChipOf(combatant, source) : {}),
      ...(id === 'poison' ? {description: `Deals ${incomingAfflictionDamage(combatant, total, source)} damage before each action, then loses 1 stack.`} : {}),
      ...(id === 'burn' ? {description: `Deals ${incomingAfflictionDamage(combatant, total, source)} damage after each action, then halves (rounded down).`} : {}),
      ...(id === 'bleed' ? {description: `A successful Melee or Range attack deals ${incomingAfflictionDamage(combatant, bleedBiteOf(total), source)} bonus damage, then Bleed loses 1 stack.`} : {}),
    }];
  });
  const splash =
    (group === undefined || group === 'afflictions') && splashed !== null && combatant.statuses.shock === 0
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
    turnsLeft={chip.turnsLeft}
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
            turnsLeft={chip.turnsLeft}
            icon={chipIconOf(chip)}
            shape="square"
          />
        </span>
        <p className="text-[11px] leading-snug text-ink-muted">
          <span className="font-semibold text-ink">{chip.title}. </span>
          <TintedText text={chip.description} />
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
/** Enemy plates use equal-size tiles so the counts line up across rows. */
const ENEMY_COLUMNS = 4;
const ENEMY_VISIBLE_TILES = ENEMY_COLUMNS * 3;

export const EnemyStatuses = ({
  combatant, passives, isOutOfRange, source,
}: {
  combatant: Combatant;
  source: Combatant;
  passives: readonly PassiveId[];
  isOutOfRange: boolean;
}) => {
  const splashed = useShockSplash(combatant);
  const chips = [
    ...(isOutOfRange ? [OUT_OF_RANGE_CHIP] : []),
    ...passiveChipsOf(passives),
    ...statusChipsOf(combatant, splashed, undefined, [], source),
  ];
  if (!chips.length) return null;
  const shown = chips.length > ENEMY_VISIBLE_TILES
    ? chips.slice(0, ENEMY_VISIBLE_TILES - 1)
    : chips;
  return (
    <div
      role="group"
      aria-label="Enemy effects"
        dir="rtl"
      className="enemy-status-grid grid shrink-0 justify-items-stretch gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${Math.min(chips.length, ENEMY_COLUMNS)}, 1.5rem)` }}
    >
      {shown.map(chip => (
        <Tooltip key={chip.key} opensOn="click" content={{title: chip.title, description: chip.description}}>
          <button type="button" aria-label={([chip.title, chip.text].join(' ').trim()) + (chip.turnsLeft !== undefined ? ', ' + chip.turnsLeft + (chip.turnsLeft === 1 ? ' turn left' : ' turns left') : '')}
            className={`relative grid size-6 cursor-pointer place-items-center rounded-[3px] bg-surface-sunken ring-1 ring-edge focus-visible:outline-2 focus-visible:outline-accent ${chip.fill ? 'text-black' : chip.toneClass}`}
            style={{backgroundColor: chip.fill}}>
            <span className={chip.turnsLeft !== undefined ? 'translate-x-0.5 translate-y-0.5' : chip.text ? '-translate-x-0.5 -translate-y-0.5' : ''}>
              {chipIconOf(chip) ?? <Glyph name={chip.glyph} className="size-4" />}
            </span>
            {chip.text && <span className="absolute right-0 bottom-0 rounded-tl-sm bg-black/90 px-px text-[10px] leading-none font-bold tabular-nums text-white">{chip.text}</span>}
            {chip.turnsLeft !== undefined && <TurnsLeft turns={chip.turnsLeft} placement="corner" />}
          </button>
        </Tooltip>
      ))}
      {shown.length < chips.length && <OverflowChip all={chips} hidden={chips.slice(shown.length)} />}
    </div>
  );
};

/** How the chips sit in their space. */
const ALIGN_CLASS = { start: 'justify-start', center: 'justify-center', end: 'justify-end' } as const;

/**
 * Shows the statuses above zero in up to `rows` wrapping lines, as many as fit the space it
 * is given; any that don't fit fold into an overflow chip. The space's
 * natural width is the whole row's (the measure row sets it), so a
 * layout that has room gives it all.
 */
export const StatusRow = ({
  combatant,
  group,
  timedBuffs,
  align = 'center',
  rows = 1,
}: {
  combatant: Combatant;
  group?: StatusGroup;
  timedBuffs?: readonly TimedBuff[];
  align?: keyof typeof ALIGN_CLASS;
  /** Lines the chips may wrap onto before folding into +N. */
  rows?: number;
}) => {
  const splashed = useShockSplash(combatant);
  const chips = statusChipsOf(combatant, splashed, group, timedBuffs);
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
            turnsLeft={chip.turnsLeft}
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
      <div className={`flex min-h-5 flex-wrap gap-1 ${ALIGN_CLASS[align]} ${group === 'hand' && chips.length ? 'hand-damage-modifiers' : ''}`}>
        {shown.map((chip) => (
          <StatusChipView key={chip.key} chip={chip} />
        ))}
        {isOverflowing && <OverflowChip hidden={hidden} all={chips} />}
      </div>
    </div>
  );
};
