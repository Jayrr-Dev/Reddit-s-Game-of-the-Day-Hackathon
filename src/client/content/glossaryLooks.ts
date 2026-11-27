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
  IDEAL_RANGE_INFO,
  PASSIVE_INFO,
  ROW_INFO,
  STATUS_INFO,
} from '../../shared/game/describe';
import {
  CARD_LOOK,
  INTENT_LOOK,
  KEYWORD_LOOK,
  OUT_OF_RANGE_LOOK,
  PASSIVE_LOOK,
  STATUS_LOOK,
  type Look,
} from './visuals';
import { AFFLICTION_TONE_CLASS } from './tintedWords';

// --- HELPERS ---
/** Pairs each entry's printed name with its look, by shared key. */
const byLabel = <K extends string>(
  infos: Record<K, { label: string }>,
  looks: Record<K, Look>
): [string, Look][] =>
  (Object.keys(infos) as K[]).map((key) => [infos[key].label, looks[key]]);

// --- MOVEMENT TERMS ---
/**
 * Charge and Back Step read white with the Movement card type's foot
 * icon, so they read as movements. Listed after the keywords so they
 * win over the Charge keyword's own look.
 */
const MOVEMENT_TERM_LOOK: Look = {
  glyph: CARD_LOOK.movement.glyph,
  toneClass: 'text-ink',
};

// --- AFFLICTION TERM ---
/** A bold "Affliction" wears the Curse purple and skull, like Hex. */
const AFFLICTION_TERM_LOOK: Look = {
  glyph: 'skull',
  toneClass: AFFLICTION_TONE_CLASS,
};

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
  // Card types and movements tooltips mention.
  ['Melee', INTENT_LOOK.attack],
  ['Range', INTENT_LOOK.range],
  ['Magic', INTENT_LOOK.magic],
  ['Healing', INTENT_LOOK.heal],
  ['healing', INTENT_LOOK.heal],
  // The rows: Frontline to Backline (Backline is Out of Range, faded).
  ...Object.values(ROW_INFO).map((info): [string, Look] => [
    info.label,
    { glyph: 'march', toneClass: 'text-ink-muted' },
  ]),
  [IDEAL_RANGE_INFO.label, INTENT_LOOK.range],
  [OUT_OF_RANGE_INFO.label, OUT_OF_RANGE_LOOK],
  ['Charge', MOVEMENT_TERM_LOOK],
  ['Back Step', MOVEMENT_TERM_LOOK],
  ['Affliction', AFFLICTION_TERM_LOOK],
  ['Afflictions', AFFLICTION_TERM_LOOK],
]);

/** The look of a glossary word, if it is one. */
export const lookOfTerm = (term: string): Look | undefined =>
  GLOSSARY_LOOK.get(term);

// --- TERMS IN PLAIN TEXT ---
/**
 * Glossary words that are also everyday verbs ("Move 1 line", "Use it
 * twice"), so they are only coloured when the text bolds them.
 */
const VERB_TERMS: ReadonlySet<string> = new Set([
  'Use',
  'Move',
  'Hold',
  'Remove',
]);

/** Escapes a term for use inside a regular expression. */
const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every glossary word as a whole word, case-sensitive (terms are
 * capitalised, so "frost" in a sentence stays plain). Longest first,
 * so "Out of Range" wins over "Range".
 */
const TERM_PATTERN = new RegExp(
  `\\b(${[...GLOSSARY_LOOK.keys()]
    .filter((term) => !VERB_TERMS.has(term))
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .concat('[Ee]nergy')
    .join('|')})\\b`
);

/**
 * Splits plain text around the glossary words it names, so each can
 * wear its colour and icon (odd parts are terms).
 */
export const splitGlossaryTerms = (text: string): string[] =>
  text.split(TERM_PATTERN);
