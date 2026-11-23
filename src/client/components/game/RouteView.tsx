// ===================================================================
// ROUTE VIEW
// The crossroads before each stop: one or two paths to choose from.
// ===================================================================

import { getHero } from '../../../shared/game/heroes';
import type { Stop } from '../../../shared/game/kingdom';
import type { RunAction } from '../../../shared/game/run';
import { STOP_COPY } from '../../content/lore';
import { STOP_LOOK } from '../../content/visuals';
import { Glyph } from '../ui/Glyph';

// --- TYPES ---
export type RouteViewProps = {
  options: Stop[];
  onAction: (action: RunAction) => void;
};

// --- HELPERS ---
/** "Archer, Archer, Priest" for a fight; empty for rest stops. */
const heroList = (stop: Stop): string =>
  stop.heroIds.map((id) => getHero(id).name).join(', ');

// --- SUBCOMPONENTS ---
/** One path as a big tappable panel. */
const PathCard = ({ stop, onChoose }: { stop: Stop; onChoose: () => void }) => {
  const look = STOP_LOOK[stop.kind];
  const copy = STOP_COPY[stop.kind];
  return (
    <button
      type="button"
      onClick={onChoose}
      className="flex w-full items-center gap-3 rounded-xl bg-surface-raised p-4 text-left ring-1 ring-edge transition-colors hover:ring-accent animate-rise"
    >
      <span className={`rounded-full bg-surface-sunken p-3 ${look.toneClass}`}>
        <Glyph name={look.glyph} className="size-6" />
      </span>
      <span className="flex flex-col">
        <span className="font-display text-lg font-bold">{copy.title}</span>
        <span className="text-xs text-ink-muted">{copy.blurb}</span>
        {stop.heroIds.length > 0 && (
          <span className="text-xs text-ink">{heroList(stop)}</span>
        )}
      </span>
    </button>
  );
};

// --- COMPONENT ---
/** Lists the paths; picking one enters that stop. */
export const RouteView = ({ options, onAction }: RouteViewProps) => (
  <div className="flex w-full max-w-sm flex-col gap-3">
    <h2 className="text-center font-display text-xl font-bold">
      {options.length > 1 ? 'Choose your path' : 'The champion awaits'}
    </h2>
    {options.map((stop, option) => (
      <PathCard
        key={`${stop.kind}-${option}`}
        stop={stop}
        onChoose={() => onAction({ type: 'chooseStop', option })}
      />
    ))}
  </div>
);
