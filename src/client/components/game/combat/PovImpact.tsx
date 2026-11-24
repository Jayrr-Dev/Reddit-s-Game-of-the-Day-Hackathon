// ===================================================================
// POV IMPACT
// When a hero's attack lands on you, it lands on the screen itself, as
// if you were looking out of the villain's eyes. Every hit draws:
//   HURT LAYER   a vignette closing in from the edges (blood red, or
//                Hex purple for a curse), a glitch flash
//                of red and cyan bands, and a shake of the whole view,
//                all scaled to the damage
//   MARK         one per blow (a multi-hit pops once per blow, see
//                usePlayerHits), scattered around the centre of the
//                screen: Melee  long blood-red slashes
//                               Range  big arrow holes with cracks
//                               Magic  a screen-wide arcane blast
//                               Curse  a purple sigil and skull (Hex
//                                      eating at you: no attack type)
// Each hit's damage number pops on top of its mark (not by the
// portrait) and floats off left, up or right at random.
// A hit your Guard took whole only shades the edges a faint black.
// Hero arrows fly at the centre too (POV_ANCHOR_ATTR, see HeroShots).
// PERFORMANCE: transform and opacity animations only; each mark is
// mounted when its blow lands and leaves with its pop.
// ===================================================================

import { useEffect, type CSSProperties, type RefObject } from 'react';
import type { PlayerHitPop } from '../../../hooks/useHitPops';
import { popScale } from '../../../lib/popSize';
import { seeded, spread } from '../../../lib/seeded';
import { CurseSigil } from './CurseSigil';
import { driftOf } from '../../../lib/popDrift';
import { HitLine } from './HitNumbers';
import { MagicBurst } from './MagicBurst';
import { Puncture } from './Puncture';
import { Slice } from './Slice';

// --- CONSTANTS ---
/** Marks the layer: hero shots aim at its centre. */
export const POV_ANCHOR_ATTR = 'data-pov-anchor';
/** How far marks scatter from the centre (% of the screen). */
const SCATTER_X = 20;
const SCATTER_Y = 16;
/** Slash angles, taken in turn so a flurry crosses itself. */
const SLASH_ANGLES = [-28, 24, -52, 8, 44, -12] as const;
/** The vignette's colour for a hit that hurt, and one fully blocked. */
const HURT_TONE = 'rgb(200 20 40 / 0.85)';
const BLOCKED_TONE = 'rgb(0 0 0 / 0.55)';
/** A fully blocked hit only shades the edges faintly. */
const BLOCKED_PEAK = 0.5;
/** A curse's vignette: Hex purple. */
const CURSE_TONE = 'rgb(130 60 200 / 0.8)';
/** How strong the vignette gets: at least this, more for big hits. */
const VIGNETTE_MIN = 0.45;
const VIGNETTE_PER_SCALE = 0.3;
/** The shake: pixels per unit of hit size, and how long it lasts. */
const SHAKE_PX_PER_SCALE = 6;
const SHAKE_MS = 360;

// --- HELPERS ---
/** True for harm with no attack behind it (a curse: Hex ticking). */
const isCurse = (pop: PlayerHitPop): boolean => pop.source === undefined;

/** True for a hit your Guard took entirely. */
const isBlockedOnly = (pop: PlayerHitPop): boolean => pop.amount === 0;

/** How big a hit is next to the typical one (1 = typical). */
const sizeOf = (pop: PlayerHitPop): number =>
  popScale(pop.amount + pop.blocked, pop.typical);

/** Where one blow's mark sits: the centre, scattered by its seed. */
const markPlace = (seed: number): CSSProperties => ({
  left: `${50 + spread(seed, 1) * SCATTER_X}%`,
  top: `${50 + spread(seed, 2) * SCATTER_Y}%`,
});

/** Where a hit lands: its blow's spot, scattered by its id. */
const seedOf = (pop: PlayerHitPop): number => pop.id * 7;

/** Shakes an element once, harder for a bigger hit (Web Animations). */
const shake = (element: HTMLElement | null, scale: number) => {
  const px = Math.round(SHAKE_PX_PER_SCALE * Math.min(2, scale));
  element?.animate(
    [
      { transform: 'translate(0, 0)' },
      { transform: `translate(${-px}px, ${px / 2}px)` },
      { transform: `translate(${px}px, ${-px / 2}px)` },
      { transform: `translate(${-px / 2}px, ${-px / 3}px)` },
      { transform: `translate(${px / 3}px, ${px / 4}px)` },
      { transform: 'translate(0, 0)' },
    ],
    { duration: SHAKE_MS, easing: 'ease-out' }
  );
};

// --- SUBCOMPONENTS ---
/** One blow's mark, by the kind of attack that struck it. */
const Mark = ({ pop }: { pop: PlayerHitPop }) => {
  const seed = seedOf(pop);
  const style = markPlace(seed);
  if (pop.source === 'range')
    return (
      <span
        className="absolute aspect-square w-[48%] -translate-1/2"
        style={{ ...style, rotate: `${seeded(seed, 3) * 360}deg` }}
      >
        <Puncture id={seed} className="animate-impact-puncture" />
      </span>
    );
  if (isCurse(pop))
    return (
      <span
        className="absolute aspect-square w-[62%] -translate-1/2"
        style={{ left: '50%', top: '50%' }}
      >
        <CurseSigil />
      </span>
    );
  if (pop.source === 'magic')
    return (
      <span
        className="absolute aspect-square w-[85%] -translate-1/2"
        style={{ ...style, rotate: `${seeded(seed, 3) * 360}deg` }}
      >
        <MagicBurst id={seed} />
      </span>
    );
  // MELEE: A LONG SLASH ACROSS THE VIEW
  const angle = SLASH_ANGLES[seed % SLASH_ANGLES.length] ?? 0;
  return (
    <span
      className="absolute w-[78%] -translate-1/2 drop-shadow-[0_0_6px_rgb(120_0_20)]"
      style={{ ...style, rotate: `${angle}deg` }}
    >
      <Slice
        halfThickness={3.5 + seeded(seed, 6) * 2}
        className="origin-left animate-impact-slash"
      />
    </span>
  );
};

/** The edges closing in: red for a hurt, purple for a curse, faint black for a blocked hit. */
const toneOf = (pop: PlayerHitPop): string => {
  if (isBlockedOnly(pop)) return BLOCKED_TONE;
  return isCurse(pop) ? CURSE_TONE : HURT_TONE;
};

/** The edges closing in, in the hit's tone (see toneOf). */
const Vignette = ({ pop }: { pop: PlayerHitPop }) => {
  const tone = toneOf(pop);
  const peak = isBlockedOnly(pop)
    ? BLOCKED_PEAK
    : Math.min(1, VIGNETTE_MIN + VIGNETTE_PER_SCALE * sizeOf(pop));
  return (
    <span
      className="pov-vignette absolute inset-0"
      style={
        {
          background: `radial-gradient(ellipse at center, transparent 42%, ${tone} 100%)`,
          '--pov-peak': peak,
        } as CSSProperties
      }
    />
  );
};

/** A glitch flash: a red and a cyan band tearing sideways. */
const Glitch = ({ id }: { id: number }) => (
  <>
    <span
      className="pov-glitch absolute inset-x-0 h-[7%] bg-[rgb(255_40_70/0.55)] mix-blend-screen"
      style={{ top: `${25 + seeded(id, 8) * 40}%` }}
    />
    <span
      className="pov-glitch absolute inset-x-0 h-[4%] bg-[rgb(60_230_255/0.45)] mix-blend-screen [animation-direction:reverse]"
      style={{ top: `${30 + seeded(id, 9) * 40}%` }}
    />
  </>
);

/**
 * The damage number, popping on top of the blow's mark and floating off
 * left, up or right at random (see driftOf).
 */
const HitNumber = ({ pop }: { pop: PlayerHitPop }) => (
  <span
    className="absolute -translate-1/2 whitespace-nowrap"
    style={{ ...markPlace(seedOf(pop)), ...driftOf(pop.id) }}
  >
    <HitLine
      amount={pop.amount}
      blocked={pop.blocked}
      typical={pop.typical}
      source={pop.source}
      isKill={pop.isKill}
    />
  </span>
);

/**
 * Everything one hit draws on the screen, its number on top. A hit
 * your Guard took whole only shades the edges a faint black: no mark,
 * glitch or shake.
 */
const PovHit = ({ pop }: { pop: PlayerHitPop }) =>
  isBlockedOnly(pop) ? (
    <>
      <Vignette pop={pop} />
      <HitNumber pop={pop} />
    </>
  ) : (
    <>
      <Vignette pop={pop} />
      {!isCurse(pop) && <Glitch id={pop.id} />}
      <Mark pop={pop} />
      <HitNumber pop={pop} />
    </>
  );

// --- COMPONENT ---
/**
 * Renders the hits landing on you over the whole view, and shakes
 * `shakeRef` (the view) once per new hit.
 */
export const PovImpact = ({
  hits,
  shakeRef,
}: {
  hits: readonly PlayerHitPop[];
  shakeRef: RefObject<HTMLElement | null>;
}) => {
  const landed = hits.filter((pop) => pop.kind === 'hit');
  const newest = landed.at(-1);

  // EACH NEW HIT SHAKES THE VIEW (imperative: an animation to start)
  useEffect(() => {
    if (newest && !isBlockedOnly(newest))
      shake(shakeRef.current, sizeOf(newest));
    // Only a new hit (new id) shakes; its other fields never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newest?.id, shakeRef]);

  return (
    <div
      {...{ [POV_ANCHOR_ATTR]: true }}
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
      aria-hidden="true"
    >
      {landed.map((pop) => (
        <PovHit key={pop.id} pop={pop} />
      ))}
    </div>
  );
};
