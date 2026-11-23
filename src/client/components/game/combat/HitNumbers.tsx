// ===================================================================
// HIT NUMBERS
// The big damage numbers that punch in over the battlefield when a
// hero is hit, then drift up and fade (see --animate-hit-pop).
// ===================================================================

import type { HitPop } from '../../../hooks/useHitPops';

// --- COMPONENT ---
/** Renders the current damage numbers, newest on top. */
export const HitNumbers = ({ pops }: { pops: HitPop[] }) => (
  <div className="pointer-events-none absolute inset-x-0 top-[30%] z-40 flex justify-center">
    {pops.map((pop) => (
      <span
        key={pop.id}
        className="absolute font-display text-6xl font-black text-surface-sunken animate-hit-pop [-webkit-text-stroke:2px_var(--color-hp)] [text-shadow:0_0_12px_var(--color-hp)]"
      >
        {pop.amount}
      </span>
    ))}
  </div>
);
