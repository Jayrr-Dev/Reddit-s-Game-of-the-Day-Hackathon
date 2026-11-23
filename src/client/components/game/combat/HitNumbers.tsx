// ===================================================================
// HIT NUMBERS
// The damage numbers that punch in over the hero that was hit, then
// drift up and fade (see --animate-hit-pop). Damage a shroud soaked up
// shows beside it, struck through and faded, with a shield.
// ===================================================================

import type { HitPop } from '../../../hooks/useHitPops';
import { Glyph } from '../../ui/Glyph';

// --- CONSTANTS ---
/** The red-outlined look of the damage number. */
const NUMBER_CLASS =
  'font-display font-black [-webkit-text-stroke:1.5px_var(--color-hp)] [text-shadow:0_0_10px_var(--color-hp)]';

// --- SUBCOMPONENTS ---
/** The faded, struck-through blocked amount with its shield. */
const BlockedPart = ({ blocked }: { blocked: number }) => (
  <span className="flex items-center gap-0.5 opacity-70 drop-shadow-[0_0_2px_black]">
    <span className="font-display text-2xl font-black text-ink [-webkit-text-stroke:1px_var(--color-surface-sunken)] line-through decoration-hp decoration-[3px]">
      {blocked}
    </span>
    <Glyph name="shield" className="size-5 text-ink" />
  </span>
);

/** One pop, centred on the hit hero's body. */
const Pop = ({ pop }: { pop: HitPop }) => (
  <div
    className="absolute -translate-x-1/2 -translate-y-1/2"
    style={{ left: pop.point.x, top: pop.point.y }}
  >
    <div className="flex items-center gap-1 animate-hit-pop">
      {pop.amount > 0 && (
        <span className={`${NUMBER_CLASS} text-4xl text-surface-sunken`}>
          {pop.amount}
        </span>
      )}
      {pop.blocked > 0 && <BlockedPart blocked={pop.blocked} />}
    </div>
  </div>
);

// --- COMPONENT ---
/** Renders the current damage numbers over their heroes. */
export const HitNumbers = ({ pops }: { pops: HitPop[] }) => (
  <div className="pointer-events-none fixed inset-0 z-40">
    {pops.map((pop) => (
      <Pop key={pop.id} pop={pop} />
    ))}
  </div>
);
