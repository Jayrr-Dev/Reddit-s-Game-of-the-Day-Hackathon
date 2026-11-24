// ===================================================================
// MOVE FAIL POPS
// When a pull or push doesn't move its target (a boss can't be moved),
// a red "cancel" sign (a circle with a slash) pops over the hero and
// fades, so the player sees the knockback was shrugged off while the
// rest of the card still lands. Driven by useMoveFailPops.
// ===================================================================

import type { FailPop } from '../../../hooks/useMoveFailPops';

// --- SUBCOMPONENTS ---
/** The cancel sign: a red ring with a slash, outlined in black. */
const CancelSign = () => (
  <svg viewBox="0 0 40 40" className="size-14" aria-hidden="true">
    <circle cx="20" cy="20" r="15" fill="none" stroke="black" strokeWidth="8" />
    <line
      x1="9.5"
      y1="30.5"
      x2="30.5"
      y2="9.5"
      stroke="black"
      strokeWidth="8"
    />
    <circle
      cx="20"
      cy="20"
      r="15"
      fill="none"
      className="stroke-hp"
      strokeWidth="5"
    />
    <line
      x1="9.5"
      y1="30.5"
      x2="30.5"
      y2="9.5"
      className="stroke-hp"
      strokeWidth="5"
    />
  </svg>
);

// --- COMPONENT ---
/** Renders the current cancel signs over their heroes. */
export const MoveFailPops = ({ pops }: { pops: readonly FailPop[] }) => (
  <div className="pointer-events-none fixed inset-0 z-40">
    {pops.map((pop) => (
      <div
        key={pop.id}
        role="img"
        aria-label="Movement failed"
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: pop.point.x, top: pop.point.y }}
      >
        <div className="animate-fail-pop">
          <CancelSign />
        </div>
      </div>
    ))}
  </div>
);
