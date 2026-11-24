// ===================================================================
// CARD MATH
// A small strip over a lifted card that shows how its damage per hit is
// worked out, so buffs read as a sum, not a mystery number:
//   6  + 8 (flame)  + 7 (sword)  x1.5 (bolt)  = 31
// Each bonus wears its status icon and colour. It follows the aim, so
// the Range bonus appears once a back-row hero is targeted. Hidden when
// nothing changes the printed number. The math comes from the engine
// (describeCardMath), so it always matches what the card will deal.
// ===================================================================

import type { CardId } from '../../../../shared/game/cards';
import {
  describeCardMath,
  type MathTerm,
} from '../../../../shared/game/describe';
import type { Combatant, HeroUnit } from '../../../../shared/game/types';
import { STATUS_LOOK, type Look } from '../../../content/visuals';
import { Glyph } from '../../ui/Glyph';

// --- CONSTANTS ---
/** The Range bonus has no status; it wears the bow in Range's colour. */
const LONG_RANGE_LOOK: Look = { glyph: 'bow', toneClass: 'text-range' };

// --- HELPERS ---
/** The icon and colour for one step's source. */
const lookOf = (term: Exclude<MathTerm, { kind: 'base' }>): Look =>
  term.source === 'longRange' ? LONG_RANGE_LOOK : STATUS_LOOK[term.source];

// --- SUBCOMPONENTS ---
/** One step: "6", "+8 (icon)" or "x1.5 (icon)". */
const Term = ({ term }: { term: MathTerm }) => {
  if (term.kind === 'base')
    return <span className="text-ink">{term.amount}</span>;
  const look = lookOf(term);
  const sign = term.kind === 'add' ? (term.amount > 0 ? '+' : '−') : '×';
  const value = term.kind === 'add' ? Math.abs(term.amount) : term.factor;
  return (
    <span className={`flex items-center gap-0.5 ${look.toneClass}`}>
      {sign}
      {value}
      <Glyph name={look.glyph} className="size-3" />
    </span>
  );
};

// --- COMPONENT ---
/** Renders the damage math for `cardId`, or nothing when it is plain. */
export const CardMath = ({
  cardId,
  attacker,
  target,
}: {
  cardId: CardId;
  attacker: Combatant;
  target?: HeroUnit | undefined;
}) => {
  const math = describeCardMath(cardId, attacker, target);
  if (!math) return null;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-sunken/95 px-2.5 py-1 font-display text-xs font-black ring-1 ring-accent/60 shadow-[0_4px_10px_rgb(0_0_0/0.6)] animate-tooltip-in">
      {math.terms.map((term, index) => (
        <Term key={index} term={term} />
      ))}
      <span className="text-accent">= {math.total}</span>
    </div>
  );
};
