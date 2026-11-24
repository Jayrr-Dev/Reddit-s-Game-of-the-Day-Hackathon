// ===================================================================
// HEX AURA
// The Hex sigil turning over a unit for as long as it carries Hex, so a
// curse reads on the body, not just on its chip. It grows with the
// threat (see hexBurnAmount):
//   waiting  even Hex, no burn next turn       faint, slow
//   primed   odd Hex, burns before its turn    bright
//   doubled  odd and ends in 3, burns double   brightest, fast, throbbing
// PERFORMANCE: one element, transform and opacity only (index.css
// "HEX AURA"); reduced motion holds a still sigil.
// ===================================================================

import { hexBurnAmount } from '../../../../shared/game/combatant';
import { HexSigil } from './HexSigil';

// --- TYPES ---
type HexAuraState = 'waiting' | 'primed' | 'doubled';

// --- HELPERS ---
/** How threatening a Hex of this size is right now. */
const auraStateOf = (hex: number): HexAuraState => {
  const burn = hexBurnAmount(hex);
  if (burn > hex) return 'doubled';
  return burn > 0 ? 'primed' : 'waiting';
};

// --- COMPONENT ---
/** Renders the aura over its parent's box, or nothing when not hexed. */
export const HexAura = ({ hex }: { hex: number }) => {
  if (hex <= 0) return null;
  return (
    <span
      className="hex-aura pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[78%] text-hex"
      data-state={auraStateOf(hex)}
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
