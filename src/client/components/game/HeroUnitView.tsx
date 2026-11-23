// ===================================================================
// HERO UNIT VIEW
// One hero on the field: intent, portrait, name, HP and statuses.
// Tapping a hero makes it the target for the next card.
// ===================================================================

import { describeHeroIntent } from '../../../shared/game/describe';
import { getHero } from '../../../shared/game/heroes';
import type { HeroUnit } from '../../../shared/game/types';
import { INTENT_LOOK } from '../../content/visuals';
import { Chip } from '../ui/Chip';
import { Meter } from '../ui/Meter';
import { HeroPortrait } from './HeroPortrait';
import { StatusRow } from './StatusRow';

// --- TYPES ---
export type HeroUnitViewProps = {
  unit: HeroUnit;
  isTargeted: boolean;
  onSelect: (uid: number) => void;
};

// --- SUBCOMPONENTS ---
/** The hero's next move: name plus one chip per effect. */
const IntentBubble = ({ unit }: { unit: HeroUnit }) => {
  const { name, intents } = describeHeroIntent(unit);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex gap-1">
        {intents.map((intent, index) => (
          <Chip
            key={`${intent.kind}-${index}`}
            {...INTENT_LOOK[intent.kind]}
            text={intent.text}
          />
        ))}
      </div>
      <span className="text-[10px] italic text-ink-muted">{name}</span>
    </div>
  );
};

// --- COMPONENT ---
/** Renders a selectable hero card. */
export const HeroUnitView = ({
  unit,
  isTargeted,
  onSelect,
}: HeroUnitViewProps) => {
  const hero = getHero(unit.heroId);
  const ringClass = isTargeted ? 'ring-2 ring-accent' : 'ring-1 ring-edge';
  return (
    <button
      type="button"
      onClick={() => onSelect(unit.uid)}
      aria-pressed={isTargeted}
      aria-label={`Target ${hero.name}`}
      className={`flex w-28 flex-col items-center gap-1 rounded-xl bg-surface-raised p-2 animate-rise ${ringClass}`}
    >
      <IntentBubble unit={unit} />
      <div className="size-14">
        <HeroPortrait hue={hero.hue} tier={hero.tier} />
      </div>
      <span className="line-clamp-1 text-xs font-semibold">{hero.name}</span>
      <Meter
        value={unit.hp}
        max={unit.maxHp}
        fillClass="bg-hp"
        label={`${unit.hp}/${unit.maxHp}`}
      />
      <StatusRow combatant={unit} />
    </button>
  );
};
