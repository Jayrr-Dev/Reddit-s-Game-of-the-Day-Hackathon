// ===================================================================
// HEX AURA
// The Hex sigil turning over a unit only while its Hex is about to go
// off (odd: it burns before the unit's next turn), so the warning means
// something. An even Hex shows on its chip alone. Two levels (see
// hexBurnAmount):
//   primed   odd Hex, burns double before its turn   bright
//   doubled  odd and ends in 3, burns triple   brightest, fast, throbbing
// PERFORMANCE: one element, transform and opacity only (index.css
// "HEX AURA"); reduced motion holds a still sigil.
// ===================================================================

import {
  hexBurnAmount,
  isEmpoweredHex,
} from '../../../../shared/game/combatant';
import { HexSigil } from './HexSigil';

// --- TYPES ---
type HexAuraState = 'primed' | 'doubled';

// --- HELPERS ---
/** How loud the aura is, or null when the Hex won't burn next turn. */
const auraStateOf = (hex: number): HexAuraState | null => {
  if (hexBurnAmount(hex) <= 0) return null;
  return isEmpoweredHex(hex) ? 'doubled' : 'primed';
};

// --- COMPONENT ---
/** Renders the aura over its parent's box, or nothing unless primed. */
export const HexAura = ({ hex }: { hex: number }) => {
  const state = auraStateOf(hex);
  if (!state) return null;
  return (
    <span
      className="hex-aura pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[78%] text-hex"
      data-state={state}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 10 10"
        className="hex-aura-spin block size-full overflow-visible drop-shadow-[0_0_4px_currentColor]"
      >
        <HexSigil />
      </svg>
    </span>
  );
};
