// ===================================================================
// HEX SIGIL
// Hex's mark: a ringed hexagram on a 10 x 10 box, drawn in currentColor.
// Shared by the Hex pop effect (StatusFx) and the aura a hexed unit
// wears while it carries Hex (HexAura), so both read as the same curse.
// ===================================================================

// --- COMPONENT ---
/** Renders the sigil's strokes (place inside an svg with viewBox 0 0 10 10). */
export const HexSigil = () => (
  <g fill="none" stroke="currentColor" strokeWidth="0.6">
    <circle cx="5" cy="5" r="4.4" />
    <circle cx="5" cy="5" r="3.3" strokeDasharray="1 0.8" />
    <path d="M5 1.7 7.9 6.7H2.1Z" />
    <path d="M5 8.3 2.1 3.3H7.9Z" />
  </g>
);
