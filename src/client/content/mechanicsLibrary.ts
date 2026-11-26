// ===================================================================
// MECHANICS LIBRARY (DATA)
// The How to Play "Mechanics" library, grouped into tabs. Every entry
// comes from the shared GLOSSARY (describe.ts), and its tab is the
// entry's own `category`, so a new keyword or status lands in the
// right tab on its own with no second list to keep in step.
// ===================================================================

import {
  GLOSSARY,
  STATUS_GROUP_LABEL,
  STATUS_GROUPS,
  type GlossaryCategory,
  type GlossaryEntry,
} from '../../shared/game/describe';

// --- TYPES ---
/** A run of entries under an optional heading ("Buffs"). */
export type MechanicsSection = { heading?: string; entries: GlossaryEntry[] };

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

/** The Statuses tab, split into Buffs, Debuffs and Afflictions. */
const statusSections = (): MechanicsSection[] =>
  STATUS_GROUPS.map((group) => ({
    heading: STATUS_GROUP_LABEL[group],
    entries: entriesIn('status').filter((entry) => entry.group === group),
  }));

/** Each tab's sections; Keywords and Other are one A to Z list. */
export const MECHANICS_LIBRARY: Readonly<Record<GlossaryCategory, MechanicsSection[]>> = {
  keyword: [{ entries: entriesIn('keyword') }],
  status: statusSections(),
  term: [{ entries: entriesIn('term') }],
};
