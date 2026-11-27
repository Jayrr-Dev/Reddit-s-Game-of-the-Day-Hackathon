// --- CUSTOM DECK EDITOR ---
// Full-screen deck builder: the card catalog on the left (grouped by
// type, A to Z), the new deck on the right. Cards move by drag and drop,
// or by a tap / Enter on a card for touch and keyboard players.
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CARD_POOL_LABELS, getCard, type CardId } from '../../../shared/game/cards';
import type { CardPool } from '../../../shared/game/types';
import {
  addCardBlocker,
  addCardToDeck,
  groupCardsByType,
  hasDeckRoom,
  removeCardFromDeck,
  stackDeck,
  type AddCardBlocker,
} from '../../../shared/game/deckBuilder';
import { KEYWORD_INFO } from '../../../shared/game/describe';
import {
  CUSTOM_DECK_LIMIT,
  type CustomTrainingDeck,
} from '../../../shared/game/sandboxDecks';
import { CARD_LOOK } from '../../content/visuals';
import {
  deckZoneProps,
  useDeckDrag,
  type DeckDrag,
  type DeckZone,
} from '../../hooks/useDeckDrag';
import { InspectCardButton } from './CardInspection';
import { CardView } from './CardView';
import {
  KEYWORD_OPTIONS,
  normalizeSearch,
  SEARCH_INDEX,
} from './deckCardSearch';
import { Button } from '../ui/Button';
import { LockedPreview } from '../ui/LockedPreview';
import './customDeckEditor.css';

// --- TYPES ---
type EditorProps = {
  initial?: CustomTrainingDeck | undefined;
  /** False for cards the viewer hasn't unlocked yet; they show blurred and locked. */
  isCardAllowed: (id: CardId) => boolean;
  onSave: (name: string, cards: CardId[]) => void;
  onClose: () => void;
};
type TileProps = {
  id: CardId;
  zone: DeckZone;
  count?: number;
  disabled?: boolean;
  /** Why the card can't be added (shown on the tile and as its tooltip). */
  blockedNote?: string | undefined;
  onPress: (event: ReactPointerEvent) => void;
  onActivate: () => void;
};

// --- BLOCKED ADD MESSAGES ---
/** What the player reads when a card can't go in the deck. */
const BLOCKED_ADD_TEXT: Record<AddCardBlocker, string> = {
  unique: `${KEYWORD_INFO.unique.label}: ${KEYWORD_INFO.unique.description.toLowerCase()}`,
  full: `The deck is full (${CUSTOM_DECK_LIMIT} cards)`,
};

/** How to unlock a locked catalog card (the padlock's tooltip). */
const CARD_UNLOCK_HINT = 'Add this card to your deck during a run to unlock it.';

// --- CARD TILE ---
/** One real card in either grid: tap or Enter acts on it, a press-and-move drags it. */
const DeckCardTile = ({
  id,
  zone,
  count,
  disabled,
  blockedNote,
  onPress,
  onActivate,
}: TileProps) => {
  const action = zone === 'catalog' ? 'Add' : 'Remove one';
  return (
    <div
      className="cde-tile"
      data-card-id={id}
      title={blockedNote}
      onPointerDown={onPress}
    >
      <CardView
        cardId={id}
        size="fan"
        label={`${action} ${getCard(id).name}`}
        isDisabled={disabled ?? false}
        onClick={onActivate}
      />
      {count !== undefined && count > 1 && (
        <span className="cde-tile-count" aria-label={`${count} copies`}>
          ×{count}
        </span>
      )}
      {blockedNote && (
        <span className="cde-tile-note" role="note">
          {blockedNote}
        </span>
      )}
      <InspectCardButton id={id} />
    </div>
  );
};

// --- DRAG GHOST ---
/** The card that follows the pointer while it is dragged. */
const DragGhost = ({ drag }: { drag: DeckDrag }) => (
  <div
    className="cde-ghost"
    aria-hidden="true"
    inert
    style={{ left: drag.x, top: drag.y }}
  >
    <CardView cardId={drag.id} size="fan" />
  </div>
);

// --- CATALOG FILTERS ---
/** Search box, keyword picker and the applied keyword chips. */
const CatalogFilters = ({
  query,
  keywords,
  pool,
  onQuery,
  onKeywords,
  onPool,
}: {
  query: string;
  keywords: string[];
  pool: CardPool | 'all';
  onQuery: (query: string) => void;
  onKeywords: (keywords: string[]) => void;
  onPool: (pool: CardPool | 'all') => void;
}) => (
  <>
    <div className="cde-filters">
      <input
        type="search"
        aria-label="Search cards"
        placeholder="Search cards"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      <select
        aria-label="Add keyword filter"
        value=""
        onChange={(event) => {
          if (event.target.value) onKeywords([...keywords, event.target.value]);
        }}
      >
        <option value="">
          {keywords.length ? 'Add keyword' : 'All keywords'}
        </option>
        {KEYWORD_OPTIONS.filter((keyword) => !keywords.includes(keyword)).map(
          (keyword) => (
            <option key={keyword} value={keyword}>
              {keyword}
            </option>
          )
        )}
      </select>
      <label className="cde-card-pool">
        <span>Card Pool</span>
        <select value={pool} onChange={(event) => onPool(event.target.value as CardPool | 'all')}>
          <option value="all">All cards</option>
          <option value="player">{CARD_POOL_LABELS.player}</option>
          <option value="neutral">{CARD_POOL_LABELS.neutral}</option>
          <option value="unit">{CARD_POOL_LABELS.unit}</option>
        </select>
      </label>
    </div>
    {(query || keywords.length > 0 || pool !== 'all') && (
      <div className="cde-filter-summary">
        <div className="cde-filter-tags" aria-label="Applied keyword filters">
          {keywords.map((keyword) => (
            <button
              type="button"
              key={keyword}
              aria-label={`Remove ${keyword} filter`}
              onClick={() =>
                onKeywords(keywords.filter((value) => value !== keyword))
              }
            >
              {keyword} ×
            </button>
          ))}
        </div>
        <button
          type="button"
          className="cde-clear"
          onClick={() => {
            onQuery('');
            onKeywords([]);
            onPool('all');
          }}
        >
          Clear filters
        </button>
      </div>
    )}
  </>
);

// --- FILTERED CATALOG ---
/** Cards matching every search word and keyword, grouped by type A to Z. */
const useCatalogGroups = (query: string, keywords: string[], pool: CardPool | 'all') => {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  const visible = SEARCH_INDEX.filter(
    ({ labels, text, pool: cardPool }) =>
      (pool === 'all' || cardPool === pool) &&
      keywords.every((keyword) => labels.has(keyword)) &&
      words.every((word) => text.includes(word))
  ).map((card) => card.id);
  return groupCardsByType(visible);
};

/** Builds a practice deck from the full card catalog. */
export const CustomDeckEditor = ({ initial, isCardAllowed, onSave, onClose }: EditorProps) => {
  // --- STATE ---
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [cards, setCards] = useState<CardId[]>(initial?.cards ?? []);
  const [query, setQuery] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [pool, setPool] = useState<CardPool | 'all'>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const groups = useCatalogGroups(query, keywords, pool);
  const stacks = stackDeck(cards);
  const isDeckFull = !hasDeckRoom(cards);
  const canSave =
    Boolean(name.trim()) &&
    cards.length > 0 &&
    cards.length <= CUSTOM_DECK_LIMIT;

  // --- DECK EDITS ---
  /** Why a catalog card can't be added right now, as player text. */
  const blockedNoteOf = (id: CardId): string | undefined => {
    const blocker = addCardBlocker(cards, id);
    return blocker ? BLOCKED_ADD_TEXT[blocker] : undefined;
  };
  /** Adds one copy, or explains in the footer why it can't. */
  const add = (id: CardId) => {
    if (!isCardAllowed(id)) return; // Locked cards are preview only.
    setNotice(blockedNoteOf(id) ?? null);
    setCards((previous) => addCardToDeck(previous, id));
  };
  const remove = (id: CardId) => {
    setNotice(null);
    setCards((previous) => removeCardFromDeck(previous, id));
  };
  /** Catalog → deck adds a copy; deck → anywhere outside the deck removes one. */
  const { drag, startPress, consumeDrag } = useDeckDrag((id, from, to) => {
    if (from === 'catalog' && to === 'deck') add(id);
    if (from === 'deck' && to !== 'deck') remove(id);
  });
  /** A tap acts on the card unless the press just ended a drag. */
  const tap = (action: () => void) => () => {
    if (!consumeDrag()) action();
  };

  // --- MODAL ---
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  // --- RENDER ---
  return (
    <dialog
      className="custom-deck-editor"
      aria-label="Custom deck editor"
      ref={dialog}
      data-dragging={drag ? drag.from : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="cde-head">
        <Button variant="menu" className="cde-back" onClick={onClose}>Back</Button>
        <h2>{initial ? 'Edit deck' : 'Create deck'}</h2>
        <input
          type="text"
          aria-label="Deck name"
          value={name}
          placeholder="Name your deck"
          onChange={(event) => setName(event.target.value)}
        />
      </header>
      <div className="cde-board">
        <section
          className="cde-panel"
          aria-label="All cards"
          data-over={drag?.over === 'catalog' || undefined}
          {...deckZoneProps('catalog')}
        >
          <CatalogFilters
            query={query}
            keywords={keywords}
            pool={pool}
            onQuery={setQuery}
            onKeywords={setKeywords}
            onPool={setPool}
          />
          <div className="cde-scroll">
            {groups.length === 0 && (
              <p className="cde-empty">{pool === 'unit' && !SEARCH_INDEX.some(card => card.pool === 'unit')
                ? 'No Unit Cards yet. This pool is for cards given by or won from units.'
                : 'No cards match these filters.'}</p>
            )}
            {groups.map((group) => (
              <div key={group.type} className="cde-group">
                <h3>{CARD_LOOK[group.type].typeName}</h3>
                <div className="cde-grid">
                  {group.cards.map((id) => (
                    <LockedPreview key={id} isLocked={!isCardAllowed(id)} hint={CARD_UNLOCK_HINT}>
                      <DeckCardTile
                        id={id}
                        zone="catalog"
                        disabled={isDeckFull || blockedNoteOf(id) !== undefined}
                        blockedNote={isDeckFull ? undefined : blockedNoteOf(id)}
                        onPress={startPress(id, 'catalog')}
                        onActivate={tap(() => add(id))}
                      />
                    </LockedPreview>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          className="cde-panel cde-deck"
          aria-label="New deck"
          data-over={drag?.over === 'deck' || undefined}
          {...deckZoneProps('deck')}
        >
          <h3>
            New deck <span aria-live="polite">({cards.length})</span>
          </h3>
          <div className="cde-scroll">
            {stacks.length === 0 && (
              <p className="cde-empty">
                Drag cards here, or tap a card to add it.
              </p>
            )}
            <div className="cde-grid">
              {stacks.map(({ id, count }) => (
                <DeckCardTile
                  key={id}
                  id={id}
                  zone="deck"
                  count={count}
                  onPress={startPress(id, 'deck')}
                  onActivate={tap(() => remove(id))}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
      <footer className="cde-foot">
        <span aria-live="polite">
          <b>{cards.length}</b> / {CUSTOM_DECK_LIMIT} cards
          {notice && <span className="cde-notice"> · {notice}</span>}
        </span>
        <button
          type="button"
          className="cde-save"
          disabled={!canSave}
          onClick={() => {
            if (canSave) onSave(name.trim(), cards);
          }}
        >
          Save deck
        </button>
      </footer>
      {drag && <DragGhost drag={drag} />}
    </dialog>
  );
};
