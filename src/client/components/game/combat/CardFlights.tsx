// ===================================================================
// CARD FLIGHTS
// Draws the card backs flying between the piles and the hand (see
// useCardFlights), on a fixed, click-through layer above the fight.
// Each back arcs a little as it flies; transform and opacity only.
// ===================================================================

import type { CSSProperties } from 'react';
import type { CardFlight } from '../../../hooks/useCardFlights';

// --- HELPERS ---
/** Places a back on its start and hands CSS the trip (see card-flight). */
const flightStyle = ({ from, to, delayMs }: CardFlight): CSSProperties =>
  ({
    left: from.x,
    top: from.y,
    '--fly-dx': `${to.x - from.x}px`,
    '--fly-dy': `${to.y - from.y}px`,
    animationDelay: `${delayMs}ms`,
  }) as CSSProperties;

// --- COMPONENT ---
/** Renders every card back in flight. */
export const CardFlights = ({
  flights,
}: {
  flights: readonly CardFlight[];
}) => (
  <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
    {flights.map((flight) => (
      <span
        key={flight.id}
        className="absolute -ml-3 -mt-4 h-8 w-6 rounded-sm bg-deck opacity-0 ring-1 ring-accent/60 shadow-[0_2px_6px_rgb(0_0_0/0.5)] animate-card-flight"
        style={flightStyle(flight)}
      />
    ))}
  </div>
);
