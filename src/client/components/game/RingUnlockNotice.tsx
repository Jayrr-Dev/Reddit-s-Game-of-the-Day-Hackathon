/** Slot numbers come from this reward or run, independently of earlier unlocks. */
export const RingUnlockNotice = ({ slots }: { slots: readonly number[] }) => {
  if (!slots.length) return null;
  const names = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(slots.map(String));
  return (
    <p role="status" className="rounded-md border border-accent/50 bg-surface-raised px-3 py-1 text-center font-display text-sm font-bold text-accent">
      Ring {slots.length === 1 ? 'slot' : 'slots'} {names} unlocked
    </p>
  );
};
