// ===================================================================
// HIT NUMBERS
// The damage numbers that punch in over the hero that was hit, then
// drift up and fade (see --animate-hit-pop). Several hits on one target
// stack upward instead of overlapping. The number is the whole hit;
// the part a Guard soaked up shows small beside it with a shield. What a hero
// gains from its own move (heal, Shroud, Wrath) pops as "+N" + icon.
// ===================================================================

import type { CardType } from '../../../../shared/game/types';
import {
  CARD_LOOK,
  INTENT_LOOK,
  STATUS_LOOK,
  type Look,
} from '../../../content/visuals';
import type { HitPop, PlayerHitPop, PopKind } from '../../../hooks/useHitPops';
import { popFontPx } from '../../../lib/popSize';
import { Glyph } from '../../ui/Glyph';

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

/** Blocked damage is drawn smaller than damage dealt. */
const BLOCKED_SCALE = 0.65;
/** Gains (heal, Shroud, Wrath) are drawn a little smaller than hits. */
const GAIN_SCALE = 0.75;
/** Icon and colour of each kind of gain, from the shared look tables. */
const GAIN_LOOK: Record<Exclude<PopKind, 'hit'>, Look> = {
  heal: INTENT_LOOK.heal,
  shroud: STATUS_LOOK.shroud,
  wrath: STATUS_LOOK.wrath,
  might: STATUS_LOOK.might,
  surge: STATUS_LOOK.surge,
  piercing: STATUS_LOOK.piercing,
  protection: STATUS_LOOK.protection,
  momentum: STATUS_LOOK.momentum,
};

// --- SUBCOMPONENTS ---
/** The part a Guard soaked up: small and faded, with a shield. */
const BlockedPart = ({
  blocked,
  typical,
}: {
  blocked: number;
  typical: number;
}) => (
  <span className="flex items-center gap-0.5 opacity-80 drop-shadow-[0_0_2px_black]">
    <Glyph name="shield" className="size-[0.9em] text-shroud" />
    <span
      className="font-display font-black text-ink [-webkit-text-stroke:1px_var(--color-surface-sunken)]"
      style={{ fontSize: popFontPx(blocked, typical, BLOCKED_SCALE) }}
    >
      {blocked}
    </span>
  </span>
);

/**
 * One hit. The big number is the whole hit (what the card dealt, buffs
 * and all), so it always matches the card text; the part a Guard
 * soaked up sits small beside it. A hit that was fully blocked is
 * drawn faded, since no HP was lost.
 */
export const HitLine = ({
  amount,
  blocked,
  typical,
  source,
}: {
  /** HP lost. */
  amount: number;
  /** Damage the target's Guard absorbed. */
  blocked: number;
  /** The typical hit when this one landed; sizes it (see popSize). */
  typical: number;
  /** The card type that dealt it, which picks the colour. */
  source?: CardType | undefined;
}) => {
  const total = amount + blocked;
  const isFullyBlocked = amount === 0;
  return (
    <div className="flex items-center gap-1 animate-hit-pop">
      <span
        className={`${NUMBER_CLASS} text-surface-sunken ${isFullyBlocked ? 'opacity-60' : ''}`}
        style={{
          fontSize: popFontPx(total, typical),
          ['--pop-tone' as string]: toneOf(source),
        }}
      >
        {total}
      </span>
      {blocked > 0 && <BlockedPart blocked={blocked} typical={typical} />}
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
  const look = GAIN_LOOK[kind];
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

/** A hit or a gain, whichever the pop is. */
const PopLine = ({ hit }: { hit: PlayerHitPop }) =>
  hit.kind === 'hit' ? (
    <HitLine
      amount={hit.amount}
      blocked={hit.blocked}
      typical={hit.typical}
      source={hit.source}
    />
  ) : (
    <GainLine kind={hit.kind} amount={hit.amount} typical={hit.typical} />
  );

/**
 * Several pops on one target, stacked: the newest sits at the bottom
 * and pushes older ones up while they fade, so numbers never overlap.
 */
export const HitStack = ({ hits }: { hits: readonly PlayerHitPop[] }) => (
  <div className="flex flex-col-reverse items-center">
    {[...hits].reverse().map((hit) => (
      <PopLine key={hit.id} hit={hit} />
    ))}
  </div>
);

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
        <div
          key={latest.uid}
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ left: latest.point.x, top: latest.point.y + 24 }}
        >
          <HitStack hits={group} />
        </div>
      );
    })}
  </div>
);
