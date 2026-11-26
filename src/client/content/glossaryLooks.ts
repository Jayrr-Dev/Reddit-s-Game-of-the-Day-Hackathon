// ===================================================================
// GLOSSARY LOOKS (DATA)
// The icon and colour of every glossary word, by the name it is
// printed with ("Frost", "Piercing", "Melee"). Tooltips use it to put
// a term's icon by its title and beside every bold mention of it, so
// the words read like the chips and badges they explain. Built from
// the same look tables the chips use, so a term looks the same
// everywhere.
// ===================================================================

import {
  CLEANSE_INFO,
  DISPEL_INFO,
  DISRUPT_INFO,
  PULL_INFO,
  KNOCKBACK_INFO,
  HOMING_INFO,
  RANDOMLY_INFO,
  IMBUE_INFO,
  KEYWORD_INFO,
  OUT_OF_RANGE_INFO,
  PASSIVE_INFO,
  ROW_INFO,
  STATUS_INFO,
} from '../../shared/game/describe';
import {
  INTENT_LOOK,
  KEYWORD_LOOK,
  OUT_OF_RANGE_LOOK,
  PASSIVE_LOOK,
  STATUS_LOOK,
  type Look,
} from './visuals';

// --- HELPERS ---
/** Pairs each entry's printed name with its look, by shared key. */
const byLabel = <K extends string>(
  infos: Record<K, { label: string }>,
  looks: Record<K, Look>
): [string, Look][] =>
  (Object.keys(infos) as K[]).map((key) => [infos[key].label, looks[key]]);

// --- TABLE ---
const GLOSSARY_LOOK: ReadonlyMap<string, Look> = new Map([
  ...byLabel(STATUS_INFO, STATUS_LOOK),
  ...byLabel(KEYWORD_INFO, KEYWORD_LOOK),
  ...byLabel(PASSIVE_INFO, PASSIVE_LOOK),
  [IMBUE_INFO.label, { glyph: 'cards', toneClass: 'text-imbue' }],
  [CLEANSE_INFO.label, INTENT_LOOK.cleanse],
  [DISPEL_INFO.label, INTENT_LOOK.dispel],
  [DISRUPT_INFO.label, INTENT_LOOK.disrupt],
  [PULL_INFO.label, { glyph: 'march', toneClass: 'text-hex' }],
  [KNOCKBACK_INFO.label, { glyph: 'march', toneClass: 'text-guard' }],
  [HOMING_INFO.label, { glyph: 'targeting', toneClass: 'text-magic' }],
  [RANDOMLY_INFO.label, { glyph: 'targeting', toneClass: 'text-energy' }],
  // Card types tooltips mention. Charge and Back Step are left out on
  // purpose: Sam wants them plain bold white wherever they are named.
  ['Melee', INTENT_LOOK.attack],
  ['Range', INTENT_LOOK.range],
  ['Magic', INTENT_LOOK.magic],
  // The rows: Frontline to Backline (Backline is Out of Range, faded).
  ...Object.values(ROW_INFO).map((info): [string, Look] => [
    info.label,
    { glyph: 'march', toneClass: 'text-ink-muted' },
  ]),
  [OUT_OF_RANGE_INFO.label, OUT_OF_RANGE_LOOK],
]);

/** The look of a glossary word, if it is one. */
export const lookOfTerm = (term: string): Look | undefined =>
  GLOSSARY_LOOK.get(term);
