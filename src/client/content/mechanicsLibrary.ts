// ===================================================================
// MECHANICS LIBRARY (DATA)
// The How to Play "Mechanics" library, grouped into tabs. Every entry
// comes from the shared GLOSSARY (describe.ts), and its tab is the
// entry's own `category`, so a new keyword or status lands in the
// right tab on its own with no second list to keep in step.
// ===================================================================

import {
  GLOSSARY,
  type GlossaryCategory,
  type GlossaryEntry,
} from '../../shared/game/describe';

// --- TABS ---
export const MECHANICS_TABS: readonly GlossaryCategory[] = ['keyword', 'status', 'term'];

export const MECHANICS_TAB_LABEL: Readonly<Record<GlossaryCategory, string>> = {
  keyword: 'Keywords',
  status: 'Statuses',
  term: 'Other',
};

// --- LIBRARY ---
/** The entries of one tab, A to Z by printed name. */
const entriesIn = (category: GlossaryCategory): GlossaryEntry[] =>
  Object.values(GLOSSARY)
    .filter((entry) => entry.category === category)
    .sort((a, b) => a.label.localeCompare(b.label));

/** Each tab's entries, A to Z. */
export const MECHANICS_LIBRARY: Readonly<Record<GlossaryCategory, GlossaryEntry[]>> = {
  keyword: entriesIn('keyword'),
  status: entriesIn('status'),
  term: entriesIn('term'),
};
