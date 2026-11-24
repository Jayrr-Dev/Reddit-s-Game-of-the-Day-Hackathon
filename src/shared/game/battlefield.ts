// ===================================================================
// BATTLEFIELD
// Where heroes stand. The field is a grid BATTLEFIELD_COLUMNS wide and
// two rows deep; each hero fills `size` neighbouring columns in one row.
// A hero with `backCols` (a boss) stands in the front row and also fills
// those columns of the back row, so its footprint can be any shape (all
// six cells, or a T: the front row plus the back centre). It never
// changes row. Bosses are immovable: a pull or push aimed at them fails.
//
// RULES
//   - Melee cards hit the front row only. Reach cards, curses and Hex
//     hit any hero.
//   - A pull drags a back-row hero forward into its own columns. If
//     someone stands there, the front row slides sideways to make room,
//     so a pull only fails when the front row has no space left. A push
//     is the mirror image.
//   - A new horde forms up in the back row as far as it has room
//     (overflow stays in front), out of melee reach. At the end of each heroes' turn, every
//     melee-minded hero (one whose home row is the front) in the back
//     row steps up if there is room. Ranged heroes hold the back row
//     until the villain Charges.
//   - Back Step: with the back row empty, the villain falls back and
//     the whole front row ends up in the back row.
// ===================================================================

import { getCard, type CardId } from './cards.ts';
import { getHero } from './heroes.ts';
import { BATTLEFIELD_COLUMNS } from './rules.ts';
import type { CardDef, HeroRow, HeroSize, HeroUnit } from './types.ts';

// --- TYPES ---
/** A hero that has not been placed yet (no row or column). */
export type UnplacedHero = Omit<HeroUnit, 'row' | 'col'>;

/**
 * Which heroes a card may be aimed at:
 * - none:     the card needs no target
 * - front:    melee; front row only
 * - any:      Reach or a curse; any hero
 * - pullable: a back-row hero with room for it in the front row, or an
 *             immovable one in the back row (a boss: the pull fails on
 *             it, but the rest of the card still lands)
 * - pushable: a front-row hero with room for it in the back row, or an
 *             immovable one in the front row (the push fails the same way)
 */
export type TargetRule = 'none' | 'front' | 'any' | 'pullable' | 'pushable';

// --- GEOMETRY ---

/** Columns a hero fills, e.g. col 1 size 2 -> [1, 2]. */
const spanOf = (col: number, size: number): number[] =>
  Array.from({ length: size }, (_, offset) => col + offset);

/** How many columns a hero fills. */
export const sizeOf = (unit: Pick<HeroUnit, 'heroId'>): HeroSize =>
  getHero(unit.heroId).size;

/** The back-row columns (offsets from its own) a front hero also fills. */
const backColsOf = (unit: Pick<HeroUnit, 'heroId'>): readonly number[] =>
  getHero(unit.heroId).backCols ?? [];

/** True for a hero that reaches into the back row too (it never moves row). */
export const isDeep = (unit: Pick<HeroUnit, 'heroId'>): boolean =>
  backColsOf(unit).length > 0;

/**
 * True for a hero no pull or push can move: a boss, or a deep hero.
 * Charge and Back Step move the whole field, bosses included (a deep
 * one keeps its place).
 */
export const isImmovable = (unit: Pick<HeroUnit, 'heroId'>): boolean =>
  isDeep(unit) || getHero(unit.heroId).tier === 'boss';

/** True for a hero flown up out of reach (Aloft): no card can touch it. */
export const isAloft = (unit: Pick<HeroUnit, 'statuses'>): boolean =>
  unit.statuses.aloft > 0;

/** One battlefield cell. */
export type Cell = { row: HeroRow; col: number };

/** Every cell a hero fills where it stands: its row, plus any back reach. */
export const cellsOf = (
  unit: Pick<HeroUnit, 'heroId' | 'row' | 'col'>
): Cell[] => [
  ...spanOf(unit.col, sizeOf(unit)).map((col) => ({ row: unit.row, col })),
  ...backColsOf(unit).map((offset) => ({
    row: 'back' as const,
    col: unit.col + offset,
  })),
];

/** The rows a hero stands in: its own, plus the back for a deep one. */
export const rowsOf = (unit: Pick<HeroUnit, 'heroId' | 'row'>): HeroRow[] =>
  isDeep(unit) ? ['front', 'back'] : [unit.row];

/** How many battlefield cells a hero fills. */
export const cellCountOf = (unit: Pick<HeroUnit, 'heroId'>): number =>
  sizeOf(unit) + backColsOf(unit).length;

/** The row a hero is not in. */
const otherRow = (row: HeroRow): HeroRow =>
  row === 'front' ? 'back' : 'front';

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
  front: { 1: [1, 0, 2], 2: [0, 1], 3: [0] },
  back: { 1: [0, 2, 1], 2: [1, 0], 3: [0] },
};

/**
 * The first column where a hero of `size` fits in `row` (and, for a
 * deep hero, its `backCols` behind it are free too), or null.
 */
const firstOpenColumn = (
  heroes: readonly HeroUnit[],
  row: HeroRow,
  size: HeroSize,
  backCols: readonly number[] = []
): number | null =>
  PREFERRED_COLUMNS[row][size].find(
    (col) =>
      col + size <= BATTLEFIELD_COLUMNS &&
      isSpanOpen(heroes, row, spanOf(col, size)) &&
      isSpanOpen(
        heroes,
        'back',
        backCols.map((offset) => col + offset)
      )
  ) ?? null;

// --- FORMATION ---

/** Places one hero: its own row first, then the other row. */
const placeHero = (
  placed: readonly HeroUnit[],
  unit: UnplacedHero
): HeroUnit => {
  const { row, size, backCols } = getHero(unit.heroId);
  // A deep hero only ever stands in the front row (reaching back too).
  if (backCols?.length) {
    const col = firstOpenColumn(placed, 'front', size, backCols);
    return { ...unit, row: 'front', col: col ?? 0 };
  }
  for (const candidate of [row, otherRow(row)]) {
    const col = firstOpenColumn(placed, candidate, size);
    if (col !== null) return { ...unit, row: candidate, col };
  }
  // Hordes are sized to fit, so this only guards against a bad catalog.
  return { ...unit, row, col: 0 };
};

/** True for a hero whose home is the front row (it closes in to fight). */
export const isMeleeMinded = (unit: Pick<HeroUnit, 'heroId'>): boolean =>
  getHero(unit.heroId).row === 'front';

/**
 * A new horde marches in from the back: each melee-minded hero placed in
 * the front row drops back while the back row has room, in uid order
 * (imperative: each move changes the room left for the next).
 */
const marchInFromBack = (heroes: HeroUnit[]): HeroUnit[] => {
  let field = heroes;
  for (const unit of heroes) {
    const current = field.find((hero) => hero.uid === unit.uid);
    if (current && isMeleeMinded(current) && canPush(field, current))
      field = pushHero(field, current.uid);
  }
  return field;
};

/**
 * Lines a horde up on the battlefield. Everyone first takes their home
 * row (big heroes placed first so they always find room), then the
 * melee heroes drop back as far as the back row has room, so a new wave
 * starts out of melee reach. The result keeps the original order (uids).
 */
export const formUp = (units: readonly UnplacedHero[]): HeroUnit[] => {
  const bySizeDesc = [...units].sort((a, b) => cellCountOf(b) - cellCountOf(a));
  const placed = bySizeDesc.reduce<HeroUnit[]>(
    (field, unit) => [...field, placeHero(field, unit)],
    []
  );
  const ordered = units.map(
    (unit) =>
      placed.find((hero) => hero.uid === unit.uid) ?? placeHero([], unit)
  );
  return marchInFromBack(ordered);
};

/**
 * When the front row is empty, every back-row hero steps forward. Used
 * when the villain Charges.
 */
export const stepForward = (heroes: HeroUnit[]): HeroUnit[] => {
  const hasFront = heroes.some((unit) => unit.row === 'front');
  return hasFront ? heroes : heroes.map((unit) => ({ ...unit, row: 'front' }));
};

// --- SUMMONS ---

/**
 * Where `count` summoned heroes of `size` would stand: open columns in
 * the rows the summoner stands in (its own row first), nearest to it
 * first (left wins a tie). Fewer than `count` when those rows run out
 * of room; empty when they are full.
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
  for (const row of rowsOf(summoner)) {
    for (const col of byNearness) {
      if (seats.length === count) return seats;
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
  Array.from({ length: BATTLEFIELD_COLUMNS - size + 1 }, (_, col) => col);

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
 * How the hero would be seated if it moved to the other row: it keeps
 * its own columns when it can, and that row's heroes slide sideways to
 * make room, never passing each other. Picks the seating that moves
 * everyone the least (moving the hero itself costs most, so it shifts
 * only when it must). Returns
 * null when the other row has no room at all.
 * Brute force on purpose: a row is 3 columns and at most 3 heroes, so
 * there are only a few dozen seatings to try.
 */
const seatInOtherRow = (
  heroes: readonly HeroUnit[],
  unit: HeroUnit
): Seating | null => {
  if (isDeep(unit)) return null;
  const row = otherRow(unit.row);
  const rowHeroes = heroes
    .filter((other) => other.row === row && !isImmovable(other))
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

/** True when a pull would work on this hero right now. */
export const canPull = (heroes: readonly HeroUnit[], unit: HeroUnit) =>
  unit.row === 'back' &&
  !isImmovable(unit) &&
  seatInOtherRow(heroes, unit) !== null;

/** True when a push would work on this hero right now. */
export const canPush = (heroes: readonly HeroUnit[], unit: HeroUnit) =>
  unit.row === 'front' &&
  !isImmovable(unit) &&
  seatInOtherRow(heroes, unit) !== null;

/** Moves one hero to `row`, sliding that row over to make room. */
const moveTo = (heroes: HeroUnit[], uid: number, row: HeroRow) => {
  const unit = heroes.find((hero) => hero.uid === uid);
  if (!unit || unit.row === row || isImmovable(unit)) return heroes;
  const seating = seatInOtherRow(heroes, unit);
  if (!seating) return heroes;
  // No stepForward here: pushing the last front hero back leaves the
  // front empty until the villain Charges.
  return heroes.map((hero) => {
    const col = seating.get(hero.uid);
    if (col === undefined) return hero;
    return hero.uid === uid ? { ...hero, row, col } : { ...hero, col };
  });
};

/** Pull: the hero steps into the front row (no-op if blocked). */
export const pullHero = (heroes: HeroUnit[], uid: number) =>
  moveTo(heroes, uid, 'front');

/** Push: the hero falls back into the back row (no-op if blocked). */
export const pushHero = (heroes: HeroUnit[], uid: number) =>
  moveTo(heroes, uid, 'back');

/**
 * End of the heroes' turn: each melee-minded hero in the back row steps
 * up if the front row has room, in uid order (imperative: each step
 * changes the room left for the next).
 */
export const advanceMelee = (heroes: HeroUnit[]): HeroUnit[] => {
  let field = heroes;
  for (const unit of heroes) {
    const current = field.find((hero) => hero.uid === unit.uid);
    if (current && isMeleeMinded(current) && canPull(field, current))
      field = pullHero(field, current.uid);
  }
  return field;
};

/** Back Step: the whole field (all in the front row) falls back a row. */
export const fallBack = (heroes: readonly HeroUnit[]): HeroUnit[] =>
  heroes.map((unit) => (isDeep(unit) ? unit : { ...unit, row: 'back' }));

// --- TARGETING ---

/** True for effects that are aimed at one chosen hero. */
const isSingleTarget = (effect: CardDef['effects'][number]): boolean =>
  effect.kind === 'reap' ||
  effect.kind === 'pull' ||
  effect.kind === 'push' ||
  ((effect.kind === 'damage' ||
    effect.kind === 'hex' ||
    effect.kind === 'poison' ||
    effect.kind === 'burn' ||
    effect.kind === 'frost' ||
    effect.kind === 'bleed' ||
    effect.kind === 'dread') &&
    effect.target === 'one');

/** Works out which heroes a card may be aimed at (see TargetRule). */
export const targetRuleOf = (cardId: CardId): TargetRule => {
  const { effects, reach } = getCard(cardId);
  const kinds = effects.map((effect) => effect.kind);
  if (kinds.includes('pull')) return 'pullable';
  if (kinds.includes('push')) return 'pushable';
  if (!effects.some(isSingleTarget)) return 'none';
  const isMelee = effects.some(
    (effect) => effect.kind === 'damage' && effect.target === 'one'
  );
  return isMelee && !reach ? 'front' : 'any';
};

// --- WHO A CARD AFFECTS ---
/**
 * Effect kinds that land on the villain (the player) or its cards, not
 * a hero. Imbue acts on a card in hand.
 */
const SELF_EFFECT_KINDS: ReadonlySet<CardDef['effects'][number]['kind']> =
  new Set([
    'guard',
    'wrath',
    'buff',
    'draw',
    'energy',
    'heal',
    'cleanse',
    'protect',
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
 * The heroes that fit a target rule, in battlefield order. A hero
 * Aloft is out of reach of every rule.
 */
export const legalTargets = (
  heroes: readonly HeroUnit[],
  rule: TargetRule
): HeroUnit[] => {
  const reachable = heroes.filter((unit) => !isAloft(unit));
  switch (rule) {
    case 'none':
    case 'any':
      return reachable;
    case 'front':
      return reachable.filter((unit) => unit.row === 'front');
    case 'pullable':
      return reachable.filter(
        (unit) =>
          (isImmovable(unit) && unit.row === 'back') || canPull(heroes, unit)
      );
    case 'pushable':
      return reachable.filter(
        (unit) =>
          (isImmovable(unit) && unit.row === 'front') || canPush(heroes, unit)
      );
  }
};

/**
 * Heroes an area attack hits: melee sweeps the front row, Reach all.
 * A hero Aloft is above it all.
 */
export const areaTargets = (
  heroes: readonly HeroUnit[],
  isMelee: boolean
): HeroUnit[] =>
  heroes.filter((unit) => !isAloft(unit) && (!isMelee || unit.row === 'front'));

/**
 * Every hero an area card would hit: hex and dread to ALL reach every
 * hero, damage to ALL reaches the front row only unless the card has
 * Reach (mirrors resolveTargets in combat.ts).
 */
export const cardAreaTargets = (
  heroes: readonly HeroUnit[],
  cardId: CardId
): HeroUnit[] => {
  const { effects, reach } = getCard(cardId);
  const areaEffects = effects.filter(
    (effect) => 'target' in effect && effect.target === 'all'
  );
  const hitsEveryone = areaEffects.some(
    (effect) => effect.kind !== 'damage' || reach
  );
  if (areaEffects.length === 0) return [];
  return areaTargets(heroes, !hitsEveryone);
};
