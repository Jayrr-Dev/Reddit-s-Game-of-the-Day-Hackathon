// ===================================================================
// CARD BALANCE (npm run balance)
// Prints every card's score on the cost curve. Tune the numbers in
// src/shared/balance/costCurveConfig.ts, or try one without editing:
//
//   npm run balance                                  all cards, strongest first
//   npm run balance -- --only=strong                 too strong | weak | on
//   npm run balance -- --card=cruelSlash             one card, with its breakdown
//   npm run balance -- --set=battle.heroHitDamage=6  change a number for this run
//   npm run balance -- --md > balance.md             a Markdown table
// ===================================================================

import { scoreAllCards, type CardScore, type Verdict } from '../src/shared/balance/costCurve.ts';
import {
  COST_CURVE_CONFIG,
  withOverride,
  type CostCurveConfig,
} from '../src/shared/balance/costCurveConfig.ts';

// --- ARGUMENTS ---
/** Every value given for `--name=value`. */
const argValues = (name: string): string[] =>
  process.argv
    .filter((arg) => arg.startsWith(`--${name}=`))
    .map((arg) => arg.slice(name.length + 3));

const VERDICT_BY_FLAG: Record<string, Verdict> = {
  strong: 'too strong',
  weak: 'too weak',
  on: 'on curve',
};

/** The default config with every `--set=path=value` applied. */
const configFromArgs = (): CostCurveConfig =>
  argValues('set').reduce((config, pair) => {
    const [path = '', value = ''] = pair.split('=');
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Not a number: ${pair}`);
    return withOverride(config, path, number);
  }, COST_CURVE_CONFIG);

// --- OUTPUT ---
/** "damage 9, bleed 2, charge 8.2". */
const breakdown = (score: CardScore): string =>
  score.parts.map((part) => `${part.label} ${part.points}`).join(', ');

/** One table row as cells. */
const rowCells = (score: CardScore): string[] => [
  score.name,
  score.rarity,
  String(score.cost),
  String(score.value),
  String(score.target),
  score.ratio.toFixed(2),
  score.verdict,
  breakdown(score),
];

const HEADERS = ['Card', 'Rarity', 'Cost', 'Value', 'Target', 'Ratio', 'Verdict', 'Where the value comes from'];

/** A Markdown table. */
const markdownTable = (scores: CardScore[]): string =>
  [HEADERS, HEADERS.map(() => '---'), ...scores.map(rowCells)]
    .map((cells) => `| ${cells.join(' | ')} |`)
    .join('\n');

/** A plain-text table with padded columns (breakdown left unpadded). */
const textTable = (scores: CardScore[]): string => {
  const rows = [HEADERS, ...scores.map(rowCells)];
  const widths = HEADERS.map((_, column) => Math.max(...rows.map((row) => (row[column] ?? '').length)));
  return rows
    .map((row) => row.map((cell, column) => (column === row.length - 1 ? cell : cell.padEnd(widths[column] ?? 0))).join('  '))
    .join('\n');
};

/** Counts per verdict: "36 too strong, 44 on curve, 29 too weak". */
const summary = (scores: CardScore[]): string =>
  (['too strong', 'on curve', 'too weak'] as const)
    .map((verdict) => `${scores.filter((score) => score.verdict === verdict).length} ${verdict}`)
    .join(', ');

// --- MAIN ---
/** Scores the cards, filters them as asked and prints the table. */
const main = (): void => {
  const config = configFromArgs();
  const all = scoreAllCards(config);
  const only = argValues('only')[0];
  const cards = argValues('card');
  const scores = all
    .filter((score) => !only || score.verdict === VERDICT_BY_FLAG[only])
    .filter((score) => cards.length === 0 || cards.includes(score.id));
  const isMarkdown = process.argv.includes('--md');
  console.log(isMarkdown ? markdownTable(scores) : textTable(scores));
  console.log(`\n${all.length} cards: ${summary(all)}`);
};

main();
