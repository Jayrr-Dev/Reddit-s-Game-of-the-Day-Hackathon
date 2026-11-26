// ===================================================================
// RICH TEXT (ATOM)
// Renders the glossary's tiny markup (see StatusInfo in describe.ts):
// one bullet per line ("\n"; a single line stays a plain sentence) and
// **bold** for key words and numbers. A bold glossary word wears its
// own colour with its icon before it (lookOfTerm), so "**Frost**"
// reads like the Frost chip.
// ===================================================================

import { Fragment } from 'react';
import { lookOfTerm } from '../../content/glossaryLooks';
import { Glyph } from './Glyph';

// --- HELPERS ---
/** Splits a line into plain and **bold** parts (odd parts are bold). */
const boldParts = (line: string): string[] => line.split('**');

// --- SUBCOMPONENTS ---
/** A bold word: coloured and with its icon when it is a glossary word. */
const BoldTerm = ({ text }: { text: string }) => {
  const look = lookOfTerm(text);
  if (!look) return <b className="font-bold text-ink">{text}</b>;
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

/** One line of markup. */
const Line = ({ line }: { line: string }) => (
  <>
    {boldParts(line).map((part, index) => (
      <Fragment key={index}>
        {index % 2 === 1 ? <BoldTerm text={part} /> : part}
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
