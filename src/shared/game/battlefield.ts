// ===================================================================
// BATTLEFIELD
// Where heroes stand. The field is a grid BATTLEFIELD_COLUMNS wide and
// BATTLEFIELD_ROWS deep (nearest first: the Front line, the Backline,
// the Horizon); each hero fills `size` neighbouring columns in one row.
// A hero with `backCols` (a boss) stands in its row and also fills
// those columns of the row behind it, so its footprint can be any shape
// (a T: a whole row plus the centre behind it). Bosses are immovable: a
// pull or push aimed at them fails. Charge and Back Step still move a
// deep boss as a whole when the field has a row for its reach.
//
// RULES (every move shifts by whole rows, never sideways on its own)
//   - Melee cards hit the front row only. Reach cards, curses and Hex
//     hit any hero (Range and Magic shots into the Horizon may miss:
//     see Out of Range in combat.ts).
//   - A pull drags a hero one row nearer, into its own columns. If
//     someone stands there, that row slides sideways to make room, so a
//     pull only fails when that row has no space left. A push is the
//     mirror image: one row farther.
//   - A new horde marches in one row behind its home row as far as it
//     has room (melee in the Backline, ranged on the Horizon). At the
//     end of each heroes' turn, every displaced hero steps one
//     row toward it if there is room.
//   - Charge: with the front row empty, the field closes in by up to
//     CHARGE_ROWS rows, until someone stands in the front row.
//   - Back Step: with someone in the front row, every hero with room
//     behind falls back BACK_STEP_ROWS row (a deep boss too, as a whole,
//     when there is a row behind its reach).
//   - Piercing runs down the target's whole column, every row.
// ===================================================================

import { getCard, type CardId } from './cards.ts';
import { isCloaked } from './combatant.ts';
import { getHero } from './heroes.ts';
import {
  BATTLEFIELD_COLUMNS,
  RESERVE_SPOTS_PER_LINE,
  BASE_ROW_COUNT,
  BATTLEFIELD_ROWS,
  MAX_HERO_CELLS,
  ALOFT_REACHABLE_TYPES,
} from './rules.ts';
import { FEATURES } from './features.ts';
import type {
  CardDef,
  CardType,
  HeroRow,
  HeroSize,
  HeroUnit,
} from './types.ts';

// --- TYPES ---
/** A hero that has not been placed yet (no row or column). */
export type UnplacedHero = Omit<HeroUnit, 'row' | 'col'>;

/**
 * Which heroes a card may be aimed at:
 * - none:     the card needs no target
 * - front:    melee; front row only
 * - any:      Reach or a curse; any hero
 * - pullable: a hero past the front row with room one row nearer, or an
 *             immovable one past the front row (a boss: the pull fails
 *             on it, but the rest of the card still lands)
 * - pushable: a hero short of the last row with room one row farther,
 *             or an immovable one there (the push fails the same way)
 */
export type TargetRule = 'none' | 'front' | 'any' | 'pullable' | 'pushable';

// --- GEOMETRY ---

/** Left edges of the half-column cells occupied by a footprint. */
const spanOf = (col: number, size: number): number[] =>
  Array.from({ length: size * 2 }, (_, offset) => col + offset / 2);

/**
 * The rows in play, nearest first: all of BATTLEFIELD_ROWS with the
 * three-row flag on, else the first BASE_ROW_COUNT (read on each call,
 * so a test can flip the flag).
 */
export const activeRows = (): readonly HeroRow[] =>
  FEATURES.threeRowField
    ? BATTLEFIELD_ROWS
    : BATTLEFIELD_ROWS.slice(0, BASE_ROW_COUNT);

/** A row's depth: 0 for the front row, 1 for the next, and so on. */
export const rowDepth = (row: HeroRow): number => BATTLEFIELD_ROWS.indexOf(row);

/**
 * The row `steps` rows farther from the villain (negative: nearer), or
 * null when that runs off the field.
 */
export const rowShifted = (row: HeroRow, steps: number): HeroRow | null =>
  activeRows()[rowDepth(row) + steps] ?? null;

/** The farthest row's depth (Line 3, or Line 2 with the flag off). */
const lastRowDepth = (): number => activeRows().length - 1;

/** How many columns a hero fills. */
export const sizeOf = (unit: Pick<HeroUnit, 'heroId'>): HeroSize =>
  getHero(unit.heroId).size;

/** The back-row columns (offsets from its own) a front hero also fills. */
const backColsOf = (unit: Pick<HeroUnit, 'heroId'>): readonly number[] =>
  getHero(unit.heroId).backCols ?? [];

/** True for a hero that also fills cells in the row behind its own. */
export const isDeep = (unit: Pick<HeroUnit, 'heroId'>): boolean =>
  backColsOf(unit).length > 0;

/**
 * True for a hero no pull or push can move: a boss, or a deep hero.
 * Charge and Back Step move the whole field, bosses included (a deep
 * one keeps its place); Anchored heroes hold their line.
 */
export const isImmovable = (unit: Pick<HeroUnit, 'heroId'>): boolean =>
  isDeep(unit) || getHero(unit.heroId).tier === 'boss' || isAnchored(unit);

/**
 * True for an Anchored hero (the Ballista, the Horned Sentinel): no
 * pull or push moves it, and it holds its line when the villain
 * Charges, Back Steps or is knocked back. The rest of the field moves
 * around it (see fieldMovers).
 */
export const isAnchored = (unit: Pick<HeroUnit, 'heroId'>): boolean =>
  getHero(unit.heroId).passives?.includes('anchored') ?? false;

/** True for a hero flown up into the sky (Aloft): out of Melee reach. */
export const isAloft = (unit: Pick<HeroUnit, 'statuses'>): boolean =>
  unit.statuses.aloft > 0;

/**
 * True when a card of `type` can reach `unit`: anyone on the ground, and
 * a hero Aloft only for Range, Magic and Curse (ALOFT_REACHABLE_TYPES).
 */
export const canReach = (
  unit: Pick<HeroUnit, 'statuses'>,
  type: CardType
): boolean => !isAloft(unit) || ALOFT_REACHABLE_TYPES.has(type);

/** One battlefield cell. */
export type Cell = { row: HeroRow; col: number };

/** Every cell a hero fills where it stands: its row, plus any back reach. */
export const cellsOf = (
  unit: Pick<HeroUnit, 'heroId' | 'row' | 'col'>
): Cell[] => [
  ...spanOf(unit.col, sizeOf(unit)).map((col) => ({ row: unit.row, col })),
  ...backColsOf(unit)
    .flatMap((offset) => spanOf(unit.col + offset, 1))
    .map((col) => ({
      row: reachRowOf(unit),
      col,
    })),
];

/** The row a deep hero's reach fills: the one behind its own. */
const reachRowOf = (unit: Pick<HeroUnit, 'row'>): HeroRow =>
  rowShifted(unit.row, 1) ?? unit.row;

/**
 * The lane a Piercing hit goes through: a hero's middle lane (for a
 * two-wide hero, its first), so a pierce is always one column.
 */
const pierceLaneOf = (unit: HeroUnit): number =>
  unit.col + Math.floor(sizeOf(unit) - 0.5) / 2;

/**
 * The heroes a Piercing hit on `unit` passes on to: everyone else in
 * its pierce lane (pierceLaneOf), in every row, nearest row first. A
 * pierce runs down the whole column either way, so a Backline target
 * pierces the hero in front of it and the one on the Horizon behind it.
 * A deep hero (a boss) counts once however many rows it fills. Aloft
 * heroes are out of reach.
 */
export const heroesPiercedPast = (
  heroes: readonly HeroUnit[],
  unit: HeroUnit
): HeroUnit[] => {
  const lane = pierceLaneOf(unit);
  const nearestDepthInLane = (other: HeroUnit): number =>
    Math.min(
      ...cellsOf(other)
        .filter((cell) => cell.col === lane)
        .map((cell) => rowDepth(cell.row))
    );
  return heroes
    .filter(
      (other) =>
        other.uid !== unit.uid &&
        !isAloft(other) &&
        cellsOf(other).some((cell) => cell.col === lane)
    )
    .sort((a, b) => nearestDepthInLane(a) - nearestDepthInLane(b));
};

/** The rows a hero stands in: its own, plus the one behind for a deep one. */
export const rowsOf = (unit: Pick<HeroUnit, 'heroId' | 'row'>): HeroRow[] =>
  isDeep(unit) ? [unit.row, reachRowOf(unit)] : [unit.row];

/** How many battlefield cells a hero fills. */
export const cellCountOf = (unit: Pick<HeroUnit, 'heroId'>): number =>
  sizeOf(unit) + backColsOf(unit).length;

/** Cells heroes may still fill before the field is full (MAX_HERO_CELLS). */
export const freeHeroCells = (heroes: readonly HeroUnit[]): number =>
  MAX_HERO_CELLS - heroes.reduce((cells, unit) => cells + cellCountOf(unit), 0);

/**
 * Rows to try for a hero whose home is `home`: home first, then the
 * others by how far they are from it (the farther one first on a tie,
 * so overflow drifts out of reach rather than into it).
 */
const rowsByNearnessTo = (home: HeroRow): HeroRow[] =>
  [...activeRows()].sort(
    (a, b) =>
      Math.abs(rowDepth(a) - rowDepth(home)) -
        Math.abs(rowDepth(b) - rowDepth(home)) || rowDepth(b) - rowDepth(a)
  );

/** True when no hero (other than `ignoreUid`) stands in those columns. */
const isSpanOpen = (
  heroes: readonly HeroUnit[],
  row: HeroRow,
  span: readonly number[],
  ignoreUid = -1
): boolean =>
  heroes.every(
    (unit) =>
      unit.uid === ignoreUid ||
      // A hero in a reserve spot blocks no seat.
      unit.inReserve ||
      !cellsOf(unit).some((cell) => cell.row === row && span.includes(cell.col))
  );

/** True when no hero stands in this cell. */
export const isCellOpen = (heroes: readonly HeroUnit[], cell: Cell): boolean =>
  isSpanOpen(heroes, cell.row, [cell.col]);

/**
 * Columns to try, in order, by row and size. A lone front hero stands
 * centre stage, and back-row heroes start at the flanks so they are not
 * hidden (and pull-blocked) behind it.
 */
const PREFERRED_COLUMNS: Record<
  HeroRow,
  Record<HeroSize, readonly number[]>
> = {
  front: { 1: [1, 0, 2, 0.5, 1.5], 1.5: [0, 1.5, 0.5, 1], 2: [0, 1], 3: [0] },
  back: { 1: [0, 2, 1, 0.5, 1.5], 1.5: [1.5, 0, 1, 0.5], 2: [1, 0], 3: [0] },
  horizon: { 1: [1, 0, 2, 0.5, 1.5], 1.5: [0, 1.5, 0.5, 1], 2: [0, 1], 3: [0] },
};

/**
 * The first column where a hero of `size` fits in `row` (and, for a
 * deep hero, its `backCols` behind it are free too), or null.
 */
const firstOpenColumn = (
  heroes: readonly HeroUnit[],
  row: HeroRow,
  size: HeroSize,
  backCols: readonly number[] = [],
  centerBoss = false
): number | null => {
  const preferred = PREFERRED_COLUMNS[row][size];
  const center = (BATTLEFIELD_COLUMNS - size) / 2;
  const columns = centerBoss && preferred.includes(center)
    ? [center, ...preferred.filter((col) => col !== center)]
    : preferred;
  return columns.find(
    (col) =>
      col + size <= BATTLEFIELD_COLUMNS &&
      isSpanOpen(heroes, row, spanOf(col, size)) &&
      isSpanOpen(
        heroes,
        'back',
        backCols.flatMap((offset) => spanOf(col + offset, 1))
      )
  ) ?? null;
};

// --- FORMATION ---

/** Places one hero: its own row first, then the others, nearest first. */
const placeHero = (
  placed: readonly HeroUnit[],
  unit: UnplacedHero,
  entryRows?: readonly HeroRow[]
): HeroUnit => {
  const { row, size, backCols, tier } = getHero(unit.heroId);
  // A deep hero only ever stands in the front row (reaching back too).
  if (backCols?.length) {
    const col = firstOpenColumn(placed, 'front', size, backCols);
    return { ...unit, row: 'front', col: col ?? 0 };
  }
  for (const candidate of entryRows ?? rowsByNearnessTo(row)) {
    const col = firstOpenColumn(placed, candidate, size, undefined, tier === 'boss');
    if (col !== null) return { ...unit, row: candidate, col };
  }
  // Hordes are sized to fit, so this only guards against a bad catalog.
  return { ...unit, row, col: 0 };
};

/** True for a hero whose home is the front row (it closes in to fight). */
export const isMeleeMinded = (unit: Pick<HeroUnit, 'heroId'>): boolean =>
  getHero(unit.heroId).row === 'front';

/** Preferred fighting row, clamped to the rows available in this battle. */
export const preferredRow = (unit: Pick<HeroUnit, 'heroId'>): HeroRow =>
  activeRows()[Math.min(rowDepth(getHero(unit.heroId).row), lastRowDepth())]!;

/** Positive behind home, negative in front of it. */
const rowsBehindHome = (unit: HeroUnit): number =>
  rowDepth(unit.row) - rowDepth(preferredRow(unit));

/**
 * An Anchored hero (the Ballista) is set up on the farthest row it has
 * room on before the march.
 */
const anchorFarBack = (heroes: HeroUnit[], uid: number): HeroUnit[] => {
  let field = heroes;
  // Imperative: step it back a row at a time until it can't go farther
  // (that row's heroes slide aside for it, as for a push).
  for (let step = 0; step < BATTLEFIELD_ROWS.length; step += 1) {
    const moved = moveRows(field, uid, 1, true);
    if (moved === field) break;
    field = moved;
  }
  return field;
};

/**
 * A new horde marches in from afar: every hero placed at its home row
 * drops one row back while that row has room. Anchored heroes set up on
 * the farthest row first, then the farthest homes go (ranged onto the
 * Horizon, freeing the Backline for the melee), then uid order.
 * Imperative: each move changes the room left for the next.
 */
const marchInFromAfar = (heroes: HeroUnit[]): HeroUnit[] => {
  const order = [...heroes].sort(
    (a, b) =>
      Number(isAnchored(b)) - Number(isAnchored(a)) ||
      rowDepth(getHero(b.heroId).row) - rowDepth(getHero(a.heroId).row) ||
      a.uid - b.uid
  );
  let field = heroes;
  for (const unit of order) {
    const current = field.find((hero) => hero.uid === unit.uid);
    if (current && isAnchored(current))
      field = anchorFarBack(field, current.uid);
    else if (
      current &&
      rowsBehindHome(current) === 0 &&
      canPush(field, current, 1, false)
    )
      field = pushHero(field, current.uid, 1, false);
  }
  return field;
};

/**
 * Lines a horde up on the battlefield. Everyone first takes their home
 * row (big heroes placed first so they always find room), then each
 * drops one row back as far as there is room, so a new wave starts out
 * of melee reach. The result keeps the original order (uids).
 */
export const formUp = (
  units: readonly UnplacedHero[],
  formation: 'march' | 'furthest' = 'march'
): HeroUnit[] => {
  // Replacement waves enter at maximum distance, spilling into nearer rows.
  const entryRows =
    formation === 'furthest' ? activeRows().toReversed() : undefined;
  const bySizeDesc = [...units].sort((a, b) => cellCountOf(b) - cellCountOf(a));
  const placed = bySizeDesc.reduce<HeroUnit[]>(
    (field, unit) => [...field, placeHero(field, unit, entryRows)],
    []
  );
  const ordered = units.map(
    (unit) =>
      placed.find((hero) => hero.uid === unit.uid) ?? placeHero([], unit)
  );
  return formation === 'march' ? marchInFromAfar(ordered) : ordered;
};

/**
 * The row a hero would stand in `steps` rows away, or null when it (or a
 * deep hero's reach, one row behind) would run off the field.
 */
const shiftedRowOf = (unit: HeroUnit, steps: number): HeroRow | null => {
  const row = rowShifted(unit.row, steps);
  if (row === null || !isDeep(unit)) return row;
  return rowShifted(row, 1) === null ? null : row;
};

/**
 * Shifts every hero `steps` rows (negative: nearer), keeping columns.
 * The caller makes sure nobody runs off the field; anyone who would
 * (a deep boss whose reach has no row) just stays put.
 */
const shiftField = (heroes: readonly HeroUnit[], steps: number): HeroUnit[] =>
  heroes.map((unit) => {
    const row = shiftedRowOf(unit, steps);
    return row === null ? unit : { ...unit, row };
  });

/**
 * One hero moves `steps` rows as a whole, keeping its columns, when its
 * new cells are on the field and free; otherwise the field is
 * unchanged. For heroes no push may move (a deep boss, an Anchored
 * one) when the villain itself moves.
 */
const shiftWhole = (
  heroes: HeroUnit[],
  uid: number,
  steps: number
): HeroUnit[] => {
  const unit = heroes.find((hero) => hero.uid === uid);
  const row = unit && shiftedRowOf(unit, steps);
  if (!unit || !row) return heroes;
  const moved = { ...unit, row };
  const taken = heroes.filter((hero) => hero.uid !== uid).flatMap(cellsOf);
  const isClear = cellsOf(moved).every(
    (cell) => !taken.some((t) => t.row === cell.row && t.col === cell.col)
  );
  return isClear
    ? heroes.map((hero) => (hero.uid === uid ? moved : hero))
    : heroes;
};

/** The depth of the nearest row anyone stands in (0: the front row). */
const nearestDepth = (heroes: readonly HeroUnit[]): number =>
  Math.min(...heroes.map((unit) => rowDepth(unit.row)));

/**
 * Who moves when the villain Charges, Back Steps or is knocked back:
 * everyone but the Anchored heroes, who hold their line. When only
 * Anchored heroes are left they move too, so the villain can always
 * close in on the last one (a lone Ballista on Line 3 would otherwise
 * be out of Melee reach for good).
 */
const fieldMovers = (heroes: readonly HeroUnit[]): HeroUnit[] => {
  const unanchored = heroes.filter((unit) => !isAnchored(unit));
  return unanchored.length > 0 ? unanchored : [...heroes];
};

/**
 * One hero moves `steps` rows with the field, going around whoever
 * holds its spot: it keeps its columns when they are free, else slides
 * in beside them (that row shifts over to make room), else moves fewer
 * rows, else stays. Imperative: tries the nearest fit first.
 */
const shiftAround = (
  heroes: HeroUnit[],
  uid: number,
  steps: number
): HeroUnit[] => {
  for (let rows = Math.abs(steps); rows > 0; rows -= 1) {
    const delta = Math.sign(steps) * rows;
    const kept = shiftWhole(heroes, uid, delta);
    if (kept !== heroes) return kept;
    const slid = moveRows(heroes, uid, delta, true);
    if (slid !== heroes) return slid;
  }
  return heroes;
};

/**
 * Charge: when the front row is empty, the field closes in by up to
 * `maxRows` rows, stopping once someone stands in the front row (a
 * field on the Horizon only, with maxRows 2, lands in the front row).
 * Anchored heroes hold their line and the rest go around them,
 * nearest first so each row ahead is already clear.
 */
export const stepForward = (
  heroes: readonly HeroUnit[],
  maxRows: number
): HeroUnit[] => {
  if (heroes.length === 0) return [...heroes];
  const movers = fieldMovers(heroes);
  const steps = -Math.min(maxRows, nearestDepth(movers));
  if (movers.length === heroes.length) return shiftField(heroes, steps);
  const nearestFirst = movers.toSorted(
    (a, b) => rowDepth(a.row) - rowDepth(b.row)
  );
  return nearestFirst.reduce(
    (field, unit) => shiftAround(field, unit.uid, steps),
    [...heroes]
  );
};

// --- SUMMONS ---

/**
 * Where `count` summoned heroes of `size` would stand: open columns in
 * the rows the summoner stands in (its own row first), nearest to it
 * first (left wins a tie). Fewer than `count` when those rows run out
 * of room or the heroes would fill more than MAX_HERO_CELLS cells.
 * Imperative: each seat taken changes the room left for the next.
 */
export const summonSeats = (
  heroes: readonly HeroUnit[],
  summoner: HeroUnit,
  size: HeroSize,
  count: number
): Cell[] => {
  const centre = summoner.col + (sizeOf(summoner) - 1) / 2;
  const byNearness = startColumns(size).sort(
    (a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b
  );
  const seats: Cell[] = [];
  const wanted = Math.min(count, Math.floor(freeHeroCells(heroes) / size));
  for (const row of rowsOf(summoner)) {
    for (const col of byNearness) {
      if (seats.length >= wanted) return seats;
      const span = spanOf(col, size);
      const isTaken = seats.some(
        (seat) =>
          seat.row === row &&
          spanOf(seat.col, size).some((cell) => span.includes(cell))
      );
      if (!isTaken && isSpanOpen(heroes, row, span)) seats.push({ row, col });
    }
  }
  return seats;
};

// --- MOVEMENT ---

/** Where each hero of one row stands: uid -> leftmost column. */
type Seating = Map<number, number>;

/** Every leftmost column a hero of `size` can take. */
const startColumns = (size: HeroSize): number[] =>
  Array.from({ length: (BATTLEFIELD_COLUMNS - size) * 2 + 1 }, (_, i) => i / 2);

/**
 * True when no two seated heroes share a column, and none stands in a
 * `blocked` column (held by a boss that cannot slide).
 */
const isSeatingValid = (
  seats: readonly { col: number; size: number }[],
  blocked: readonly number[] = []
): boolean => {
  const cells = seats.flatMap(({ col, size }) => spanOf(col, size));
  return (
    new Set(cells).size === cells.length &&
    cells.every((col) => !blocked.includes(col))
  );
};

/** Every way to give each hero in `units` a leftmost column. */
const allSeatings = (
  units: readonly HeroUnit[]
): { uid: number; col: number; size: number }[][] =>
  units.reduce<{ uid: number; col: number; size: number }[][]>(
    (options, unit) =>
      options.flatMap((seated) =>
        startColumns(sizeOf(unit)).map((col) => [
          ...seated,
          { uid: unit.uid, col, size: sizeOf(unit) },
        ])
      ),
    [[]]
  );

/** True when the heroes already in the row keep their left-to-right order. */
const keepsOrder = (
  seats: readonly { uid: number; col: number }[],
  rowOrder: readonly number[]
): boolean => {
  const cols = rowOrder.map(
    (uid) => seats.find((seat) => seat.uid === uid)?.col ?? 0
  );
  return cols.every(
    (col, index) => index === 0 || col > (cols[index - 1] ?? 0)
  );
};

/**
 * How the hero would be seated if it moved to `row`: it keeps
 * its own columns when it can, and that row's heroes slide sideways to
 * make room, never passing each other. Picks the seating that moves
 * everyone the least (moving the hero itself costs most, so it shifts
 * only when it must). Returns
 * null when the other row has no room at all.
 * Brute force on purpose: a row is 3 columns and at most 3 heroes, so
 * there are only a few dozen seatings to try.
 */
const seatInRow = (
  heroes: readonly HeroUnit[],
  unit: HeroUnit,
  row: HeroRow | null
): Seating | null => {
  if (isDeep(unit) || row === null || row === unit.row) return null;
  const rowHeroes = heroes
    .filter(
      (other) => other.row === row && !isImmovable(other) && !other.inReserve
    )
    .sort((a, b) => a.col - b.col);
  // Immovable heroes (bosses) never slide aside: their columns are taken.
  const blocked = heroes
    .filter((other) => other.uid !== unit.uid && isImmovable(other))
    .flatMap(cellsOf)
    .filter((cell) => cell.row === row)
    .map((cell) => cell.col);
  const rowOrder = rowHeroes.map((hero) => hero.uid);
  const movers = [unit, ...rowHeroes];
  const startOf = new Map(movers.map((hero) => [hero.uid, hero.col]));
  /** Columns moved, with the moving hero's own shift weighted heavily. */
  const costOf = (seats: readonly { uid: number; col: number }[]) =>
    seats.reduce(
      (total, { uid, col }) =>
        total +
        Math.abs(col - (startOf.get(uid) ?? col)) * (uid === unit.uid ? 10 : 1),
      0
    );
  const best = allSeatings(movers)
    .filter(
      (seats) => isSeatingValid(seats, blocked) && keepsOrder(seats, rowOrder)
    )
    .reduce<{ uid: number; col: number }[] | null>(
      (cheapest, seats) =>
        cheapest === null || costOf(seats) < costOf(cheapest)
          ? seats
          : cheapest,
      null
    );
  return best && new Map(best.map(({ uid, col }) => [uid, col]));
};

/**
 * The reserve spot a forced move into a full `row` would use: the hero
 * keeps its columns (pulled in range of the grid), or null when the
 * row's reserve spots are all taken.
 */
const reserveColumn = (
  heroes: readonly HeroUnit[],
  unit: HeroUnit,
  row: HeroRow | null
): number | null => {
  if (isDeep(unit) || row === null || row === unit.row) return null;
  const taken = heroes.filter(
    (other) => other.uid !== unit.uid && other.row === row && other.inReserve
  ).length;
  if (taken >= RESERVE_SPOTS_PER_LINE) return null;
  return Math.min(Math.max(unit.col, 0), BATTLEFIELD_COLUMNS - sizeOf(unit));
};

/** True when a forced move can put this hero in `row` (a seat or a reserve spot). */
const hasRoomIn = (
  heroes: readonly HeroUnit[],
  unit: HeroUnit,
  row: HeroRow | null
): boolean =>
  seatInRow(heroes, unit, row) !== null ||
  reserveColumn(heroes, unit, row) !== null;

/** True when a pull (one row nearer) would work on this hero right now. */
export const canPull = (heroes: readonly HeroUnit[], unit: HeroUnit) =>
  !isImmovable(unit) && hasRoomIn(heroes, unit, rowShifted(unit.row, -1));

/** True when a push (one row farther) would work on this hero right now. */
export const canPush = (
  heroes: readonly HeroUnit[],
  unit: HeroUnit,
  rows = 1,
  useReserve = true
) =>
  !isImmovable(unit) &&
  activeRows().some((row) => {
    const distance = rowDepth(row) - rowDepth(unit.row);
    const hasRoom = useReserve
      ? hasRoomIn(heroes, unit, row)
      : seatInRow(heroes, unit, row) !== null;
    return distance > 0 && distance <= rows && hasRoom;
  });

/**
 * Moves one hero `steps` rows (-1 nearer, 1 farther), sliding that row
 * over to make room. No-op when blocked.
 */
const moveRows = (
  heroes: HeroUnit[],
  uid: number,
  steps: number,
  voluntary = false,
  useReserve = false
) => {
  const unit = heroes.find((hero) => hero.uid === uid);
  // Voluntary repositioning ignores forced-movement immunity.
  if (!unit || (isImmovable(unit) && !voluntary)) return heroes;
  const row = rowShifted(unit.row, steps);
  const seating = seatInRow(heroes, unit, row);
  // RESERVE: a forced move into a full line takes one of its reserve spots.
  const reserveCol =
    useReserve && !voluntary ? reserveColumn(heroes, unit, row) : null;
  if (!seating && reserveCol !== null && row !== null)
    return heroes.map((hero) =>
      hero.uid === uid
        ? { ...hero, row, col: reserveCol, inReserve: true }
        : hero
    );
  if (!seating || row === null) return heroes;
  // No stepForward here: pushing the last front hero back leaves the
  // front empty until the villain Charges.
  return heroes.map((hero) => {
    const col = seating.get(hero.uid);
    if (col === undefined) return hero;
    return hero.uid === uid
      ? { ...hero, row, col, inReserve: false }
      : { ...hero, col };
  });
};

/**
 * Moves one hero up to `rows` rows, one row at a time, stopping where
 * it is blocked (Pull 2 with one row of room moves it one row).
 * Imperative: each step changes the room left for the next.
 */
const moveRowsUpTo = (
  heroes: HeroUnit[],
  uid: number,
  direction: -1 | 1,
  rows: number
) => {
  let field = heroes;
  for (let step = 0; step < rows; step += 1)
    field = moveRows(field, uid, direction, false, true);
  return field;
};

/** Pull N: the hero steps up to `rows` rows nearer (stops if blocked). */
export const pullHero = (heroes: HeroUnit[], uid: number, rows = 1) =>
  moveRowsUpTo(heroes, uid, -1, rows);

/** Push straight back, sliding occupants aside. Skip a full row if there is room farther within range. */
export const pushHero = (
  heroes: HeroUnit[],
  uid: number,
  rows = 1,
  useReserve = true
) => {
  let field = heroes;
  let remaining = Math.min(rows, lastRowDepth());
  for (let distance = 1; distance <= remaining; distance++) {
    const moved = moveRows(field, uid, distance, false, useReserve);
    if (moved === field) continue;
    field = moved;
    remaining -= distance;
    distance = 0;
  }
  return field;
};

/** After acting, each hero tries one step toward its preferred row. */
export const advanceHeroes = (heroes: HeroUnit[]): HeroUnit[] => {
  let field = heroes;
  for (const unit of heroes) {
    if (isAnchored(unit)) continue;
    const direction = -Math.sign(rowsBehindHome(unit));
    if (!direction) continue;
    field = isDeep(unit)
      ? shiftWhole(field, unit.uid, direction)
      : moveRows(field, unit.uid, direction, true);
  }
  return field;
};

/**
 * Back Step: every hero falls back `rows` rows where there is room
 * behind it. Heroes on the last row stay, and so does anyone whose
 * row behind is full, and so do Anchored heroes (see fieldMovers).
 * The farthest heroes move first, so they make
 * room for the ones in front of them. Imperative: each step changes
 * the room left for the next.
 */
export const fallBack = (
  heroes: readonly HeroUnit[],
  rows: number,
  knockbackTargets?: ReadonlySet<number>
): HeroUnit[] => {
  let field = [...heroes];
  if (knockbackTargets) {
    const targets = field
      .filter((unit) => knockbackTargets.has(unit.uid))
      .sort((a, b) => rowDepth(b.row) - rowDepth(a.row));
    for (const unit of targets) field = pushHero(field, unit.uid, rows);
    return field;
  }
  for (let step = 0; step < rows; step += 1) {
    // Anchored heroes hold their line; the rest slide around them.
    const movers = new Set(fieldMovers(field).map((unit) => unit.uid));
    const farthestFirst = field
      .filter((unit) => movers.has(unit.uid))
      .sort((a, b) => rowDepth(b.row) - rowDepth(a.row));
    for (const unit of farthestFirst) {
      field = isImmovable(unit)
        ? shiftWhole(field, unit.uid, 1)
        : pushHero(field, unit.uid, 1, false);
    }
  }
  return field;
};

// --- TARGETING ---

/** True for effects that are aimed at one chosen hero. */
const isSingleTarget = (effect: CardDef['effects'][number]): boolean =>
  effect.kind === 'reap' ||
  effect.kind === 'pull' ||
  (effect.kind === 'push' && effect.target !== 'all') ||
  ((effect.kind === 'damage' ||
    effect.kind === 'hex' ||
    effect.kind === 'poison' ||
    effect.kind === 'burn' ||
    effect.kind === 'frost' ||
    effect.kind === 'shock' ||
    effect.kind === 'weaken' ||
    effect.kind === 'dispel' ||
    effect.kind === 'disrupt') &&
    effect.target === 'one');

/** Works out which heroes a card may be aimed at (see TargetRule). */
export const targetRuleOf = (cardId: CardId): TargetRule => {
  const { effects, reach, type } = getCard(cardId);
  const kinds = effects.map((effect) => effect.kind);
  // A front-row Melee target still takes the strike when Knockback is blocked.
  if (type === 'melee' && !reach && effects.some(isSingleTarget))
    return 'front';
  if (kinds.includes('pull')) return 'pullable';
  if (
    effects.some((effect) => effect.kind === 'push' && effect.target !== 'all')
  )
    return 'pushable';
  if (!effects.some(isSingleTarget)) return 'none';
  return 'any';
};

// --- WHO A CARD AFFECTS ---
/**
 * Effect kinds that land on the villain (the player) or its cards, not
 * a hero. Imbue acts on a card in hand.
 */
const SELF_EFFECT_KINDS: ReadonlySet<CardDef['effects'][number]['kind']> =
  new Set([
    'guard',
    'cloak',
    'wrath',
    'buff',
    'draw',
    'energy',
    'heal',
    'cleanse',
    'protect',
    'brace',
    'move',
    'rush',
    'charge',
    'backStep',
    'momentum',
    'armor',
    'imbue',
  ]);

/** True when an effect lands on the villain rather than a hero. */
export const isSelfEffect = (effect: CardDef['effects'][number]): boolean =>
  SELF_EFFECT_KINDS.has(effect.kind);

/** True when a card does something to the villain (guard, draw ...). */
export const affectsSelf = (cardId: CardId): boolean =>
  getCard(cardId).effects.some(isSelfEffect);

/** True when a card does something to one or more heroes. */
export const affectsHeroes = (cardId: CardId): boolean =>
  getCard(cardId).effects.some((effect) => !isSelfEffect(effect));

/**
 * The heroes that fit a target rule, in battlefield order, for a card
 * of `type`. A hero Aloft fits only cards that can reach it (canReach).
 */
export const legalTargets = (
  heroes: readonly HeroUnit[],
  rule: TargetRule,
  type: CardType,
  pushRows = 1,
  meleeDepth = 0
): HeroUnit[] => {
  const reachable = heroes.filter((unit) => !isCloaked(unit) && canReach(unit, type));
  switch (rule) {
    case 'none':
    case 'any':
      return reachable;
    case 'front':
      // LUNGE (skill tree) lets Melee reach meleeDepth rows past the front.
      return reachable.filter((unit) => rowDepth(unit.row) <= meleeDepth);
    case 'pullable':
      return reachable.filter(
        (unit) =>
          (isImmovable(unit) && rowDepth(unit.row) > 0) || canPull(heroes, unit)
      );
    case 'pushable':
      return reachable.filter(
        (unit) =>
          (isImmovable(unit) && rowDepth(unit.row) < lastRowDepth()) ||
          canPush(heroes, unit, pushRows)
      );
  }
};

/**
 * Heroes an area effect of a `type` card hits: melee sweeps the front
 * row, Reach all. A hero Aloft is hit only by types that reach it
 * (canReach; a Range or Magic hit then rolls its evasion).
 */
export const areaTargets = (
  heroes: readonly HeroUnit[],
  isMelee: boolean,
  type: CardType,
  meleeDepth = 0
): HeroUnit[] =>
  heroes.filter(
    (unit) =>
      canReach(unit, type) && (!isMelee || rowDepth(unit.row) <= meleeDepth)
  );

/**
 * Every hero an area card would hit: hex and weaken to ALL reach every
 * hero, damage to ALL reaches the front row only unless the card has
 * Reach (mirrors resolveTargets in combat.ts).
 */
export const cardAreaTargets = (
  heroes: readonly HeroUnit[],
  cardId: CardId,
  meleeDepth = 0
): HeroUnit[] => {
  const { effects, reach, type } = getCard(cardId);
  const areaEffects = effects.filter(
    (effect) => 'target' in effect && effect.target === 'all'
  );
  const hitsEveryone = areaEffects.some(
    (effect) => (effect.kind !== 'damage' && effect.kind !== 'push') || reach
  );
  if (areaEffects.length === 0) return [];
  return areaTargets(heroes, !hitsEveryone, type, meleeDepth);
};
