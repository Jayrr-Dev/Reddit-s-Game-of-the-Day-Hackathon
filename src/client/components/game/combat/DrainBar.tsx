// ===================================================================
// DRAIN BAR
// An HP bar split around a centre emblem that drains from both outer
// ends toward the middle. When HP drops, the lost part flashes as a
// bright "recent damage" chunk that catches up a moment later, so a
// hit reads at a glance. The emblem in the middle shows the number.
// Used big for the targeted hero (top of the screen) and small on
// every hero's plate.
// ===================================================================

// --- TYPES ---
export type DrainBarSize = 'small' | 'large';

export type DrainBarProps = {
  hp: number;
  maxHp: number;
  size: DrainBarSize;
};

// --- CONSTANTS ---
/** Bar and emblem proportions per size. */
const LOOK: Record<DrainBarSize, { bar: string; emblem: string }> = {
  small: { bar: 'h-1.5', emblem: 'h-5 w-7 text-[10px]' },
  large: { bar: 'h-3', emblem: 'h-11 w-14 text-xl' },
};

// --- SUBCOMPONENTS ---
/**
 * One half of the bar. Both layers are anchored at the centre (the
 * left half is mirrored), so shrinking the width drains toward the
 * middle. The chunk layer lags behind the live layer (CSS delay).
 */
const Half = ({
  percent,
  side,
}: {
  percent: number;
  side: 'left' | 'right';
}) => (
  <div
    className={`relative flex h-full flex-1 overflow-hidden ${side === 'left' ? 'justify-end rounded-l-full' : 'rounded-r-full'}`}
  >
    <div
      className="absolute inset-y-0 bg-accent-hover transition-[width] delay-300 duration-500 ease-out"
      style={{ width: `${percent}%`, [side === 'left' ? 'right' : 'left']: 0 }}
    />
    <div
      className="absolute inset-y-0 bg-hp transition-[width] duration-150"
      style={{ width: `${percent}%`, [side === 'left' ? 'right' : 'left']: 0 }}
    />
  </div>
);

// --- COMPONENT ---
/** Renders the split bar with the HP number in a shield at its centre. */
export const DrainBar = ({ hp, maxHp, size }: DrainBarProps) => {
  const percent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const look = LOOK[size];
  return (
    <div
      className={`relative flex rounded-full bg-surface-sunken ring-1 ring-accent/50 ${look.bar}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={maxHp}
      aria-valuenow={hp}
    >
      <Half percent={percent} side="left" />
      <Half percent={percent} side="right" />
      <div
        className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-surface-raised pb-1 font-display font-black ring-1 ring-accent/70 [clip-path:polygon(0_0,100%_0,100%_60%,50%_100%,0_60%)] ${look.emblem}`}
      >
        <span className="num-center">{hp}</span>
      </div>
    </div>
  );
};
