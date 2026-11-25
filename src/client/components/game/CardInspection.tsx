import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCard, isKeywordOn, type CardId } from '../../../shared/game/cards';
import { describeCardRules, GLOSSARY, KEYWORD_INFO } from '../../../shared/game/describe';
import { usesOf } from '../../../shared/game/uses';
import { CARD_LOOK } from '../../content/visuals';
import { RichText } from '../ui/RichText';
import { Glyph } from '../ui/Glyph';
import { CardView } from './CardView';
import './cardInspection.css';
import '../../semanticStats.css';

const cardTerms = (id: CardId, lines: readonly string[]) => {
  const printed = ' ' + lines.join(' ').toLowerCase().replace(/[^a-z]+/g, ' ') + ' ';
  const keywords = getCard(id).keywords.filter(isKeywordOn).map(key =>
    key === 'exhaust'
      ? { label: 'Use', description: `After **${usesOf(id)}** plays this run, this copy **Exhausts** and leaves the deck.` }
      : KEYWORD_INFO[key]);
  const effects = Object.values(GLOSSARY).filter(info => printed.includes(' ' + info.label.toLowerCase() + ' '));
  return [...new Map([...effects, ...keywords].map(info => [info.label, info])).values()];
};

const effectTone = (line: string) => {
  if (/\bHP\b/i.test(line)) return 'hp';
  if (/\bheal\b/i.test(line)) return 'heal';
  if (/\b(guard|shield|brace|armor|protection)\b/i.test(line)) return 'guard';
  if (/\b(energy|cost)\b/i.test(line)) return 'energy';
  if (/\bdamage\b/i.test(line)) return 'damage';
  if (/\bdraw\b/i.test(line)) return 'draw';
  return 'status';
};

const CardInspection = ({ id, onClose }: { id: CardId; onClose: () => void }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const card = getCard(id);
  const lines = describeCardRules(id);
  const terms = cardTerms(id, lines);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className="card-inspection" aria-label={card.name + ' details'}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
      <header><h2>{card.name}</h2><button type="button" onClick={onClose} autoFocus>Back to deck</button></header>
      <div className="card-inspection-body">
        <div className="card-inspection-summary">
          <div className="card-inspection-preview" aria-hidden="true" inert><CardView cardId={id} /></div>
          <div>
            <p className="card-inspection-meta">{[card.rarity, CARD_LOOK[card.type].typeName, card.element ?? card.edge].filter(Boolean).join(' · ')}</p>
            <p className="card-inspection-energy stat-ink" data-stat="energy"><Glyph name="bolt" /> {card.cost} energy</p>
            <h3>Effects</h3>
            {lines.map((line, i) => <p key={i} className="card-inspection-effect stat-ink" data-stat={effectTone(line)}>{line}</p>)}
          </div>
        </div>
        {terms.length > 0 && <dl className="card-inspection-terms">
          {terms.map(info => <div key={info.label}><dt>{info.label}</dt><dd><RichText text={info.description} /></dd></div>)}
        </dl>}
      </div>
    </dialog>
  );
};

/** A sibling of the quantity control, so inspecting a card leaves the deck untouched. */
export const InspectCardButton = ({ id }: { id: CardId }) => {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const card = getCard(id);
  const look = CARD_LOOK[card.type];
  return <>
    <button type="button" className="cde-inspect" ref={trigger} aria-haspopup="dialog"
      aria-label={'Inspect ' + card.name} onClick={() => setOpen(true)}>
      <span className={'cde-art ' + look.frameClass} aria-hidden="true"><Glyph name={look.glyph} /></span>
      <span className="cde-card-name"><b>{card.name}</b><small>{look.typeName} · {card.cost} energy</small></span>
      <span className="cde-inspect-mark" aria-hidden="true">›</span>
    </button>
    {open && createPortal(<CardInspection id={id} onClose={() => {
      setOpen(false);
      requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
    }} />,
      trigger.current?.closest('.dueling-table') ?? document.body)}
  </>;
};
