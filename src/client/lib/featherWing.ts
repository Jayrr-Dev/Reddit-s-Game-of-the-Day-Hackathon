// ===================================================================
// FEATHER WING GEOMETRY
// Builds a feathered wing from a few numbers instead of hand-traced
// polygons: a "bone" (the wing's arm, a polyline) and rows of feathers
// hung along it. Each row fans its feathers by blending an angle and a
// length from one end of its stretch to the other, so a wing reads as
// layered bands (long flight feathers under shorter coverts).
// Pure geometry in art units (see creatureArt); the drawing decides
// the colours.
// ===================================================================

import { polar, type Point } from './creatureArt';

// --- TYPES ---
/** One band of feathers along the bone. */
export type FeatherRow = {
  count: number;
  /** The stretch of bone the row hangs from (shares of its length). */
  shares: readonly [number, number];
  /** Feather direction at each end (deg, 90 = straight down). */
  degrees: readonly [number, number];
  /** Feather lengths, spread evenly along the stretch and blended. */
  lengths: readonly number[];
  /** Widest point of a feather. */
  width: number;
};

/** A feather split down its spine, so each half takes its own tone. */
export type Feather = { leading: Point[]; trailing: Point[] };

// --- CONSTANTS ---
/** How far along its spine a feather is widest, and where it tapers. */
const BELLY_SHARE = 0.42;
const TAPER_SHARE = 0.8;
/** Width left at the taper, as a share of the widest point. */
const TAPER_WIDTH = 0.72;

// --- HELPERS ---
/** A value blended between evenly spaced stops, at `share` (0..1). */
export const blendStops = (stops: readonly number[], share: number): number => {
  const at = share * (stops.length - 1);
  const low = Math.min(Math.floor(at), stops.length - 2);
  return stops[low]! + (stops[low + 1]! - stops[low]!) * (at - low);
};

/** The point `share` (0..1) of the way along a polyline, by length. */
export const pointAlong = (line: readonly Point[], share: number): Point => {
  const spans = line
    .slice(1)
    .map(([x, y], i) => Math.hypot(x - line[i]![0], y - line[i]![1]));
  let left = share * spans.reduce((sum, span) => sum + span, 0);
  for (const [i, span] of spans.entries()) {
    if (left <= span) {
      const [ax, ay] = line[i]!;
      const [bx, by] = line[i + 1]!;
      return [ax + ((bx - ax) * left) / span, ay + ((by - ay) * left) / span];
    }
    left -= span;
  }
  return line[line.length - 1]!;
};

/** One feather: a blade from `root`, widest near its base, to a point. */
export const featherAt = (
  root: Point,
  deg: number,
  length: number,
  width: number
): Feather => {
  const tip = polar(root, length, deg);
  /** The edge point `share` along the spine, `half` out to one side. */
  const edge = (share: number, half: number, side: 1 | -1): Point =>
    polar(polar(root, length * share, deg), half, deg + 90 * side);
  const halfOf = (side: 1 | -1): Point[] => [
    root,
    edge(BELLY_SHARE, width / 2, side),
    edge(TAPER_SHARE, (width / 2) * TAPER_WIDTH, side),
    tip,
  ];
  return { leading: halfOf(1), trailing: halfOf(-1) };
};

/**
 * Every feather of a row, outermost first, so drawing them in order
 * lays each one over its outer neighbour (like roof tiles).
 */
export const featherRow = (
  bone: readonly Point[],
  row: FeatherRow
): Feather[] =>
  Array.from({ length: row.count }, (_, i) => {
    const share = 1 - i / (row.count - 1);
    const [from, to] = row.shares;
    const [degFrom, degTo] = row.degrees;
    return featherAt(
      pointAlong(bone, from + (to - from) * share),
      degFrom + (degTo - degFrom) * share,
      blendStops(row.lengths, share),
      row.width
    );
  });

/** A bone drawn as a strip that thins from `thick` to `thin`. */
export const boneStrip = (
  bone: readonly Point[],
  thick: number,
  thin: number
): Point[] => {
  const widthAt = (i: number): number =>
    thick + ((thin - thick) * i) / (bone.length - 1);
  const under = bone.map(([x, y], i): Point => [x, y + widthAt(i)]);
  return [...bone, ...under.reverse()];
};
