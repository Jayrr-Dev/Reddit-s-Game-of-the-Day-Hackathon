// ===================================================================
// MOVE EFFECT (MOLECULE)
// One effect of a hero's move, drawn the same way everywhere it is
// explained (the unit info window and the intent chip popovers): the
// effect's battlefield icon and colour (INTENT_LOOK), its headline with
// the numbers bold and bright, and any rules text muted underneath,
// with the tooltips' formatting (RichText: keyword colours and icons,
// white key words, coloured percentages and tier numerals).
// ===================================================================

import type { Intent } from '../../../shared/game/describe';
import { INTENT_LOOK } from '../../content/visuals';
import { splitNumbers } from '../../../shared/utils/numberParts';
import { Glyph } from '../ui/Glyph';
import { RichText } from '../ui/RichText';

// --- SUBCOMPONENTS ---
/** One line of text with its numbers in bold, bright figures. */
export const WithNumbers = ({ text }: { text: string }) =>
  splitNumbers(text).map((part, index) =>
    part.isNumber ? <b key={index} className="unit-move-number">{part.text}</b> : part.text
  );

// --- COMPONENT ---
/** One effect line: icon and coloured headline, then muted details. */
export const MoveEffect = ({ intent }: { intent: Intent }) => {
  const { glyph, toneClass } = INTENT_LOOK[intent.kind];
  const [headline = '', ...details] = intent.label.split('\n');
  return (
    <li className="unit-move-effect">
      <Glyph name={glyph} className={'size-4 ' + toneClass} />
      <span className={'font-semibold ' + toneClass}><WithNumbers text={headline} /></span>
      {details.length > 0 && <span className="unit-move-detail"><RichText text={details.join(' ')} /></span>}
    </li>
  );
};
