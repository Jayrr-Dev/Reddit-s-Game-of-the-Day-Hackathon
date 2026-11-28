// ===================================================================
// HEX AURA
// The Hex sigil stays visible while a unit is cursed. Status icons show stacks.
// The ring is faint unless the next action or turn start will trigger a burst.
// PERFORMANCE: one element, transform and opacity only (index.css
// "HEX AURA"); reduced motion holds a still sigil.
// ===================================================================

import { hexAfterGrowth, hexBurnAmount } from '../../../../shared/game/combatant';
import type { Combatant } from '../../../../shared/game/types';
import { HexSigil } from './HexSigil';

// --- TYPES ---
type HexAuraState = 'waiting' | 'primed';

// --- HELPERS ---
/** How bright the ring is, or null when the unit has no Hex. */
const auraStateOf = (hex: number, source?: Combatant): HexAuraState | null => {
  if (hex <= 0) return null;
  return (hexBurnAmount(hex, source) || hexBurnAmount(hexAfterGrowth(hex), source)) > 0 ? 'primed' : 'waiting';
};

// --- COMPONENT ---
/** Renders the aura over its parent's box while Hex is active. */
export const HexAura = ({ hex, source }: { hex: number; source?: Combatant }) => {
  const state = auraStateOf(hex, source);
  if (!state) return null;
  return (
    <span
      className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 text-hex"
      aria-hidden="true"
    >
      <span className="hex-aura absolute inset-0" data-state={state}>
        <svg viewBox="0 0 10 10"
          className="hex-aura-spin block size-full overflow-visible drop-shadow-[0_0_4px_currentColor]">
          <HexSigil />
        </svg>
      </span>
    </span>
  );
};
