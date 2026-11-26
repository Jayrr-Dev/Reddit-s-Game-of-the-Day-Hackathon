// ===================================================================
// TINTED WORDS (DATA)
// Plain words that wear a colour wherever text mentions them, bold or
// not. "Affliction" (and "afflictions") reads in the Curse purple, the
// colour Hex and Bane already wear, so the word matches the chips it
// talks about. RichText's TintedText renders these.
// ===================================================================

import { splitAfflictionWords } from '../../shared/game/afflictionWords';

// --- TYPES ---
/** A run of text and, for a tinted word, its colour class. */
export type TintedPart = { text: string; toneClass?: string };

// --- DATA ---
/** The Curse purple (--color-hex), shared with Hex, Bane and Curse. */
export const AFFLICTION_TONE_CLASS = 'text-hex';

// --- HELPERS ---
/** Splits text into plain runs and tinted words, in order. */
export const splitTintedWords = (text: string): TintedPart[] =>
  splitAfflictionWords(text).map(({ text: part, isAffliction }) =>
    isAffliction
      ? { text: part, toneClass: AFFLICTION_TONE_CLASS }
      : { text: part }
  );
