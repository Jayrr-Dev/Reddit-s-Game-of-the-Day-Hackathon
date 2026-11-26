// ===================================================================
// TAB BAR (ATOM)
// A row of pill tabs, one per id, with the chosen one lit. The training
// picker and the unit info window share it so their tabs look alike.
// ===================================================================

// --- TYPES ---
type TabBarProps<T extends string> = {
  /** Tab ids in display order. */
  ids: readonly T[];
  labels: Readonly<Record<T, string>>;
  tab: T;
  onTab: (tab: T) => void;
  className?: string;
};

// --- COMPONENT ---
/** Renders the tabs in equal columns; tapping one selects it. */
export const TabBar = <T extends string>({ ids, labels, tab, onTab, className = '' }: TabBarProps<T>) => (
  <div
    className={'training-tabs grid gap-1 ' + className}
    style={{ gridTemplateColumns: `repeat(${ids.length}, minmax(0, 1fr))` }}
    role="tablist"
  >
    {ids.map((id) => (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={tab === id}
        onClick={() => onTab(id)}
        className={`rounded-full px-0.5 py-0.5 text-[10px] font-bold uppercase tracking-normal transition sm:px-1 sm:text-xs sm:tracking-widest ${tab === id ? 'bg-accent text-on-accent' : 'text-ink/60 hover:text-ink'}`}
      >
        {labels[id]}
      </button>
    ))}
  </div>
);
