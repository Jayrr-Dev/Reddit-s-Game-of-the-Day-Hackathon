// ===================================================================
// USE NEW ITEMS
// Counts rings and amulets the player hasn't looked at yet, for the
// badge on the Equipment tab. "Seen" is a per-device convenience, so it
// lives in localStorage; losing it only shows the badge once more.
// ===================================================================
import { useState } from 'react';

// --- STORAGE ---
const SEEN_KEY = 'villain-run:seen-items';

/** Reads the ids already seen on this device. */
const readSeen = (): string[] => {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

/** Saves the seen ids; a blocked storage just keeps them for this visit. */
const writeSeen = (ids: readonly string[]) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or blocked storage: nothing to do.
  }
};

// --- HOOK ---
/** How many owned items are new, and a way to mark them all seen. */
export function useNewItems(ownedIds: readonly string[]) {
  const [seen, setSeen] = useState(readSeen);
  const newCount = ownedIds.filter((id) => !seen.includes(id)).length;
  /** Marks every owned item seen (called when the Equipment tab opens). */
  const markSeen = () => {
    if (newCount === 0) return;
    const next = [...new Set([...seen, ...ownedIds])];
    writeSeen(next);
    setSeen(next);
  };
  return { newCount, markSeen } as const;
}
