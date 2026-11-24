// ===================================================================
// IMPACT OVERLAY
// Quick effects drawn over a character for each pop (see useHitPops),
// so you can read what just happened to them without reading numbers:
//   HIT     Melee (and the heroes' own attacks)  a thin red slice
//           Range                                 an arrow hole with cracks
//           Magic                                 an arcane burst (rays, curls, sparks)
//           Curse (curse cards)                   a purple glow
//           a status ticking (Hex, Poison, Burn)  that status's own effect
//   ANY STATUS laid on, gained or going off (heal, Guard, buffs, Hex,
//           Poison, Burn, Frost, Bleed, Weaken): its own effect from the
//           STATUS_FX table (bubbles, flames, shards ...), see StatusFx
// Every hit is its own pop, so a 3-hit card leaves 3 marks. Each mark
// gets a fixed pseudo-random spot from its pop id, so it never jumps
// on re-render. Marks fade out on their own (about 1 s), before the pop
// itself is removed.
// ===================================================================

import type { CSSProperties } from 'react';
import { popScale } from '../../../lib/popSize';
import { seeded, spread } from '../../../lib/seeded';
import { MagicBurst } from './MagicBurst';
import { Puncture } from './Puncture';
import { Slice } from './Slice';
import { StatusFx } from './StatusFx';
import type { PlayerHitPop } from '../../../hooks/useHitPops';

// --- CONSTANTS ---
const CURSE_GLOW = 'var(--color-hex)';

// --- HELPERS ---
/**
 * Where a mark sits: centred on the body with some scatter, tilted by
 * `baseDeg` give or take `tiltDeg`. Percentages are of the overlay box.
 */
const placeAt = (
  id: number,
  baseDeg: number,
  tiltDeg: number
): CSSProperties => ({
  left: `${50 + spread(id, 1) * 22}%`,
  top: `${50 + spread(id, 2) * 22}%`,
  transform: `translate(-50%, -50%) rotate(${baseDeg + spread(id, 3) * tiltDeg}deg)`,
});

// --- SUBCOMPONENTS ---
/** Slash length (% of the overlay box) for a typical hit, give or take. */
const SLASH_BASE_MIN = 38;
const SLASH_BASE_SPREAD = 22;
/**
 * Slash angles (deg). Pops get them in turn by id, so back-to-back cuts
 * always cross at a clearly different angle (any two are 20+ apart).
 */
const SLASH_ANGLES = [-35, 30, -65, 10, 55, -15] as const;
/** A little wobble on top, small enough to keep cuts distinct. */
const SLASH_WOBBLE_DEG = 3;
/** Bounds so a scratch stays visible and a huge hit stays on the body. */
const SLASH_MIN = 24;
const SLASH_MAX = 120;
/** How thick a cut is (half its width at the middle, slice units). */
const SLASH_HALF_THICKNESS_MIN = 3;
const SLASH_HALF_THICKNESS_SPREAD = 2.4;

/**
 * A Melee cut: a wide red slice, pointed at both ends. Its length
 * follows the hit's size next to the typical hit (the same curve as the
 * damage numbers), so a big hit cuts a long gash and a chip a short one.
 * Each one also gets its own thickness, and the next angle in
 * SLASH_ANGLES, so a flurry reads as crossing cuts, never one stamp.
 */
const Slash = ({ pop }: { pop: PlayerHitPop }) => {
  const { id } = pop;
  const base = SLASH_BASE_MIN + seeded(id, 5) * SLASH_BASE_SPREAD;
  const scaled = base * popScale(pop.amount + pop.blocked, pop.typical);
  const length = Math.min(SLASH_MAX, Math.max(SLASH_MIN, scaled));
  const angle = SLASH_ANGLES[id % SLASH_ANGLES.length] ?? 0;
  return (
    <span
      className="absolute"
      style={{ ...placeAt(id, angle, SLASH_WOBBLE_DEG), width: `${length}%` }}
    >
      <Slice
        halfThickness={
          SLASH_HALF_THICKNESS_MIN + seeded(id, 6) * SLASH_HALF_THICKNESS_SPREAD
        }
        className="origin-left animate-impact-slash"
      />
    </span>
  );
};

/** A Range shot: an arrow hole, turned any which way. */
const Hole = ({ id }: { id: number }) => (
  <span className="absolute aspect-square w-[36%]" style={placeAt(id, 0, 180)}>
    <Puncture id={id} className="animate-impact-puncture" />
  </span>
);

/** A Magic hit: an arcane burst, turned any which way. */
const Burst = ({ id }: { id: number }) => (
  <span className="absolute aspect-square w-[64%]" style={placeAt(id, 0, 180)}>
    <MagicBurst id={id} />
  </span>
);

/** A soft wash of colour over the character (status applied). */
const Glow = ({ tone }: { tone: string }) => (
  <span
    className="absolute inset-0 animate-impact-glow rounded-full mix-blend-screen"
    style={{
      background: `radial-gradient(circle, ${tone} 0%, transparent 65%)`,
    }}
  />
);

/** The effect for one hit: the ticking status's, else by the card's type. */
const HitMark = ({ pop }: { pop: PlayerHitPop }) => {
  if (pop.tick) return <StatusFx kind={pop.tick} id={pop.id} />;
  if (pop.source === 'range') return <Hole id={pop.id} />;
  if (pop.source === 'magic') return <Burst id={pop.id} />;
  if (pop.source === 'curse') return <Glow tone={CURSE_GLOW} />;
  return <Slash pop={pop} />;
};

/** The effect for one pop: a hit's mark, or the status's own effect. */
const Impact = ({ pop }: { pop: PlayerHitPop }) =>
  pop.kind === 'hit' ? (
    <HitMark pop={pop} />
  ) : (
    <StatusFx kind={pop.kind} id={pop.id} />
  );

// --- COMPONENT ---
/**
 * Renders the effects for a character's current pops. Fills its parent,
 * which should cover the character's body.
 */
export const ImpactOverlay = ({ pops }: { pops: readonly PlayerHitPop[] }) => (
  <div
    className="pointer-events-none absolute inset-0 [container-type:size]"
    aria-hidden="true"
  >
    {pops.map((pop) => (
      <Impact key={pop.id} pop={pop} />
    ))}
  </div>
);
