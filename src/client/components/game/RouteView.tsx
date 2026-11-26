// ===================================================================
// ROUTE VIEW
// The crossroads before each stop: one or two paths to choose from.
// ===================================================================

import { useState } from 'react';
import type { Stop } from '../../../shared/game/kingdom';
import type { RunAction } from '../../../shared/game/run';
import { STOP_COPY } from '../../content/lore';

import { MAP_IMAGES } from './combat/Backdrop';
import { routeLocation } from './routeLocation';
import { ProgressiveImg } from '../ui/ProgressiveImage';

// --- TYPES ---
export type RouteViewProps = {
  stopNumber: number;
  options: Stop[];
  onAction: (action: RunAction) => void;
};

const PathCard = ({ stop, location, selected, onChoose }: {
  stop: Stop; location: ReturnType<typeof routeLocation>; selected: boolean; onChoose: () => void;
}) => {
  const copy = STOP_COPY[stop.kind];
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-pressed={selected}
      className="path-card text-left"
    >
      <span className="route-portrait"><ProgressiveImg src={MAP_IMAGES[location.terrain]} alt="" /></span>
      <span className="path-name">{location.name}</span>
      <span className="path-rules">{location.flavour}</span>
      <span className="path-type">{copy.title}</span>
    </button>
  );
};

// --- COMPONENT ---
/** Lists the paths; picking one enters that stop. */
export const RouteView = ({ options, stopNumber, onAction }: RouteViewProps) => {
  const [selected, setSelected] = useState<number | null>(null);
  return (
  <div className="run-panel flex w-full max-w-md flex-col gap-3">
    <h2 className="text-center font-display text-xl font-bold">
      {options.length > 1 ? 'Choose your path' : 'The champion awaits'}
    </h2>
    <div className="path-hand">{options.map((stop, option) => (
      <PathCard
        key={`${stop.kind}-${option}`}
        stop={stop}
        location={routeLocation(stopNumber, option, stop.kind)}
        selected={selected === option}
        onChoose={() => setSelected(option)}
      />
    ))}</div>
    <button type="button" className="path-confirm" disabled={selected === null} onClick={() => selected !== null && onAction({ type: 'chooseStop', option: selected })}>Confirm</button>
  </div>
  );
};
