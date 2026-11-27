// ===================================================================
// HEX AURA
// The Hex sigil turning over a unit only while its Hex is about to go
// off (odd: it burns before the unit's next turn), so the warning means
// something. An even Hex shows on its chip alone. Two levels (see
// hexBurnAmount):
//   primed   odd Hex, burns before its turn   bright
//   doubled  ends in 3, burns double   brightest, fast, throbbing
// PERFORMANCE: one element, transform and opacity only (index.css
// "HEX AURA"); reduced motion holds a still sigil.
// ===================================================================

import {
  hexBurnAmount,
  isEmpoweredHex,
} from '../../../../shared/game/combatant';
import type { Combatant } from '../../../../shared/game/types';
import { HexSigil } from './HexSigil';

// --- TYPES ---
type HexAuraState = 'primed' | 'doubled';

// --- HELPERS ---
/** How loud the aura is, or null when the Hex won't burn next turn. */
const auraStateOf = (hex: number, source?: Combatant): HexAuraState | null => {
  if (hexBurnAmount(hex, source) <= 0) return null;
  return isEmpoweredHex(hex, source) ? 'doubled' : 'primed';
};

// --- COMPONENT ---
/** Renders the aura over its parent's box, or nothing unless primed. */
export const HexAura = ({ hex, source }: { hex: number; source?: Combatant }) => {
  const state = auraStateOf(hex, source);
  if (!state) return null;
  const count = String(hex);
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
      <svg viewBox="0 0 10 10" className="absolute inset-0 size-full overflow-visible">
        <text x="5" y="5" textAnchor="middle" dominantBaseline="central"
          fontSize={count.length < 3 ? 3.2 : 8.4 / count.length}
          className="hex-aura-count font-display font-black tabular-nums">
          {count}
        </text>
      </svg>
    </span>
  );
};
