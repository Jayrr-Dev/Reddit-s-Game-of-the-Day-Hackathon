// ===================================================================
// RICH TEXT (ATOM)
// Renders the glossary's tiny markup (see StatusInfo in describe.ts):
// one bullet per line ("\n"; a single line stays a plain sentence) and
// **bold** for key words and numbers. A bold glossary word wears its
// own colour with its icon before it (lookOfTerm), so "**Frost**"
// reads like the Frost chip. Plain text also picks out, in bold white,
// key words (dodge, all, hit, turn) and every percentage (green when it is a gain like
// "+25%", red when a loss like "-25%"), so the numbers that decide a
// fight stand out without markup in every description.
// The word affliction wears the Curse purple (TintedText). Glossary
// words keep their colour and icon even when the text doesn't bold them.
// ===================================================================

import { Fragment } from 'react';
import { lookOfTerm, splitGlossaryTerms } from '../../content/glossaryLooks';
import { splitTintedWords } from '../../content/tintedWords';
import { Glyph } from './Glyph';

// --- HELPERS ---
/** Splits a line into plain and **bold** parts (odd parts are bold). */
const boldParts = (line: string): string[] => line.split('**');

// --- AUTO EMPHASIS ---
/** Words drawn bold white wherever they appear in plain text, any case. */
const EMPHASIS_WORDS = [
  'dodge',
  'dodges',
  'dodged',
  'all',
  'hit',
  'hits',
  'turn',
  'turns',
];
/**
 * Tier numerals (Enfeeble I, Tier IV), longest first. Matched in
 * capitals only, so they never catch a stray lowercase letter.
 */
const TIER_NUMERALS = ['IV', 'III', 'II', 'I'];

/** A word's pattern in any letter case ("all" also matches "ALL"). */
const anyCase = (word: string): string =>
  word.replace(/[a-z]/g, (letter) => `[${letter}${letter.toUpperCase()}]`);

/**
 * Emphasised spans inside plain text: signed or bare percentages, the
 * EMPHASIS_WORDS and the TIER_NUMERALS. The capture group keeps the
 * matches, so odd parts of the split are the emphasised ones.
 */
const AUTO_EMPHASIS = new RegExp(
  `([+−-]?\\d+%|\\b(?:${[...EMPHASIS_WORDS.map(anyCase), ...TIER_NUMERALS].join('|')})\\b)`
);
const emphasisParts = (text: string): string[] => text.split(AUTO_EMPHASIS);

/**
 * The colour of an emphasised span: a gain ("+25%") is heal green, a
 * loss ("-25%") is HP red, a tier numeral grey (IV gold, the top
 * tier), anything else (a word, 50%) is white.
 */
const emphasisToneClass = (text: string): string => {
  if (text === 'IV') return 'text-tier-top';
  if (TIER_NUMERALS.includes(text)) return 'text-tier-numeral';
  if (/^\+\d+%$/.test(text)) return 'text-heal';
  if (/^[-−]\d+%$/.test(text)) return 'text-hp';
  return 'text-ink';
};

// --- SUBCOMPONENTS ---
/** Plain text with its tinted words (like "affliction") coloured. */
export const TintedText = ({ text }: { text: string }) => (
  <>
    {splitTintedWords(text).map((part, index) =>
      part.toneClass ? (
        <span key={index} className={part.toneClass}>
          {part.text}
        </span>
      ) : (
        <Fragment key={index}>{part.text}</Fragment>
      )
    )}
  </>
);

/** A bold word: coloured and with its icon when it is a glossary word. */
const BoldTerm = ({ text }: { text: string }) => {
  const look = lookOfTerm(text);
  if (!look)
    return <b className={`font-bold ${emphasisToneClass(text)}`}>{text}</b>;
  return (
    <b className={`font-bold ${look.toneClass}`}>
      <Glyph
        name={look.glyph}
        className="mr-0.5 inline size-3 -translate-y-px align-middle"
      />
      {text}
    </b>
  );
};

/**
 * Text between glossary words: percentages and key words in bold
 * white, the rest tinted where it names a tinted word (affliction).
 */
const EmphasisedText = ({ text }: { text: string }) => (
  <>
    {emphasisParts(text).map((part, index) =>
      index % 2 === 1 ? (
        <b key={index} className={`font-bold ${emphasisToneClass(part)}`}>
          {part}
        </b>
      ) : (
        <TintedText key={index} text={part} />
      )
    )}
  </>
);

/**
 * Plain text: every glossary word it names (Shock, Frost, Melee) in its
 * own colour with its icon, like a bolded one, and the rest emphasised.
 */
const PlainText = ({ text }: { text: string }) => (
  <>
    {splitGlossaryTerms(text).map((part, index) =>
      index % 2 === 1 ? (
        <BoldTerm key={index} text={part} />
      ) : (
        <EmphasisedText key={index} text={part} />
      )
    )}
  </>
);

/** One line of markup. */
const Line = ({ line }: { line: string }) => (
  <>
    {boldParts(line).map((part, index) => (
      <Fragment key={index}>
        {index % 2 === 1 ? <BoldTerm text={part} /> : <PlainText text={part} />}
      </Fragment>
    ))}
  </>
);

// --- COMPONENT ---
/** Glossary markup as a sentence, or as bullets when it has lines. */
export const RichText = ({ text }: { text: string }) => {
  const lines = text.split('\n').filter(Boolean);
  if (lines.length === 1) return <Line line={lines[0] ?? ''} />;
  return (
    <ul className="flex flex-col gap-0.5">
      {lines.map((line) => (
        <li key={line} className="flex gap-1">
          <span aria-hidden className="text-ink-muted">
            •
          </span>
          <span>
            <Line line={line} />
          </span>
        </li>
      ))}
    </ul>
  );
};
