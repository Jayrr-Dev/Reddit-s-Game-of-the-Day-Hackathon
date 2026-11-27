// ===================================================================
// PLAYER POWER (npm run player)
// Ballpark power for the villain every 10 levels, per play style, on
// the same scale as `npm run power` (see playerPower.ts for the method).
//
//   npm run player                                   every style, levels 1, 10 ... 100
//   npm run player -- --style=curses                 archer | melee | mage | curses | hybrid
//   npm run player -- --level=50                     one level
//   npm run player -- --set=curve.energyValue=7      change a number for this run
//   npm run player -- --md > player.md               a Markdown table
// ===================================================================

import { COST_CURVE_CONFIG, withOverride, type CostCurveConfig } from '../src/shared/balance/costCurveConfig.ts';
import { playerPower, type PlayerPower } from '../src/shared/balance/playerPower.ts';
import { PLAY_STYLES } from '../src/shared/balance/playerStyles.ts';
import { markdownTable, textTable } from '../src/shared/balance/textTable.ts';

// --- ARGUMENTS ---
/** Every value given for `--name=value`. */
const argValues = (name: string): string[] =>
  process.argv.filter((arg) => arg.startsWith(`--${name}=`)).map((arg) => arg.slice(name.length + 3));

/** The default config with every `--set=path=value` applied. */
const configFromArgs = (): CostCurveConfig =>
  argValues('set').reduce((config, pair) => {
    const [path = '', value = ''] = pair.split('=');
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`Not a number: ${pair}`);
    return withOverride(config, path, number);
  }, COST_CURVE_CONFIG);

const DEFAULT_LEVELS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// --- OUTPUT ---
const HEADERS = ['Style', 'Level', 'Energy', 'HP', 'Damage/turn', 'Power', 'Traits', 'Skills bought'];

/** "Str 64, Vig 40, End 22" for the trait split the search chose. */
const traitText = (result: PlayerPower): string =>
  Object.entries(result.traits)
    .filter(([, ranks]) => (ranks ?? 0) > 0)
    .map(([trait, ranks]) => `${trait.slice(0, 3)} ${ranks}`)
    .join(', ');

/** One table row as cells. */
const rowCells = (result: PlayerPower): string[] => [
  result.style,
  String(result.level),
  String(result.energy),
  String(result.hp),
  String(result.damagePerTurn),
  String(result.power),
  traitText(result),
  String(result.skills.length),
];

// --- MAIN ---
/** Scores every chosen style at every chosen level and prints the table. */
const main = (): void => {
  const config = configFromArgs();
  const styleIds = argValues('style');
  const levels = argValues('level').map(Number);
  const styles = PLAY_STYLES.filter((style) => styleIds.length === 0 || styleIds.includes(style.id));
  const results = styles.flatMap((style) =>
    (levels.length ? levels : DEFAULT_LEVELS).map((level) => playerPower(config, style, level))
  );
  const rows = results.map(rowCells);
  console.log(process.argv.includes('--md') ? markdownTable(HEADERS, rows) : textTable(HEADERS, rows));
};

main();
