// ===================================================================
// MECHANICS LIBRARY (DATA)
// The How to Play "Mechanics" library, grouped into tabs. Every entry
// comes from the shared GLOSSARY (describe.ts), the same table card
// text, chips and tooltips read, so a new keyword or status shows up
// here on its own with no second list to keep in step.
// ===================================================================

import {
  GLOSSARY,
  KEYWORD_INFO,
  STATUS_INFO,
  type StatusInfo,
} from '../../shared/game/describe';

// --- TYPES ---
export type MechanicsTab = 'keywords' | 'statuses' | 'terms';

// --- TABS ---
export const MECHANICS_TABS: readonly MechanicsTab[] = ['keywords', 'statuses', 'terms'];

export const MECHANICS_TAB_LABEL: Readonly<Record<MechanicsTab, string>> = {
  keywords: 'Keywords',
  statuses: 'Statuses',
  terms: 'Other',
};

// --- HELPERS ---
/** Sorts entries A to Z by their printed name. */
const byLabel = (entries: readonly StatusInfo[]): StatusInfo[] =>
  [...entries].sort((a, b) => a.label.localeCompare(b.label));

// Keyword and status names, so "Other" gets everything else in the glossary.
const KEYWORD_LABELS = new Set(Object.values(KEYWORD_INFO).map((info) => info.label));
const STATUS_LABELS = new Set(Object.values(STATUS_INFO).map((info) => info.label));

// --- LIBRARY ---
/** Each tab's entries, A to Z. Keywords win a name shared with a status. */
export const MECHANICS_LIBRARY: Readonly<Record<MechanicsTab, StatusInfo[]>> = {
  keywords: byLabel(Object.values(KEYWORD_INFO)),
  statuses: byLabel(
    Object.values(STATUS_INFO).filter((info) => !KEYWORD_LABELS.has(info.label))
  ),
  terms: byLabel(
    Object.values(GLOSSARY).filter(
      (info) => !KEYWORD_LABELS.has(info.label) && !STATUS_LABELS.has(info.label)
    )
  ),
};
