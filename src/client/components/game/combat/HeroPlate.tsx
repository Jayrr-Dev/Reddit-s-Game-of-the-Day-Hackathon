// ===================================================================
// HERO PLATE
// The health plate that floats above every hero on the battlefield:
//   name                      (top left)
//   ====[ HP ]====            drain bar, the number in a centre shield
//   intent chips   statuses   (under the bar: next move left, statuses right)
// Each hero gets its own plate, so the whole horde reads at a glance.
// The plate grows with the hero: it spans the hero's columns, and a big
// hero (size 3, a champion) gets a bigger shield and bar than a small
// one. Back-row plates are drawn smaller again to match their depth.
// ===================================================================

import { describeHeroIntent } from '../../../../shared/game/describe';
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

/** A boss's name: always gold, with a thin black outline. */
const BOSS_NAME_CLASS =
  'text-accent [paint-order:stroke_fill] [-webkit-text-stroke:2px_black]';

// --- SUBCOMPONENTS ---
/** The hero's next move as small chips. */
export const IntentChips = ({
  unit,
  field,
}: {
  unit: HeroUnit;
  field: readonly HeroUnit[];
}) => {
  const { name, intents } = describeHeroIntent(unit, field);
  return (
    <div className="flex flex-nowrap items-center gap-0.5">
      {intents.map((intent, index) => (
        <Chip
          key={`${intent.kind}-${index}`}
          {...INTENT_LOOK[intent.kind]}
          text={intent.text}
          info={{ title: intent.label, description: `Next move: ${name}` }}
        />
      ))}
    </div>
  );
};

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
      style={{ width: look.width, maxWidth: look.maxWidth }}
    >
      <span
        className={`truncate px-1 text-left font-display font-bold ${look.name} uppercase leading-none tracking-wider drop-shadow ${nameClass}`}
      >
        {getHero(unit.heroId).name}
      </span>
      <DrainBar hp={unit.hp} maxHp={unit.maxHp} size="small" />
      {/* ONE ROW OF CHIPS: never wraps (a second row would push the plate
          up under the top bar). Drawn at 80%, so laid out 125% wide to
          span the plate; statuses take what the intents leave and fold
          the rest into "+N". */}
      <div className="flex w-[125%] origin-top scale-[0.8] items-start gap-1 self-center">
        <div className="shrink-0">
          <IntentChips unit={unit} field={field} />
        </div>
        <div className="min-w-0 flex-1">
          <StatusRow combatant={unit} align="end" />
        </div>
      </div>
    </div>
  );
};
