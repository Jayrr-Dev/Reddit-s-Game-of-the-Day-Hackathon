import { useEffect, useRef, useState } from 'react';
import { getCard } from '../../../../shared/game/cards';
import { getHero } from '../../../../shared/game/heroes';
import type { CombatHistoryRecord } from '../../../../shared/game/types';
import { CARD_LOOK, MOVEMENT_LOOK, STATUS_LOOK } from '../../../content/visuals';
import { Glyph } from '../../ui/Glyph';
import { CardView, MovementCard } from '../CardView';

type Selection = { index: number; top: number };

/** Keep played artwork at the battlefield edge; inspect a play without leaving combat. */
export const CardPlayHistory = ({ entries }: { entries: readonly CombatHistoryRecord[] }) => {
  const root = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const entry = selected && entries[selected.index];
  const close = () => { setSelected(null); setPinned(null); };
  const inspect = (index: number, button: HTMLElement) => {
    if (!root.current) return;
    const top = button.getBoundingClientRect().top - root.current.getBoundingClientRect().top;
    setSelected({ index, top });
  };

  useEffect(() => { setSelected(null); setPinned(null); }, [entries]);

  const isOpen = !!entry;
  useEffect(() => {
    if (!isOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close();
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', dismiss);
    };
  }, [isOpen]);

  if (!entries.length) return null;
  return (
    <aside ref={root} aria-label="Combat history" className="card-play-history"
      onPointerLeave={event => { if (event.pointerType === 'mouse' && pinned === null) close(); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
      <ol className="history-thumbnails" aria-label="Most recent first" onScroll={close}>
        {entries.map((played, index) => {
          const card = 'cardId' in played ? getCard(played.cardId) : null;
          const move = 'move' in played ? played.move : undefined;
          const enemy = 'heroId' in played ? played : null;
          const type = enemy?.attackType ?? card?.type ?? 'movement';
          const event = 'event' in played ? played : null;
          const name = 'event' in played ? played.subject + ', ' + played.detail : 'heroId' in played ? getHero(played.heroId).name + ', ' + played.attackName
            : 'move' in played ? MOVEMENT_LOOK[played.move].label : getCard(played.cardId).name;
          const look = CARD_LOOK[type];
          return (
            <li key={index}>
              <button type="button" className="history-thumbnail"
                data-event={event?.event} data-enemy-attack={enemy ? true : undefined} data-card-type={enemy || event ? undefined : type} data-card-id={'cardId' in played ? played.cardId : undefined} data-move={move}
                aria-label={`${name}, turn ${played.turn}`}
                aria-expanded={selected?.index === index}
                style={{ borderColor: enemy || event?.event === 'dodge' ? undefined : look.glowVar }}
                onPointerEnter={event => { if (event.pointerType === 'mouse') inspect(index, event.currentTarget); }}
                onFocus={event => inspect(index, event.currentTarget)}
                onClick={event => {
                  if (pinned === index) close();
                  else { inspect(index, event.currentTarget); setPinned(index); }
                }}>
                <Glyph name={event ? event.status ? STATUS_LOOK[event.status].glyph : event.event === 'dodge' ? 'dodging' : event.event === 'death' ? 'skull' : event.event === 'heal' ? 'heart' : event.event === 'guard' ? 'shield' : 'march' : look.glyph} className="size-4" />
              </button>
            </li>
          );
        }).reverse()}
      </ol>
      {entry && selected && (
        <div className="history-preview" style={{ top: `clamp(0px, ${selected.top}px, max(0px, 100% - 135px))` }}>
          {'event' in entry ? <div className="history-enemy-detail"><header><span>{entry.subject}</span><small>Turn {entry.turn}</small></header><strong>{entry.detail}</strong></div> : 'heroId' in entry ? (
            <div className="history-enemy-detail">
              <header><span>{getHero(entry.heroId).name}</span><small>Turn {entry.turn}</small></header>
              <strong>{entry.attackName}</strong>
              <dl><div><dt>HP lost</dt><dd className={entry.hpLost ? "loss" : "zero"}>{entry.hpLost}</dd></div>
                {entry.guardLost > 0 && <div><dt>Guard absorbed</dt><dd className="guard">{entry.guardLost}</dd></div>}</dl>
            </div>
          ) : 'move' in entry
            ? <MovementCard move={entry.move} cost={entry.cost} disabled={false} blockReason={null} onPlay={() => {}} />
            : <CardView cardId={entry.cardId} paidCost={entry.cost} imbues={entry.imbues ?? []}
                usesSpent={entry.usesSpent ?? 0} size="fan" />}
          {!('heroId' in entry) && !('event' in entry) && <small>Turn {entry.turn}</small>}
        </div>
      )}
    </aside>
  );
};
