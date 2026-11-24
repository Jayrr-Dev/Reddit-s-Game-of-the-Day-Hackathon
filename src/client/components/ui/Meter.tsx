// ===================================================================
// METER (ATOM)
// A horizontal bar for HP, with an optional guard overlay label.
// ===================================================================

export type MeterProps = {
  value: number;
  max: number;
  /** Tailwind background class for the fill, e.g. "bg-hp". */
  fillClass: string;
  /** Text shown over the bar, e.g. "42 / 60". */
  label: string;
};

/** Renders a filled bar sized to value / max. */
export const Meter = ({ value, max, fillClass, label }: MeterProps) => {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="relative h-4 w-full overflow-hidden rounded-full bg-surface-sunken ring-1 ring-edge">
      <div
        className={`h-full ${fillClass} transition-[width] duration-300`}
        style={{ width: `${percent}%` }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink">
        {label}
      </span>
    </div>
  );
};
