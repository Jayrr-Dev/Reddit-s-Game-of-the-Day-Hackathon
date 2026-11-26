// ===================================================================
// NUMBER PARTS
// Splits a line of move text around its numbers ("6", "4×4=16", "25%")
// so the UI can draw the numbers bold and bright. Shared by the unit
// info window and the intent popovers so both read the same way.
// ===================================================================

// --- CONSTANTS ---
/** A number, a multiplication sum (4×3=12) or a percentage. */
const NUMBER_PATTERN = /(\d+(?:[×=]\d+)*%?)/;

// --- HELPERS ---
/** One piece of a line: plain text, or a number to stand out. */
export type NumberPart = { text: string; isNumber: boolean };

/** Splits `text` into plain and number parts, in order, dropping empty ones. */
export const splitNumbers = (text: string): NumberPart[] =>
  text
    .split(NUMBER_PATTERN)
    .map((part, index) => ({ text: part, isNumber: index % 2 === 1 }))
    .filter((part) => part.text !== '');
