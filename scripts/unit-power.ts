// ===================================================================
// UNIT POWER (npm run power)
// Prints every unit's power score: the damage it deals you before you
// can kill it, in the same damage points as the card cost curve.
// Tune the numbers in src/shared/balance/costCurveConfig.ts (the `unit`
// group and the shared battle prices), or for one run:
//
//   npm run power                                  every unit, strongest first
//   npm run power -- --tier=grunt                  grunt | elite | officer | boss | summon
//   npm run power -- --unit=squire                 one unit
//   npm run power -- --set=unit.backlineShield=0.5 change a number for this run
//   npm run power -- --md > power.md               a Markdown table
// ===================================================================

import { COST_CURVE_CONFIG, withOverride, type CostCurveConfig } from '../src/shared/balance/costCurveConfig.ts';
import { markdownTable, textTable } from '../src/shared/balance/textTable.ts';
import { allUnitPowers, villainDamagePerTurn, type UnitPower } from '../src/shared/balance/unitPower.ts';

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

// --- OUTPUT ---
const HEADERS = ['Unit', 'Tier', 'HP', 'Threat/turn', 'Toughness', 'Turns to kill', 'Power'];

/** One table row as cells. */
const rowCells = (unit: UnitPower): string[] => [
  unit.name,
  unit.tier,
  String(unit.hp),
  String(unit.threat),
  String(unit.toughness),
  String(unit.turnsToKill),
  String(unit.power),
];

// --- MAIN ---
/** Scores the units, filters them as asked and prints the table. */
const main = (): void => {
  const config = configFromArgs();
  const tiers = argValues('tier');
  const ids = argValues('unit');
  const units = allUnitPowers(config)
    .filter((unit) => tiers.length === 0 || tiers.includes(unit.tier))
    .filter((unit) => ids.length === 0 || ids.includes(unit.id));
  const rows = units.map(rowCells);
  console.log(process.argv.includes('--md') ? markdownTable(HEADERS, rows) : textTable(HEADERS, rows));
  console.log(`\nVillain damage per turn: ${villainDamagePerTurn(config)} (3 energy x ${config.curve.energyValue}).`);
};

main();
