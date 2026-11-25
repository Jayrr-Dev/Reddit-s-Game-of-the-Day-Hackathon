// ===================================================================
// POV IMPACT
// When a hero's attack lands on you, it lands on the screen itself, as
// if you were looking out of the villain's eyes. Every hit draws:
//   HURT LAYER   a vignette closing in from the edges (blood red; Magic
//                blue and Range grey running into red; Hex purple for a
//                curse), and a shake of the whole view,
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
import { BurnEffect } from './BurnEffect';
import { PoisonEffect } from './PoisonEffect';
import { CurseSigil } from './CurseSigil';
import { StatusFx } from './StatusFx';
import { HitLine } from './HitNumbers';
import { specialToneOf } from '../../../lib/popTone';
import { ELEMENT_LOOK } from '../../../content/visuals';
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
/** Blood red: every hurt's outer edge (and all of a Melee one). */
const HURT_TONE = 'rgb(200 20 40 / 0.6)';
/**
 * The inner band of the vignette, by attack type, fading out into the
 * blood-red edge: Magic blue, Range a steel grey.
 */
const TYPE_TONE: Partial<Record<string, string>> = {
  magic: 'rgb(60 130 255 / 0.3)',
  range: 'rgb(150 155 165 / 0.3)',
};
/** A fully blocked hit only shades the edges a faint black. */
const BLOCKED_TONE = 'rgb(0 0 0 / 0.55)';
const BLOCKED_PEAK = 0.5;
/** A curse's vignette: Hex purple. */
const CURSE_TONE = 'rgb(130 60 200 / 0.8)';
/** How strong the vignette gets: at least this, more for big hits. */
const VIGNETTE_MIN = 0.3;
const VIGNETTE_PER_SCALE = 0.2;
/** The shake: pixels per unit of hit size, and how long it lasts. */
const SHAKE_PX_PER_SCALE = 6;
const SHAKE_MS = 360;

// --- HELPERS ---
/**
 * True for Hex going off: harm with no attack behind it, which is Hex
 * unless another status (Poison, Burn, Bleed) is named as the tick.
 * Those used to fall in here too and drew the Hex sigil by mistake.
 */
const isHexTick = (pop: PlayerHitPop): boolean =>
  pop.source === undefined && (pop.tick === undefined || pop.tick === 'hex');

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
  if (pop.tick && !isHexTick(pop))
    return (
      <span
        className="absolute aspect-square w-[62%] -translate-1/2"
        style={{ left: '50%', top: '50%' }}
      >
        <StatusFx kind={pop.tick} id={pop.id} />
      </span>
    );
  if (isHexTick(pop))
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
        <MagicBurst id={seed} element={pop.element} />
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

/**
 * The vignette's colour stops, centre outward: a faint black for a
 * blocked hit, purple for Hex going off, else the attack type's tone (if
 * any) running into blood red.
 */
const toneStopsOf = (pop: PlayerHitPop): string => {
  if (isBlockedOnly(pop)) return `${BLOCKED_TONE} 100%`;
  if (isHexTick(pop)) return `${CURSE_TONE} 100%`;
  const typeTone = pop.element
    ? `color-mix(in srgb, ${ELEMENT_LOOK[pop.element].energy} 30%, transparent)`
    : TYPE_TONE[pop.source ?? ''];
  return typeTone ? `${typeTone} 78%, ${HURT_TONE} 100%` : `${HURT_TONE} 100%`;
};

/** How many streaks the vignette's edge breaks into. */
const STREAK_COUNT = 64;

/**
 * The vignette's texture: a mask of streaks around the centre, each of
 * its own width and strength (seeded by the hit), so the edge closes in
 * as ragged rays instead of a smooth ring, and no two hits match.
 * A static mask, so it costs nothing while the vignette fades.
 */
const streakMaskOf = (seed: number): string => {
  const widths = Array.from(
    { length: STREAK_COUNT },
    (_, index) => 0.4 + seeded(seed + index, 11)
  );
  const total = widths.reduce((sum, width) => sum + width, 0);
  let angle = 0;
  const stops = widths.map((width, index) => {
    const from = angle;
    angle += (width / total) * 360;
    const alpha = (0.15 + 0.85 * seeded(seed + index, 12)).toFixed(2);
    return `rgb(0 0 0 / ${alpha}) ${from.toFixed(1)}deg ${angle.toFixed(1)}deg`;
  });
  return `conic-gradient(from ${seeded(seed, 13) * 360}deg, ${stops.join(', ')})`;
};

/**
 * The edges closing in, in the hit's tones (see toneStopsOf), torn into
 * streaks (see streakMaskOf).
 */
const Vignette = ({ pop }: { pop: PlayerHitPop }) => {
  const mask = streakMaskOf(seedOf(pop));
  const peak = isBlockedOnly(pop)
    ? BLOCKED_PEAK
    : Math.min(1, VIGNETTE_MIN + VIGNETTE_PER_SCALE * sizeOf(pop));
  return (
    <span
      className="pov-vignette absolute inset-0"
      style={
        {
          background: `radial-gradient(ellipse at center, transparent 52%, ${toneStopsOf(pop)})`,
          maskImage: mask,
          WebkitMaskImage: mask,
          '--pov-peak': peak,
        } as CSSProperties
      }
    />
  );
};

/**
 * The damage number stays on the blow's mark.
 */
const HitNumber = ({ pop }: { pop: PlayerHitPop }) => (
  <span
    className="absolute -translate-1/2 whitespace-nowrap"
    style={markPlace(seedOf(pop))}
  >
    <HitLine
      amount={pop.amount}
      blocked={pop.blocked}
      typical={pop.typical}
      source={pop.source}
      tone={specialToneOf(pop)}
      armored={pop.armored}
      isKill={pop.isKill}
    />
  </span>
);

/**
 * Everything one hit draws on the screen, its number on top. A hit
 * your Guard took whole only shades the edges a faint black: no mark
 * or shake.
 */
const PovHit = ({ pop }: { pop: PlayerHitPop }) =>
  isBlockedOnly(pop) ? (
    <>
      <Vignette pop={pop} />
      <HitNumber pop={pop} />
    </>
  ) : (
    <>
      {pop.tick !== 'burn' && pop.tick !== 'poison' && <><Vignette pop={pop} /><Mark pop={pop} /></>}
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
  const burnFlare = hits.findLast(pop => pop.tick === 'burn' && pop.amount > 0);
  const poisonFlare = hits.findLast(pop => pop.tick === 'poison' && pop.amount > 0);

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
      {burnFlare && <BurnEffect key={burnFlare.id} screen />}
      {poisonFlare && <PoisonEffect key={poisonFlare.id} screen />}
      {landed.map((pop) => (
        <PovHit key={pop.id} pop={pop} />
      ))}
    </div>
  );
};
