// ===================================================================
// HOLY SEAL
// Invincible's mark: a double gold ring braided with two wavy bands and
// six star glints, after Cerviel's phase-two seal. Drawn on a 10 x 10
// box in currentColor, like HexSigil, so StatusFx tints it per status.
// ===================================================================

// --- CONSTANTS ---
/** Ring radius the glints and braids sit on (viewBox units). */
const SEAL_RADIUS = 4.2;
/** How many points the braids and glints have round the ring. */
const SEAL_POINTS = 6;
/** Path resolution for the braids (segments round the circle). */
const BRAID_STEPS = 96;

// --- HELPERS ---
/** A closed wavy ring: radius swings by `swing` around `radius`, `phase` shifts it. */
const braidPath = (radius: number, swing: number, phase: number): string => {
  const points = Array.from({ length: BRAID_STEPS }, (_, step) => {
    const angle = (step / BRAID_STEPS) * Math.PI * 2;
    const r = radius + swing * Math.sin(angle * SEAL_POINTS + phase);
    return `${(5 + r * Math.cos(angle)).toFixed(2)} ${(5 + r * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
};

/** A four-point star glint centred on (x, y). */
const glintPath = (x: number, y: number, size: number): string => {
  const waist = size * 0.18;
  return `M${x} ${y - size}L${x + waist} ${y - waist}L${x + size} ${y}L${x + waist} ${y + waist}`
    + `L${x} ${y + size}L${x - waist} ${y + waist}L${x - size} ${y}L${x - waist} ${y - waist}Z`;
};

/** The glints' centres, evenly round the ring starting at the top. */
const GLINTS = Array.from({ length: SEAL_POINTS }, (_, index) => {
  const angle = (index / SEAL_POINTS) * Math.PI * 2 - Math.PI / 2;
  return glintPath(5 + SEAL_RADIUS * Math.cos(angle), 5 + SEAL_RADIUS * Math.sin(angle), index % 3 === 0 ? 1.1 : 0.8);
});

/** Both braids, built once (they never change). */
const BRAIDS = [braidPath(3.9, 0.32, 0), braidPath(3.9, 0.32, Math.PI)];

// --- COMPONENT ---
/** Renders the seal (place inside an svg with viewBox 0 0 10 10). */
export const HolySeal = () => (
  <g>
    <g fill="none" stroke="currentColor">
      <circle cx="5" cy="5" r="4.6" strokeWidth="0.28" />
      <circle cx="5" cy="5" r="3.35" strokeWidth="0.2" />
      {BRAIDS.map((d) => <path key={d} d={d} strokeWidth="0.14" opacity="0.8" />)}
    </g>
    {GLINTS.map((d) => <path key={d} d={d} fill="#fff8e0" />)}
  </g>
);
