// --- CUSTOM DECK EDITOR ---
import { useEffect, useRef, useState } from 'react';
import {
  ALL_CARD_IDS,
  getCard,
  isKeywordOn,
  type CardId,
} from '../../../shared/game/cards';
import {
  describeCard,
  GLOSSARY,
  KEYWORD_INFO,
  STATUS_INFO,
} from '../../../shared/game/describe';
import { BUFF_KEYWORDS, ELEMENT_ON_HIT } from '../../../shared/game/rules';
import type { CardEffect, CardKeyword } from '../../../shared/game/types';
import {
  CUSTOM_DECK_LIMIT,
  type CustomTrainingDeck,
} from '../../../shared/game/sandboxDecks';
import { InspectCardButton } from './CardInspection';
import './customDeckEditor.css';

type EditorProps = {
  initial?: CustomTrainingDeck | undefined;
  onSave: (name: string, cards: CardId[]) => void;
  onClose: () => void;
};

const CATALOG = [...ALL_CARD_IDS].sort((a, b) =>
  getCard(a).name.localeCompare(getCard(b).name)
);

const statusLabels = new Map<string, string>(
  Object.entries(STATUS_INFO).map(([id, info]) => [id, info.label])
);

/** Converts punctuation and camel-case identifiers into searchable words. */
const normalizeSearch = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const printedMechanics = [...Object.keys(GLOSSARY), 'Wild Imbue', 'Overkill'];

/** Includes effects granted by a keyword under their own rule names. */
const keywordLabels = (keyword: CardKeyword): string[] => {
  if (!isKeywordOn(keyword)) return [];
  const label = KEYWORD_INFO[keyword].label;
  if (keyword === 'rampage') return [label, 'Charge', 'Momentum'];
  if (keyword === 'charge') return [label, 'Momentum'];
  if (keyword === 'distance') return [label, 'Back Step'];
  return [label];
};

/** Collects mechanics from the printed effect, including gifts on Imbue cards. */
const effectLabels = (effect: CardEffect): string[] => {
  if (effect.kind === 'imbue')
    return [
      'Imbue',
      ...(effect.gift.kind === 'keyword'
        ? keywordLabels(effect.gift.keyword)
        : effectLabels(effect.gift.effect)),
    ];
  if (effect.kind === 'buff') {
    const grant = BUFF_KEYWORDS.find((entry) => entry.buff === effect.buff);
    return [
      STATUS_INFO[effect.buff].label,
      ...(grant && isKeywordOn(grant.keyword)
        ? ['Imbue', ...keywordLabels(grant.keyword)]
        : []),
    ];
  }
  if (effect.kind === 'charge') return keywordLabels('charge');
  if (effect.kind === 'amplify')
    return ['Amplify', STATUS_INFO[effect.status].label];
  const aliases: Partial<Record<CardEffect['kind'], string>> = {
    backStep: 'Back Step',
    push: 'Knockback',
    protect: 'Protection',
  };
  const labels = [
    aliases[effect.kind] ??
      statusLabels.get(effect.kind) ??
      (effect.kind.charAt(0).toUpperCase() + effect.kind.slice(1)).replace(
        /([a-z])([A-Z])/g,
        '$1 $2'
      ),
  ];
  if ('target' in effect && effect.target === 'all') labels.push('All targets');
  if (effect.kind === 'damage') {
    if (effect.hits > 1) labels.push('Multi-hit');
    if (effect.target === 'random') labels.push('Randomly');
  }
  return labels;
};

/** Indexes both card copy and mechanics once so typing stays responsive. */
const SEARCH_INDEX = CATALOG.map((id) => {
  const card = getCard(id);
  const enabledKeywords = card.keywords.filter(isKeywordOn);
  const printedRules = describeCard(id).map((line) =>
    isKeywordOn('longRange')
      ? line
      : line.replaceAll(KEYWORD_INFO.longRange.label, '')
  );
  const rulesText = ' ' + normalizeSearch(printedRules.join(' ')) + ' ';
  const labels = new Set([
    ...enabledKeywords.flatMap(keywordLabels),
    ...card.effects.flatMap(effectLabels),
  ]);
  // Conditional rules can reference mechanics the card doesn't apply directly.
  for (const word of printedMechanics) {
    if (rulesText.includes(' ' + normalizeSearch(word) + ' ')) labels.add(word);
  }
  const onHit = card.element && ELEMENT_ON_HIT[card.element];
  if (onHit && card.effects.some((effect) => effect.kind === 'damage'))
    labels.add(STATUS_INFO[onHit.status].label);
  if (card.targets > 1) labels.add('Multiple targets');
  const text = normalizeSearch(
    [
      card.name,
      card.type,
      card.element,
      card.edge,
      card.rarity,
      ...enabledKeywords,
      ...card.effects.map((effect) => effect.kind),
      ...labels,
      ...printedRules,
    ]
      .filter(Boolean)
      .join(' ')
  );
  return { id, labels, text };
});
const KEYWORD_OPTIONS = [
  ...new Set(SEARCH_INDEX.flatMap((card) => [...card.labels])),
].sort((a, b) => a.localeCompare(b));

/** Removes trailing copies or appends new ones, preserving existing card order. */
const setCopies = (cards: CardId[], id: CardId, wanted: number) => {
  const count = cards.filter((card) => card === id).length;
  const quantity = Math.max(
    0,
    Math.min(wanted, CUSTOM_DECK_LIMIT - cards.length + count)
  );
  if (quantity >= count)
    return [...cards, ...Array<CardId>(quantity - count).fill(id)];
  let kept = 0;
  return cards.filter((card) => card !== id || ++kept <= quantity);
};

/** Builds a practice deck from the full card catalog. */
export const CustomDeckEditor = ({ initial, onSave, onClose }: EditorProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [cards, setCards] = useState<CardId[]>(initial?.cards ?? []);
  const [query, setQuery] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [deckOnly, setDeckOnly] = useState(false);
  const [editingQuantity, setEditingQuantity] = useState<CardId | null>(null);
  const counts = new Map<CardId, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  const visible = SEARCH_INDEX.filter(
    ({ id, labels, text }) =>
      (!deckOnly || counts.has(id) || editingQuantity === id) &&
      keywords.every((keyword) => labels.has(keyword)) &&
      words.every((word) => text.includes(word))
  ).map((card) => card.id);
  const filtered = Boolean(query || keywords.length);
  const clearFilters = () => {
    setQuery('');
    setKeywords([]);
  };
  const canSave =
    Boolean(name.trim()) &&
    cards.length > 0 &&
    cards.length <= CUSTOM_DECK_LIMIT;
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      className="custom-deck-editor"
      aria-label="Custom deck editor"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="cde-head">
        <h2>{initial ? 'Edit deck' : 'Create deck'}</h2>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </header>
      <label className="cde-field">
        Deck name
        <input
          type="text"
          value={name}
          placeholder="Name your deck"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="cde-views" role="group" aria-label="Card list">
        <button
          type="button"
          aria-pressed={!deckOnly}
          onClick={() => setDeckOnly(false)}
        >
          All cards
        </button>
        <button
          type="button"
          aria-pressed={deckOnly}
          onClick={() => setDeckOnly(true)}
        >
          In deck ({cards.length})
        </button>
      </div>
      <div className="cde-filters">
        <input
          type="search"
          aria-label="Search cards"
          placeholder="Search cards"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Add keyword filter"
          value=""
          onChange={(event) => {
            const keyword = event.target.value;
            if (keyword) setKeywords((previous) => [...previous, keyword]);
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
      </div>
      {filtered && (
        <div className="cde-filter-summary">
          <div className="cde-filter-tags" aria-label="Applied keyword filters">
            {keywords.map((keyword) => (
              <button
                type="button"
                key={keyword}
                aria-label={`Remove ${keyword} filter`}
                onClick={() =>
                  setKeywords((previous) =>
                    previous.filter((value) => value !== keyword)
                  )
                }
              >
                {keyword} ×
              </button>
            ))}
          </div>
          <button type="button" className="cde-clear" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}
      <div className="cde-catalog" aria-label="Cards">
        {visible.length === 0 && (
          <p>
            {deckOnly && !cards.length
              ? 'Your deck is empty. Choose cards from All cards.'
              : deckOnly
                ? 'No cards in this deck match these filters.'
                : 'No cards match these filters.'}
          </p>
        )}
        {visible.map((id) => {
          const card = getCard(id);
          const quantity = counts.get(id) ?? 0;
          const max = CUSTOM_DECK_LIMIT - cards.length + quantity;
          return (
            <div
              key={id}
              className="cde-card"
              data-card-type={card.type}
              data-card-id={id}
            >
              <InspectCardButton id={id} />
              <div className="cde-counter">
                <button
                  type="button"
                  aria-label={`Remove one ${card.name}`}
                  disabled={!quantity}
                  onClick={() =>
                    setCards((previous) =>
                      setCopies(previous, id, quantity - 1)
                    )
                  }
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={max}
                  step={1}
                  inputMode="numeric"
                  aria-label={`${card.name} quantity`}
                  placeholder="0"
                  value={quantity || ''}
                  onFocus={(event) => {
                    setEditingQuantity(id);
                    event.target.select();
                  }}
                  onBlur={() => setEditingQuantity(null)}
                  onChange={(event) => {
                    const wanted = event.target.valueAsNumber;
                    if (Number.isInteger(wanted) || !event.target.value) {
                      setCards((previous) =>
                        setCopies(
                          previous,
                          id,
                          Number.isInteger(wanted) ? wanted : 0
                        )
                      );
                    }
                  }}
                />
                <button
                  type="button"
                  aria-label={`Add one ${card.name}`}
                  disabled={quantity >= max}
                  onClick={() =>
                    setCards((previous) =>
                      setCopies(previous, id, quantity + 1)
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <footer className="cde-foot">
        <span aria-live="polite">
          <b>{cards.length}</b> / {CUSTOM_DECK_LIMIT} cards
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
    </dialog>
  );
};
