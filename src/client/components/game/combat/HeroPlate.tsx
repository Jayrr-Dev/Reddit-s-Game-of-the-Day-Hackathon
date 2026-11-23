// ===================================================================
// HERO PLATE
// The health plate that floats above every hero on the battlefield:
//   name                      (top left)
//   ====[ HP ]====            long HP bar, the number in a centre shield
//   intent chips   statuses   (under the bar: next move left, statuses right)
// Each hero gets its own plate, so the whole horde reads at a glance.
// The plate grows with the hero: it spans the hero's columns, and a big
// hero (size 3, a champion) gets a bigger shield and bar than a small
// one. Back-row plates are drawn smaller again to match their depth.
// ===================================================================

import { describeHeroIntent } from '../../../../shared/game/describe';
import { getHero } from '../../../../shared/game/heroes';
import { sizeOf } from '../../../../shared/game/battlefield';
import type { HeroSize, HeroUnit } from '../../../../shared/game/types';
import { INTENT_LOOK } from '../../../content/visuals';
import { Chip } from '../../ui/Chip';
import { StatusRow } from '../StatusRow';

// --- TYPES ---
export type HeroPlateProps = {
  unit: HeroUnit;
  isFocused: boolean;
};

// --- CONSTANTS ---
/**
 * Plate proportions per hero size: bar, shield and name classes, and the
 * plate width as a share of the hero's box (cqw = 1% of that box),
 * capped so only big heroes get a long bar on wide screens.
 */
const PLATE_LOOK: Record<
  HeroSize,
  { bar: string; shield: string; name: string; width: string; maxWidth: string }
> = {
  1: {
    bar: 'h-1.5',
    shield: 'h-5 w-7 text-[10px]',
    name: 'text-[9px]',
    width: '85cqw',
    maxWidth: '7.5rem',
  },
  2: {
    bar: 'h-2',
    shield: 'h-6 w-9 text-xs',
    name: 'text-[10px]',
    width: '80cqw',
    maxWidth: '11rem',
  },
  3: {
    bar: 'h-3',
    shield: 'h-8 w-11 text-base',
    name: 'text-xs',
    width: '78cqw',
    maxWidth: '16rem',
  },
};

// --- SUBCOMPONENTS ---
/** HP bar with the HP number in a shield-shaped emblem at its centre. */
const EmblemBar = ({ unit }: { unit: HeroUnit }) => {
  const percent = Math.max(0, (unit.hp / unit.maxHp) * 100);
  const look = PLATE_LOOK[sizeOf(unit)];
  return (
    <div
      className={`relative mx-1 rounded-full bg-surface-sunken ring-1 ring-accent/50 ${look.bar}`}
    >
      <div
        className="h-full rounded-full bg-hp transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
      <div
        className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 ${look.shield} -translate-y-1/2 items-center justify-center bg-surface-raised pb-1 font-display font-black ring-1 ring-accent/70 [clip-path:polygon(0_0,100%_0,100%_60%,50%_100%,0_60%)]`}
      >
        {unit.hp}
      </div>
    </div>
  );
};

/** The hero's next move as small chips. */
const IntentChips = ({ unit }: { unit: HeroUnit }) => {
  const { name, intents } = describeHeroIntent(unit);
  return (
    <div className="flex flex-wrap items-center gap-0.5" title={name}>
      {intents.map((intent, index) => (
        <Chip
          key={`${intent.kind}-${index}`}
          {...INTENT_LOOK[intent.kind]}
          text={intent.text}
        />
      ))}
    </div>
  );
};

// --- COMPONENT ---
/** Renders one hero's plate; the focused hero's name is lit gold. */
export const HeroPlate = ({ unit, isFocused }: HeroPlateProps) => {
  const look = PLATE_LOOK[sizeOf(unit)];
  const nameClass = isFocused ? 'text-accent' : 'text-ink';
  const scaleClass = unit.row === 'back' ? 'scale-[0.8]' : '';
  return (
    <div
      className={`pointer-events-none flex origin-bottom flex-col gap-1.5 ${scaleClass}`}
      style={{ width: look.width, maxWidth: look.maxWidth }}
    >
      <span
        className={`truncate px-1 text-left font-display font-bold ${look.name} uppercase leading-none tracking-wider drop-shadow ${nameClass}`}
      >
        {getHero(unit.heroId).name}
      </span>
      <EmblemBar unit={unit} />
      <div className="flex origin-top scale-[0.8] items-start justify-between gap-1">
        <IntentChips unit={unit} />
        <StatusRow combatant={unit} />
      </div>
    </div>
  );
};
