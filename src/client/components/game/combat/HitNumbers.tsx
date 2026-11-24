// ===================================================================
// HIT NUMBERS
// The damage numbers that punch in over the hero that was hit, then
// drift up, swelling as they fade (see --animate-hit-pop). Several hits on one target
// pile up like in action games: each lands near the same spot with a
// small random nudge and tilt, the newest drawn on top, while the ones
// under it dim so the fresh number always reads first. The number is the HP
// lost; the part a Guard soaked up shows beside it as a grey shield number. What a hero
// gains from its own move (heal, Guard, Wrath) pops as "+N" + icon.
// ===================================================================

import type { CSSProperties } from 'react';
import type { CardType } from '../../../../shared/game/types';
import { CARD_LOOK, POP_LOOK } from '../../../content/visuals';
import type { HitPop, PlayerHitPop, PopKind } from '../../../hooks/useHitPops';
import { ImpactOverlay } from './ImpactOverlay';
import { popFontPx } from '../../../lib/popSize';
import { driftOf } from '../../../lib/popDrift';
import { spread } from '../../../lib/seeded';
import { Glyph } from '../../ui/Glyph';

// --- TYPES ---
/** Where a pile sits on its anchor point. */
type PileAlign = 'center' | 'start';

// --- CONSTANTS ---
/**
 * The outlined look of the damage number. The outline and glow colour
 * comes from --pop-tone: the card type's colour (CARD_LOOK.glowVar, the
 * same colour the card itself glows), or blood red for untyped hits.
 */
const NUMBER_CLASS =
  'font-display font-black [paint-order:stroke_fill] [-webkit-text-stroke:5px_var(--pop-tone)] [text-shadow:0_0_12px_var(--pop-tone)]';
/** Hits with no card type (the heroes' attacks on you). */
const UNTYPED_TONE = 'var(--color-hp)';

/** The colour a hit is drawn in. */
const toneOf = (source?: CardType): string =>
  `color-mix(in oklab, ${source ? CARD_LOOK[source].glowVar : UNTYPED_TONE} ${TONE_STRENGTH}, white)`;
/**
 * How much of the type colour the outline keeps; the rest is white, so
 * numbers read a little brighter than the card glow they match.
 */
const TONE_STRENGTH = '78%';

/** How far (px) a piled number may land from its spot, each way. */
const PILE_JITTER_X_PX = 8;
const PILE_JITTER_Y_PX = 5;
/**
 * Each later hit in a burst steps this far (px) right and up from the
 * last, so a fast multi-hit cascades into a readable, overlapping run
 * instead of landing exactly on itself. The run restarts every
 * PILE_RUN hits so long bursts stay near the target.
 */
const PILE_STEP_X_PX = 13;
const PILE_STEP_Y_PX = 9;
const PILE_RUN = 4;
/** How far (deg) a piled number may tilt, each way. */
const PILE_TILT_DEG = 7;
/** Gains sit this far (px) above the hits so the two never collide. */
const GAIN_LIFT_PX = 34;
/** How much a number covered by newer ones dims. */
const BURIED_OPACITY = 0.55;

/** Blocked damage is drawn smaller than damage dealt. */
const BLOCKED_SCALE = 0.65;
/** Gains (heal, Guard, Wrath) are drawn a little smaller than hits. */
const GAIN_SCALE = 0.75;

// --- SUBCOMPONENTS ---
/**
 * The part a Guard soaked up: a grey shield and number beside the HP
 * loss. `scale` sizes it (small next to an HP number, full size when
 * Guard took the whole hit).
 */
const BlockedPart = ({
  blocked,
  typical,
  scale,
}: {
  blocked: number;
  typical: number;
  scale: number;
}) => (
  <span className="flex items-center gap-0.5 opacity-85 drop-shadow-[0_0_2px_black]">
    <Glyph name="shield" className="size-[0.9em] text-guard" />
    <span
      className="font-display font-black text-ink [-webkit-text-stroke:1px_var(--color-surface-sunken)]"
      style={{ fontSize: popFontPx(blocked, typical, scale) }}
    >
      {blocked}
    </span>
  </span>
);

/**
 * One hit. The big number is the HP actually lost, after Guard, so it
 * always matches the health bar; the part a Guard soaked up sits beside
 * it as a grey shield number. A hit Guard took whole shows only the
 * shield number, since no HP was lost.
 */
export const HitLine = ({
  amount,
  blocked,
  typical,
  source,
  isKill = false,
}: {
  /** HP lost past Guard (overkill included, so it can exceed HP left). */
  amount: number;
  /** Damage the target's Guard absorbed. */
  blocked: number;
  /** The typical hit when this one landed; sizes it (see popSize). */
  typical: number;
  /** The card type that dealt it, which picks the colour. */
  source?: CardType | undefined;
  /** True when the hit felled its target: a black skull follows it. */
  isKill?: boolean | undefined;
}) => {
  const isFullyBlocked = amount === 0;
  const fontSize = popFontPx(amount, typical);
  const tone = toneOf(source);
  if (isFullyBlocked) {
    return (
      <div className="flex items-center animate-hit-pop">
        <BlockedPart blocked={blocked} typical={typical} scale={1} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 animate-hit-pop">
      <span
        className={`${NUMBER_CLASS} text-surface-sunken`}
        style={{ fontSize, ['--pop-tone' as string]: tone }}
      >
        {amount}
      </span>
      {/* KILLING BLOW: a black skull outlined in the hit's colour */}
      {isKill && (
        <span
          className="text-black [filter:drop-shadow(0_0_1.5px_var(--pop-tone))_drop-shadow(0_0_1.5px_var(--pop-tone))_drop-shadow(0_0_6px_var(--pop-tone))]"
          style={{ fontSize, ['--pop-tone' as string]: tone }}
        >
          <Glyph name="skull" className="size-[0.8em]" />
        </span>
      )}
      {blocked > 0 && (
        <BlockedPart
          blocked={blocked}
          typical={typical}
          scale={BLOCKED_SCALE}
        />
      )}
    </div>
  );
};

/** One gain: "+N" with its icon, in its colour. */
const GainLine = ({
  kind,
  amount,
  typical,
}: {
  kind: PopKind;
  amount: number;
  typical: number;
}) => {
  if (kind === 'hit') return null;
  const look = POP_LOOK[kind];
  // OUT OF RANGE: the shot missed, so the word replaces a number.
  if (kind === 'miss')
    return (
      <div
        className={`font-display font-black uppercase whitespace-nowrap animate-hit-pop drop-shadow-[0_1px_2px_black] ${look.toneClass}`}
        style={{ fontSize: popFontPx(typical, typical, GAIN_SCALE) }}
      >
        Miss
      </div>
    );
  return (
    <div
      className={`flex items-center gap-0.5 font-display font-black whitespace-nowrap animate-hit-pop drop-shadow-[0_1px_2px_black] ${look.toneClass}`}
      style={{ fontSize: popFontPx(amount, typical, GAIN_SCALE) }}
    >
      {`+${amount}`}
      <Glyph name={look.glyph} className="size-[0.8em]" />
    </div>
  );
};

/** A hit or a gain, whichever the pop is (quiet pops show no number). */
const PopLine = ({ hit }: { hit: PlayerHitPop }) =>
  hit.isQuiet ? null : hit.kind === 'hit' ? (
    <HitLine
      amount={hit.amount}
      blocked={hit.blocked}
      typical={hit.typical}
      source={hit.source}
      isKill={hit.isKill}
    />
  ) : (
    <GainLine kind={hit.kind} amount={hit.amount} typical={hit.typical} />
  );

/**
 * Where one pop lands in the pile: its step in the cascade, plus a
 * stable nudge and tilt from its id (so it never jumps on re-render).
 * Gains float a little higher.
 */
const pileStyleOf = (
  hit: PlayerHitPop,
  index: number,
  align: PileAlign
): CSSProperties => {
  // CASCADE: centred runs step from left of the spot to right of it;
  // from the left edge they only step right, so nothing is cut off.
  const step = index % PILE_RUN;
  const centring = align === 'center' ? (PILE_RUN - 1) / 2 : 0;
  const nudge = spread(hit.id, 1) * PILE_JITTER_X_PX;
  const dx = (step - centring) * PILE_STEP_X_PX + nudge;
  const base = align === 'center' ? '-50%' : '0px';
  const lift = hit.kind === 'hit' ? 0 : GAIN_LIFT_PX;
  const dy =
    spread(hit.id, 2) * PILE_JITTER_Y_PX - step * PILE_STEP_Y_PX - lift;
  const tilt = spread(hit.id, 3) * PILE_TILT_DEG;
  return {
    transform: `translate(calc(${base} + ${dx}px), ${dy}px) rotate(${tilt}deg)`,
  };
};

/**
 * Several pops on one target, piled: each is placed at the same spot
 * (plus its nudge), later ones on top. A number with a newer one over
 * it dims, so the stack reads newest-first like an action game's.
 */
export const HitStack = ({
  hits,
  align = 'center',
  isDrifting = false,
}: {
  hits: readonly PlayerHitPop[];
  /** Centre the pile on its anchor, or start it there (near an edge). */
  align?: PileAlign;
  /** True to float each number off left, up or right at random. */
  isDrifting?: boolean;
}) => {
  const newestId = hits[hits.length - 1]?.id;
  return (
    <div className="relative">
      {hits.map((hit, index) => (
        <div
          key={hit.id}
          className={`absolute bottom-0 whitespace-nowrap transition-opacity duration-150 ${align === 'center' ? 'left-1/2' : 'left-0'}`}
          style={{
            ...pileStyleOf(hit, index, align),
            ...(isDrifting ? driftOf(hit.id) : {}),
            zIndex: index,
            opacity: hit.id === newestId ? 1 : BURIED_OPACITY,
          }}
        >
          <PopLine hit={hit} />
        </div>
      ))}
    </div>
  );
};

/** Groups pops by hero, in the order they happened. */
const popsByHero = (pops: readonly HitPop[]): HitPop[][] => [
  ...pops
    .reduce((groups, pop) => {
      groups.set(pop.uid, [...(groups.get(pop.uid) ?? []), pop]);
      return groups;
    }, new Map<number, HitPop[]>())
    .values(),
];

// --- COMPONENT ---
/**
 * Renders the current damage numbers over their heroes; each hero's
 * stack is anchored at its latest hit point and grows upward.
 */
export const HitNumbers = ({ pops }: { pops: HitPop[] }) => (
  <div className="pointer-events-none fixed inset-0 z-40">
    {popsByHero(pops).map((group) => {
      const latest = group[group.length - 1];
      if (!latest) return null;
      return (
        <div key={latest.uid}>
          {/* EFFECTS OVER THE BODY (under the numbers) */}
          <div
            className="absolute size-28 -translate-x-1/2 -translate-y-1/2"
            style={{ left: latest.point.x, top: latest.point.y }}
          >
            <ImpactOverlay pops={group} />
          </div>
          <div
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: latest.point.x, top: latest.point.y + 24 }}
          >
            <HitStack hits={group} />
          </div>
        </div>
      );
    })}
  </div>
);
