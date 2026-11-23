// ===================================================================
// HIT NUMBERS
// The damage numbers that punch in over the hero that was hit, then
// drift up and fade (see --animate-hit-pop). Several hits on one target
// stack upward instead of overlapping. Damage a shroud soaked up
// shows beside it, struck through and faded, with a shield. What a hero
// gains from its own move (heal, Shroud, Wrath) pops as "+N" + icon.
// ===================================================================

import { INTENT_LOOK, STATUS_LOOK, type Look } from '../../../content/visuals';
import type { Hit, HitPop, PopKind } from '../../../hooks/useHitPops';
import { popFontPx } from '../../../lib/popSize';
import { Glyph } from '../../ui/Glyph';

// --- CONSTANTS ---
/** The red-outlined look of the damage number. */
const NUMBER_CLASS =
  'font-display font-black [-webkit-text-stroke:1.5px_var(--color-hp)] [text-shadow:0_0_10px_var(--color-hp)]';

/** Blocked damage is drawn smaller than damage dealt. */
const BLOCKED_SCALE = 0.65;
/** Gains (heal, Shroud, Wrath) are drawn a little smaller than hits. */
const GAIN_SCALE = 0.75;
/** Icon and colour of each kind of gain, from the shared look tables. */
const GAIN_LOOK: Record<Exclude<PopKind, 'hit'>, Look> = {
  heal: INTENT_LOOK.heal,
  shroud: STATUS_LOOK.shroud,
  wrath: STATUS_LOOK.wrath,
};

// --- SUBCOMPONENTS ---
/** The faded, struck-through blocked amount with its shield. */
const BlockedPart = ({ blocked }: { blocked: number }) => (
  <span className="flex items-center gap-0.5 opacity-70 drop-shadow-[0_0_2px_black]">
    <span
      className="font-display font-black text-ink [-webkit-text-stroke:1px_var(--color-surface-sunken)] line-through decoration-hp decoration-[3px]"
      style={{ fontSize: popFontPx(blocked, BLOCKED_SCALE) }}
    >
      {blocked}
    </span>
    <Glyph name="shield" className="size-[0.8em] text-ink" />
  </span>
);

/** One hit: the damage dealt, then any blocked part beside it. */
export const HitLine = ({
  amount,
  blocked,
}: {
  amount: number;
  blocked: number;
}) => (
  <div className="flex items-center gap-1 animate-hit-pop">
    {amount > 0 && (
      <span
        className={`${NUMBER_CLASS} text-surface-sunken`}
        style={{ fontSize: popFontPx(amount) }}
      >
        {amount}
      </span>
    )}
    {blocked > 0 && <BlockedPart blocked={blocked} />}
  </div>
);

/** One gain: "+N" with its icon, in its colour. */
const GainLine = ({ kind, amount }: { kind: PopKind; amount: number }) => {
  if (kind === 'hit') return null;
  const look = GAIN_LOOK[kind];
  return (
    <div
      className={`flex items-center gap-0.5 font-display font-black whitespace-nowrap animate-hit-pop drop-shadow-[0_1px_2px_black] ${look.toneClass}`}
      style={{ fontSize: popFontPx(amount, GAIN_SCALE) }}
    >
      {`+${amount}`}
      <Glyph name={look.glyph} className="size-[0.8em]" />
    </div>
  );
};

/** A hit or a gain, whichever the pop is. */
const PopLine = ({ hit }: { hit: Hit }) =>
  hit.kind === 'hit' ? (
    <HitLine amount={hit.amount} blocked={hit.blocked} />
  ) : (
    <GainLine kind={hit.kind} amount={hit.amount} />
  );

/**
 * Several pops on one target, stacked: the newest sits at the bottom
 * and pushes older ones up while they fade, so numbers never overlap.
 */
export const HitStack = ({
  hits,
}: {
  hits: readonly (Hit & { id: number })[];
}) => (
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
