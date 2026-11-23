// ===================================================================
// HERO ON FIELD
// One hero placed on the 3 x 2 battlefield. Front-row heroes are drawn
// tall and low; back-row heroes small, higher and dimmer, so depth
// reads at a glance. Tapping a hero focuses it (and aims the selected
// card at it when that is a legal target).
// ===================================================================

import type { CSSProperties } from 'react';
import { sizeOf } from '../../../../shared/game/battlefield';
import { describeHeroIntent } from '../../../../shared/game/describe';
import { getHero } from '../../../../shared/game/heroes';
import { BATTLEFIELD_COLUMNS } from '../../../../shared/game/rules';
import type { HeroRow, HeroUnit } from '../../../../shared/game/types';
import { INTENT_LOOK } from '../../../content/visuals';
import type { AimState } from '../../../hooks/useCombatControls';
import { Chip } from '../../ui/Chip';
import { HeroFigure } from './HeroFigure';

// --- TYPES ---
export type HeroOnFieldProps = {
  unit: HeroUnit;
  isFocused: boolean;
  aim: AimState;
  onTap: (uid: number) => void;
};

// --- CONSTANTS ---
/** Where each row stands, as a share of the battlefield height. */
const ROW_BOX: Record<HeroRow, { bottom: string; height: string }> = {
  front: { bottom: '3%', height: '62%' },
  back: { bottom: '38%', height: '34%' },
};

const AIM_CLASS: Record<AimState, string> = {
  idle: '',
  legal: 'drop-shadow-[0_0_8px_var(--color-accent)]',
  illegal: 'opacity-35 grayscale',
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

// --- COMPONENT ---
/** Renders the hero with its next move above and HP below. */
export const HeroOnField = ({
  unit,
  isFocused,
  aim,
  onTap,
}: HeroOnFieldProps) => {
  const hero = getHero(unit.heroId);
  const { intents } = describeHeroIntent(unit);
  const hpPercent = Math.max(0, (unit.hp / unit.maxHp) * 100);
  const isBack = unit.row === 'back';
  const focusClass = isFocused
    ? 'drop-shadow-[0_0_10px_var(--color-accent)]'
    : '';
  return (
    <button
      type="button"
      onClick={() => onTap(unit.uid)}
      aria-label={`${hero.name}, ${unit.hp} of ${unit.maxHp} HP, ${unit.row} row`}
      className={`pointer-events-auto absolute flex flex-col items-center justify-end transition-all duration-700 ${isBack ? 'brightness-75' : ''} ${AIM_CLASS[aim]}`}
      style={boxStyle(unit)}
    >
      <div className="mb-0.5 flex scale-90 flex-wrap justify-center gap-0.5">
        {intents.map((intent, index) => (
          <Chip
            key={`${intent.kind}-${index}`}
            {...INTENT_LOOK[intent.kind]}
            text={intent.text}
          />
        ))}
      </div>
      <div
        className={`flex min-h-0 max-w-full flex-1 justify-center ${focusClass} ${aim === 'legal' ? 'animate-pulse' : ''}`}
      >
        <HeroFigure hue={hero.hue} tier={hero.tier} size={sizeOf(unit)} />
      </div>
      <div className="mt-0.5 h-1.5 w-3/5 max-w-24 overflow-hidden rounded-full bg-surface-sunken ring-1 ring-black/60">
        <div
          className="h-full bg-hp transition-[width] duration-300"
          style={{ width: `${hpPercent}%` }}
        />
      </div>
    </button>
  );
};
