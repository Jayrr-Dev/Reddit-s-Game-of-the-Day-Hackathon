// ===================================================================
// HERO PLATE
// The health plate that floats above every hero on the battlefield:
//   name                      (top left)
//   ====[ HP ]====            drain bar, the number in a centre shield
//   intent chips   statuses   (under the bar: next move left on white
//                              pills, statuses right on dark tiles)
// Each hero gets its own plate, so the whole horde reads at a glance.
// The plate grows with the hero: it spans the hero's columns, and a big
// hero (size 3, a champion) gets a bigger shield and bar than a small
// one. Back-row plates are drawn smaller again to match their depth.
// ===================================================================

import {
  describeHeroIntent,
  type MoveIntent,
} from '../../../../shared/game/describe';
import { getHero } from '../../../../shared/game/heroes';
import type { HeroSize, HeroUnit } from '../../../../shared/game/types';
import { drawSizeOf } from '../../../content/heroLooks';
import { INTENT_LOOK } from '../../../content/visuals';
import { Chip } from '../../ui/Chip';
import { StatusRow } from '../StatusRow';
import { PLATE_UID_ATTR } from '../../../hooks/usePlateSpacing';
import { DrainBar } from './DrainBar';

// --- TYPES ---
export type HeroPlateProps = {
  unit: HeroUnit;
  /** Every hero on the field (the plan shown depends on them). */
  field: readonly HeroUnit[];
  isFocused: boolean;
};

// --- CONSTANTS ---
/**
 * Plate proportions per hero size: the name class, and the plate width as a share of the hero's box (cqw = 1% of that box),
 * capped so only big heroes get a long bar on wide screens.
 */
const PLATE_LOOK: Record<
  HeroSize,
  { name: string; width: string; maxWidth: string }
> = {
  1: {
    name: 'text-[9px]',
    width: '85cqw',
    maxWidth: '7.5rem',
  },
  2: {
    name: 'text-[10px]',
    width: '80cqw',
    maxWidth: '11rem',
  },
  3: {
    name: 'text-xs',
    width: '78cqw',
    maxWidth: '16rem',
  },
};

/**
 * A boss's plate is kept narrower than a champion's, so the plates of
 * the heroes at its back flanks sit beside it instead of being lifted
 * over it (into the top bar).
 */
const BOSS_PLATE_MAX_WIDTH = '12rem';

/** A boss's name: always gold, with a thin black outline. */
const BOSS_NAME_CLASS =
  'text-accent [paint-order:stroke_fill] [-webkit-text-stroke:2px_black]';

// --- SUBCOMPONENTS ---
/** A signature move's arrow is gold, whatever it does. */
const SIGNATURE_FILL = 'var(--color-accent)';

/**
 * One planned move as ONE arrow: its first effect sets the colour and
 * leads, the rest follow inside it (Guard 6 | Wrath +1 is one action).
 */
const MoveArrow = ({ move }: { move: MoveIntent }) => {
  const [lead, ...rest] = move.intents;
  if (!lead) return null;
  return (
    <Chip
      {...INTENT_LOOK[lead.kind]}
      {...(move.isSignature ? { fill: SIGNATURE_FILL } : {})}
      text={lead.text}
      extras={rest.map((intent) => ({
        glyph: INTENT_LOOK[intent.kind].glyph,
        text: intent.text,
      }))}
      info={{
        title: move.name,
        description: move.intents.map((intent) => intent.label).join('. '),
      }}
    />
  );
};

/**
 * The hero's next moves, one arrow per move: one for most heroes, two
 * for the dragon, which acts twice a turn.
 */
export const IntentChips = ({
  unit,
  field,
}: {
  unit: HeroUnit;
  field: readonly HeroUnit[];
}) => (
  <div className="flex flex-nowrap items-center gap-0.5">
    {describeHeroIntent(unit, field).moves.map((move, index) => (
      <MoveArrow key={`${move.name}-${index}`} move={move} />
    ))}
  </div>
);

// --- COMPONENT ---
/** Renders one hero's plate; the focused hero's name is lit gold. */
export const HeroPlate = ({ unit, field, isFocused }: HeroPlateProps) => {
  const look = PLATE_LOOK[drawSizeOf(unit)];
  const isBoss = getHero(unit.heroId).tier === 'boss';
  const nameClass = isBoss
    ? BOSS_NAME_CLASS
    : isFocused
      ? 'text-accent'
      : 'text-ink';
  const scaleClass = unit.row === 'back' ? 'scale-[0.8]' : '';
  return (
    <div
      {...{ [PLATE_UID_ATTR]: unit.uid }}
      className={`pointer-events-none flex origin-bottom flex-col gap-1.5 ${scaleClass}`}
      style={{
        width: look.width,
        maxWidth: isBoss ? BOSS_PLATE_MAX_WIDTH : look.maxWidth,
      }}
    >
      <span
        className={`truncate px-1 text-left font-display font-bold ${look.name} uppercase leading-none tracking-wider drop-shadow ${nameClass}`}
      >
        {getHero(unit.heroId).name}
      </span>
      <DrainBar hp={unit.hp} maxHp={unit.maxHp} size="small" />
      {/* ONE ROW OF CHIPS: never wraps (a second row would push the plate
          up under the top bar). Drawn at 80%, so laid out 125% wide to
          span the plate; intents sit flush left under the bar's left
          end, statuses flush right under its right end, and statuses
          take what the intents leave, folding the rest into "+N". */}
      <div className="flex w-[125%] origin-top scale-[0.8] items-start justify-between gap-2.5 self-center">
        <div className="shrink-0">
          <IntentChips unit={unit} field={field} />
        </div>
        {/* Flush right: the row itself shrinks to its chips (max-w-max). */}
        <div className="flex min-w-0 flex-1 justify-end">
          <StatusRow combatant={unit} align="end" />
        </div>
      </div>
    </div>
  );
};
