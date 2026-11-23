// ===================================================================
// IMPACT OVERLAY
// Quick effects drawn over a character for each pop (see useHitPops),
// so you can read what just happened to them without reading numbers:
//   HIT     Melee (and the heroes' own attacks)  a thin black slice
//           Range                                 a steel-grey streak, like an arrow
//           Magic                                 a blue plus
//           Curse (Hex ticking, curse cards)      a purple glow
//   HEAL    green pluses rising off the body, and a green glow
//   BUFF    a green arrow up over the face, and a glow in its colour
//   DEBUFF  a red arrow down over the face, and a glow in its colour
// Every hit is its own pop, so a 3-hit card leaves 3 marks. Each mark
// gets a fixed pseudo-random spot from its pop id, so it never jumps
// on re-render. Marks fade out on their own (about 1 s), before the pop
// itself is removed.
// ===================================================================

import type { CSSProperties } from 'react';
import { POP_LOOK, toneVarOf } from '../../../content/visuals';
import { Slice } from './Slice';
import type { PlayerHitPop } from '../../../hooks/useHitPops';

// --- CONSTANTS ---
const DEBUFF_KINDS: readonly PlayerHitPop['kind'][] = ['hex', 'dread'];
const BUFF_ARROW_TONE = 'var(--color-heal)';
const DEBUFF_ARROW_TONE = 'var(--color-hp)';
const CURSE_GLOW = 'var(--color-hex)';

// --- HELPERS ---
/**
 * A stable number in [0, 1) from a pop id and a salt (a tiny integer
 * hash), so each mark's spot and angle look random but never change.
 */
const seeded = (id: number, salt: number): number => {
  const mixed = Math.imul(id * 31 + salt * 17 + 7, 2654435761) >>> 0;
  return (mixed % 1000) / 1000;
};

/** A spread from -1 to 1 for a pop (for offsets and tilts). */
const spread = (id: number, salt: number): number => seeded(id, salt) * 2 - 1;

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
/**
 * A Melee cut: a semi-thin black slice, pointed at both ends. Each one
 * gets its own length, thickness and angle (from its pop id), so a
 * flurry reads as quick offset slices rather than one stamp. A faint
 * light edge keeps it visible on dark armour.
 */
const Slash = ({ id }: { id: number }) => {
  const length = 45 + seeded(id, 5) * 35; // % of the overlay box
  // Mostly down-left to up-right, but about a third cut the other way.
  const baseDeg = seeded(id, 7) < 0.35 ? 35 : -35;
  return (
    <span
      className="absolute"
      style={{ ...placeAt(id, baseDeg, 30), width: `${length}%` }}
    >
      <Slice
        halfThickness={1.6 + seeded(id, 6) * 1.6}
        className="origin-left animate-impact-slash"
      />
    </span>
  );
};

/** A Range shot: a thin steel-grey streak with a bright head, like an arrow. */
const Streak = ({ id }: { id: number }) => (
  <span className="absolute w-[45%]" style={placeAt(id, -35, 20)}>
    <span className="block h-[3px] animate-impact-streak rounded-full bg-gradient-to-r from-transparent via-[#8b95a1] to-white shadow-[0_0_3px_rgb(0_0_0/0.8)]" />
  </span>
);

/** A Magic spark: a small blue plus. */
const Plus = ({ id }: { id: number }) => (
  <span className="absolute aspect-square w-[18%]" style={placeAt(id, 0, 15)}>
    <svg
      viewBox="0 0 10 10"
      className="block size-full animate-impact-plus drop-shadow-[0_0_3px_var(--color-shroud)]"
      aria-hidden="true"
    >
      <path
        d="M5 1v8M1 5h8"
        stroke="var(--color-shroud)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  </span>
);

/** Rising heal sparks: [left %, start delay ms] for each green plus. */
const HEAL_SPARKS: readonly (readonly [number, number])[] = [
  [30, 0],
  [62, 90],
  [45, 170],
  [72, 250],
];

/** A heal: green pluses float up off the body, one after another. */
const HealSparks = () => (
  <>
    {HEAL_SPARKS.map(([left, delay]) => (
      <span
        key={left}
        className="absolute top-[55%] aspect-square w-[16%] -translate-x-1/2"
        style={{ left: `${left}%` }}
      >
        <svg
          viewBox="0 0 10 10"
          className="block size-full animate-impact-rise drop-shadow-[0_0_3px_var(--color-heal)]"
          style={{ animationDelay: `${delay}ms` }}
          aria-hidden="true"
        >
          <path
            d="M5 1v8M1 5h8"
            stroke="var(--color-heal)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
    ))}
  </>
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

/** An arrow over the face: up for a buff, down for a debuff. */
const Arrow = ({ id, isUp }: { id: number; isUp: boolean }) => (
  <span
    className="absolute top-[18%] aspect-square w-[26%] -translate-x-1/2"
    style={{ left: `${50 + spread(id, 4) * 12}%` }}
  >
    <svg
      viewBox="0 0 10 10"
      className="block size-full animate-impact-arrow drop-shadow-[0_0_3px_black]"
      style={{ ['--arrow-dir' as string]: isUp ? 1 : -1 }}
      aria-hidden="true"
    >
      <path
        d={isUp ? 'M5 1L9 6H6.4V9H3.6V6H1Z' : 'M5 9L9 4H6.4V1H3.6V4H1Z'}
        fill={isUp ? BUFF_ARROW_TONE : DEBUFF_ARROW_TONE}
      />
    </svg>
  </span>
);

/** The effect for one hit, by the type of card that dealt it. */
const HitMark = ({ pop }: { pop: PlayerHitPop }) => {
  if (pop.source === 'range') return <Streak id={pop.id} />;
  if (pop.source === 'magic') return <Plus id={pop.id} />;
  if (pop.source === 'curse') return <Glow tone={CURSE_GLOW} />;
  return <Slash id={pop.id} />;
};

/** The effect for one pop: a hit mark, or a status arrow and glow. */
const Impact = ({ pop }: { pop: PlayerHitPop }) => {
  if (pop.kind === 'hit') return <HitMark pop={pop} />;
  if (pop.kind === 'heal')
    return (
      <>
        <Glow tone="var(--color-heal)" />
        <HealSparks />
      </>
    );
  const isDebuff = DEBUFF_KINDS.includes(pop.kind);
  return (
    <>
      <Glow tone={toneVarOf(POP_LOOK[pop.kind])} />
      <Arrow id={pop.id} isUp={!isDebuff} />
    </>
  );
};

// --- COMPONENT ---
/**
 * Renders the effects for a character's current pops. Fills its parent,
 * which should cover the character's body.
 */
export const ImpactOverlay = ({ pops }: { pops: readonly PlayerHitPop[] }) => (
  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
    {pops.map((pop) => (
      <Impact key={pop.id} pop={pop} />
    ))}
  </div>
);
