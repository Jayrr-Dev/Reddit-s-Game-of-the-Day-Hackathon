// --- DECK CARD SEARCH ---
// Search text and keyword labels for every card in play, built once so
// typing in the Create deck search box stays responsive.
import {
  ALL_CARD_IDS,
  CARD_POOL_LABELS,
  isCardInPlay,
  getCard,
  isKeywordOn,
} from '../../../shared/game/cards';
import {
  describeCard,
  GLOSSARY,
  KEYWORD_INFO,
  STATUS_INFO,
} from '../../../shared/game/describe';
import { BUFF_KEYWORDS, ELEMENT_ON_HIT } from '../../../shared/game/rules';
import type { CardEffect, CardKeyword } from '../../../shared/game/types';

// --- CATALOG ---
/** Every card a player can put in a deck. */
export const CATALOG = ALL_CARD_IDS.filter(isCardInPlay);

const statusLabels = new Map<string, string>(
  Object.entries(STATUS_INFO).map(([id, info]) => [id, info.label])
);

/** Converts punctuation and camel-case identifiers into searchable words. */
export const normalizeSearch = (value: string) =>
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
export const SEARCH_INDEX = CATALOG.map((id) => {
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
      CARD_POOL_LABELS[card.pool],
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
  return { id, pool: card.pool, labels, text };
});
export const KEYWORD_OPTIONS = [
  ...new Set(SEARCH_INDEX.flatMap((card) => [...card.labels])),
].sort((a, b) => a.localeCompare(b));
