// ===================================================================
// FOCUS HUD
// The top of the combat screen: where you are, then the focused hero's
// name, a long HP bar with the HP number in a centre emblem, its next
// move on the left and its statuses on the right.
// ===================================================================

import { describeHeroIntent } from '../../../../shared/game/describe';
import { getHero } from '../../../../shared/game/heroes';
import type { HeroUnit } from '../../../../shared/game/types';
import { INTENT_LOOK } from '../../../content/visuals';
import { Chip } from '../../ui/Chip';
import { StatusRow } from '../StatusRow';

// --- TYPES ---
export type FocusHudProps = {
  /** "Wave 6 · Border Village" style location line. */
  where: string;
  score: number;
  unit: HeroUnit | undefined;
};

// --- SUBCOMPONENTS ---
/** HP bar with the number in a shield-shaped emblem at its centre. */
const EmblemBar = ({ unit }: { unit: HeroUnit }) => {
  const percent = Math.max(0, (unit.hp / unit.maxHp) * 100);
  return (
    <div className="relative mx-6 h-3 rounded-full bg-surface-sunken ring-1 ring-accent/50">
      <div
        className="h-full rounded-full bg-hp transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
      <div className="absolute left-1/2 top-1/2 flex h-8 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-surface-raised font-display text-base font-black ring-1 ring-accent/70 [clip-path:polygon(0_0,100%_0,100%_60%,50%_100%,0_60%)]">
        {unit.hp}
      </div>
    </div>
  );
};

// --- COMPONENT ---
/** Renders the location line and the focused hero's readout. */
export const FocusHud = ({ where, score, unit }: FocusHudProps) => (
  <header className="relative z-30 flex shrink-0 flex-col gap-1 bg-gradient-to-b from-surface to-transparent px-3 pb-1 pt-1.5">
    <div className="flex justify-between text-[10px] text-ink-muted">
      <span>{where}</span>
      <span className="font-bold text-ink">{score} pts</span>
    </div>
    {unit ? <HeroReadout unit={unit} /> : <div className="h-12" />}
  </header>
);

/** Name, emblem bar, intents and statuses for one hero. */
const HeroReadout = ({ unit }: { unit: HeroUnit }) => {
  const hero = getHero(unit.heroId);
  const { name, intents } = describeHeroIntent(unit);
  return (
    <>
      <span className="mb-1 ml-6 font-display text-xs font-bold uppercase tracking-wider text-accent">
        {hero.name}{' '}
        <span className="font-body normal-case tracking-normal text-ink-muted">
          · {unit.row} row
        </span>
      </span>
      <EmblemBar unit={unit} />
      <div className="mt-1 flex items-start justify-between px-1">
        <div className="flex flex-wrap items-center gap-1" title={name}>
          {intents.map((intent, index) => (
            <Chip
              key={`${intent.kind}-${index}`}
              {...INTENT_LOOK[intent.kind]}
              text={intent.text}
            />
          ))}
        </div>
        <StatusRow combatant={unit} />
      </div>
    </>
  );
};
