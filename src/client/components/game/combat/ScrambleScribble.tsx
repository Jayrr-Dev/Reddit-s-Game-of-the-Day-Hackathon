// ===================================================================
// SCRAMBLE SCRIBBLE
// The messy pen doodle a Scrambled unit wears over its head (Sam's
// sketch): one looping line that keeps redrawing itself, so the unit
// reads as "plans scribbled out". Also used, bigger, by the scramble
// notice when Scramble auto-plays one of your cards.
// PERFORMANCE: one SVG path; stroke-dashoffset and opacity only
// (index.css "SCRAMBLE"); reduced motion holds a still doodle.
// ===================================================================

// --- DATA ---
/** One hand-drawn looping line, like a pen scribbling over a word. */
const SCRIBBLE_PATH =
  'M52 6 C30 3 6 6 10 13 C14 20 66 22 82 14 C92 8 60 5 34 9 C14 12 12 18 30 19 C52 21 76 18 72 13 C66 8 40 9 26 12 C16 15 24 17 44 17 C60 17 64 13 52 11 C40 10 30 13 38 15 C46 16 56 14 50 12 M78 7 C86 6 92 7 96 7';

// --- COMPONENT ---
/** Renders the doodle over its parent's top edge (sizes via className). */
export const ScrambleScribble = ({ className = 'left-1/2 top-[4%] w-[70%]' }: { className?: string }) => (
  <svg
    className={`scramble-scribble pointer-events-none absolute text-ink ${className}`}
    viewBox="0 0 100 24"
    fill="none"
    aria-hidden="true"
  >
    <path d={SCRIBBLE_PATH} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
  </svg>
);
