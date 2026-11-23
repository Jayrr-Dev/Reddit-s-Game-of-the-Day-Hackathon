// ===================================================================
// BATTLEFIELD
// Where heroes stand. The field is a grid BATTLEFIELD_COLUMNS wide and
// two rows deep; each hero fills `size` neighbouring columns in one row.
//
// RULES
//   - Melee cards hit the front row only. Reach cards, curses and Hex
//     hit any hero.
//   - A pull drags a back-row hero forward, but only when the front
//     columns in front of it are empty. A push is the mirror image.
//   - When the front row empties, the back row steps forward, so a
//     fight can never stall behind a healer nobody can reach.
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
 * - pullable: a back-row hero with open space in front of it
 * - pushable: a front-row hero with open space behind it
 */
export type TargetRule = 'none' | 'front' | 'any' | 'pullable' | 'pushable';

// --- GEOMETRY ---

/** Columns a hero fills, e.g. col 1 size 2 -> [1, 2]. */
const spanOf = (col: number, size: number): number[] =>
  Array.from({ length: size }, (_, offset) => col + offset);

/** How many columns a hero fills. */
export const sizeOf = (unit: Pick<HeroUnit, 'heroId'>): HeroSize =>
  getHero(unit.heroId).size;

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
      unit.row !== row ||
      !spanOf(unit.col, sizeOf(unit)).some((col) => span.includes(col))
  );

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

/** The first column where a hero of `size` fits in `row`, or null. */
const firstOpenColumn = (
  heroes: readonly HeroUnit[],
  row: HeroRow,
  size: HeroSize
): number | null =>
  PREFERRED_COLUMNS[row][size].find(
    (col) =>
      col + size <= BATTLEFIELD_COLUMNS &&
      isSpanOpen(heroes, row, spanOf(col, size))
  ) ?? null;

// --- FORMATION ---

/** Places one hero: its own row first, then the other row. */
const placeHero = (
  placed: readonly HeroUnit[],
  unit: UnplacedHero
): HeroUnit => {
  const { row, size } = getHero(unit.heroId);
  for (const candidate of [row, otherRow(row)]) {
    const col = firstOpenColumn(placed, candidate, size);
    if (col !== null) return { ...unit, row: candidate, col };
  }
  // Hordes are sized to fit, so this only guards against a bad catalog.
  return { ...unit, row, col: 0 };
};

/**
 * Lines a horde up on the battlefield. Big heroes are placed first so
 * they always find room; the result keeps the original order (uids).
 */
export const formUp = (units: readonly UnplacedHero[]): HeroUnit[] => {
  const bySizeDesc = [...units].sort((a, b) => sizeOf(b) - sizeOf(a));
  const placed = bySizeDesc.reduce<HeroUnit[]>(
    (field, unit) => [...field, placeHero(field, unit)],
    []
  );
  const ordered = units.map(
    (unit) =>
      placed.find((hero) => hero.uid === unit.uid) ?? placeHero([], unit)
  );
  return stepForward(ordered);
};

/** When the front row is empty, every back-row hero steps forward. */
export const stepForward = (heroes: HeroUnit[]): HeroUnit[] => {
  const hasFront = heroes.some((unit) => unit.row === 'front');
  return hasFront ? heroes : heroes.map((unit) => ({ ...unit, row: 'front' }));
};

// --- MOVEMENT ---

/** True when the hero could move to the other row in its own columns. */
const canSwitchRow = (heroes: readonly HeroUnit[], unit: HeroUnit): boolean =>
  isSpanOpen(
    heroes,
    otherRow(unit.row),
    spanOf(unit.col, sizeOf(unit)),
    unit.uid
  );

/** True when a pull would work on this hero right now. */
export const canPull = (heroes: readonly HeroUnit[], unit: HeroUnit) =>
  unit.row === 'back' && canSwitchRow(heroes, unit);

/** True when a push would work on this hero right now. */
export const canPush = (heroes: readonly HeroUnit[], unit: HeroUnit) =>
  unit.row === 'front' && canSwitchRow(heroes, unit);

/** Moves one hero to `row` if its columns there are open. */
const moveTo = (heroes: HeroUnit[], uid: number, row: HeroRow) =>
  stepForward(
    heroes.map((unit) =>
      unit.uid === uid && unit.row !== row && canSwitchRow(heroes, unit)
        ? { ...unit, row }
        : unit
    )
  );

/** Pull: the hero steps into the front row (no-op if blocked). */
export const pullHero = (heroes: HeroUnit[], uid: number) =>
  moveTo(heroes, uid, 'front');

/** Push: the hero falls back into the back row (no-op if blocked). */
export const pushHero = (heroes: HeroUnit[], uid: number) =>
  moveTo(heroes, uid, 'back');

// --- TARGETING ---

/** True for effects that are aimed at one chosen hero. */
const isSingleTarget = (effect: CardDef['effects'][number]): boolean =>
  effect.kind === 'reap' ||
  effect.kind === 'pull' ||
  effect.kind === 'push' ||
  ((effect.kind === 'damage' ||
    effect.kind === 'hex' ||
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
/** Effect kinds that land on the villain (the player), not a hero. */
const SELF_EFFECT_KINDS: ReadonlySet<CardDef['effects'][number]['kind']> =
  new Set(['shroud', 'wrath', 'draw', 'energy', 'heal']);

/** True when a card does something to the villain (shroud, draw ...). */
export const affectsSelf = (cardId: CardId): boolean =>
  getCard(cardId).effects.some((effect) => SELF_EFFECT_KINDS.has(effect.kind));

/** True when a card does something to one or more heroes. */
export const affectsHeroes = (cardId: CardId): boolean =>
  getCard(cardId).effects.some((effect) => !SELF_EFFECT_KINDS.has(effect.kind));

/** The heroes that fit a target rule, in battlefield order. */
export const legalTargets = (
  heroes: readonly HeroUnit[],
  rule: TargetRule
): HeroUnit[] => {
  switch (rule) {
    case 'none':
    case 'any':
      return [...heroes];
    case 'front':
      return heroes.filter((unit) => unit.row === 'front');
    case 'pullable':
      return heroes.filter((unit) => canPull(heroes, unit));
    case 'pushable':
      return heroes.filter((unit) => canPush(heroes, unit));
  }
};

/** Heroes an area attack hits: melee sweeps the front row, Reach all. */
export const areaTargets = (
  heroes: readonly HeroUnit[],
  isMelee: boolean
): HeroUnit[] =>
  isMelee ? heroes.filter((unit) => unit.row === 'front') : [...heroes];

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
