// ===================================================================
// AFFLICTION WORDS (PURE HELPER)
// Finds the word "affliction" (any case, singular or plural) in rules
// text, so the client can tint every mention in the Curse purple.
// Kept here, free of UI, so the matching is unit tested.
// ===================================================================

// --- TYPES ---
/** A run of text, flagged when it is an affliction word. */
export type AfflictionPart = { text: string; isAffliction: boolean };

// --- DATA ---
/**
 * Whole words only: "Affliction", "afflictions". One capture group,
 * so split() keeps each match as its own piece.
 */
const AFFLICTION_WORD = /\b(afflictions?)\b/gi;

// --- HELPERS ---
/** True when the word is "affliction" or "afflictions", any case. */
export const isAfflictionWord = (word: string): boolean =>
  /^afflictions?$/i.test(word);

/** Splits text into plain runs and affliction words, in order. */
export const splitAfflictionWords = (text: string): AfflictionPart[] =>
  text
    .split(AFFLICTION_WORD)
    .filter((piece) => piece !== '')
    .map((piece) => ({ text: piece, isAffliction: isAfflictionWord(piece) }));
