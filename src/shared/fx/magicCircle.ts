// ===================================================================
// MAGIC CIRCLE GENERATOR
// Builds a magic circle from parts (rings, tick marks, rune bands, a
// gear band, pointer triangles, a polygon and a star sigil) as plain SVG
// path data, so any renderer can draw it. The same seed and options
// always give the same circle; a new seed reshuffles the runes and the
// star. Coordinates use a viewBox of -50 -50 100 100 (centre at 0 0).
// Pure: no DOM, no randomness outside the seeded generator.
// ===================================================================

// --- TYPES ---
/** How much is packed in: a quick ward, a full circle, or a dense sigil. */
export type MagicCircleComplexity = 'small' | 'large' | 'complex';

export type MagicCircleOptions = {
  complexity: MagicCircleComplexity;
  /** Any whole number; different seeds give different runes and stars. */
  seed: number;
};

/** One drawable layer. Layers that spin turn about the centre. */
export type MagicCircleLayer = {
  /** What part of the circle this is (for debugging and styling hooks). */
  part: 'ring' | 'ticks' | 'runes' | 'gear' | 'pointers' | 'polygon' | 'star' | 'core';
  d: string;
  /** Stroke width in viewBox units (0 for filled shapes). */
  strokeWidth: number;
  isFilled: boolean;
  /** Dash pattern, if any (viewBox units). */
  dash?: string | undefined;
  opacity: number;
  /** Seconds per full turn; negative turns the other way, 0 stays still. */
  spinSeconds: number;
};

// --- CONSTANTS ---
/** Outer radius every part fits inside (viewBox units). */
export const MAGIC_CIRCLE_RADIUS = 48;
/** The rune alphabet's strokes join points on a 3 x 3 grid. */
const RUNE_GRID = [-1, 0, 1] as const;
const RUNE_ALPHABET_SIZE = 16;

// --- SEEDED RANDOM ---
/** A small deterministic generator (mulberry32) seeded per circle. */
const makeRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A whole number from min to max inclusive. */
const pickInt = (random: () => number, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

// --- GEOMETRY ---
type Point = readonly [number, number];

const round = (value: number) => Math.round(value * 100) / 100;
const polar = (radius: number, angle: number): Point => [
  round(radius * Math.cos(angle)),
  round(radius * Math.sin(angle)),
];
/** Angle of slot `index` of `count`, starting at the top. */
const slotAngle = (index: number, count: number) => (index / count) * Math.PI * 2 - Math.PI / 2;
const moveTo = ([x, y]: Point) => `M${x} ${y}`;
const lineTo = ([x, y]: Point) => `L${x} ${y}`;

/** A full circle as two arcs (SVG has no circle path command). */
const circlePath = (radius: number) =>
  `M${radius} 0A${radius} ${radius} 0 1 0 ${-radius} 0A${radius} ${radius} 0 1 0 ${radius} 0`;

/** Short radial marks between two radii, evenly round the ring. */
const ticksPath = (inner: number, outer: number, count: number) =>
  Array.from({ length: count }, (_, index) => {
    const angle = slotAngle(index, count);
    return moveTo(polar(inner, angle)) + lineTo(polar(outer, angle));
  }).join('');

/** A cog edge: the radius steps between inner and outer, `teeth` times. */
const gearPath = (inner: number, outer: number, teeth: number) => {
  const points = Array.from({ length: teeth * 4 }, (_, step) => {
    const angle = (step / (teeth * 4)) * Math.PI * 2;
    const radius = step % 4 < 2 ? outer : inner;
    return polar(radius, angle);
  });
  return points.map((point, index) => (index === 0 ? moveTo(point) : lineTo(point))).join('') + 'Z';
};

/** Small triangles pointing outward from a ring. */
const pointersPath = (radius: number, size: number, count: number) =>
  Array.from({ length: count }, (_, index) => {
    const angle = slotAngle(index, count);
    const spread = size / radius;
    return moveTo(polar(radius + size, angle)) + lineTo(polar(radius, angle - spread)) + lineTo(polar(radius, angle + spread)) + 'Z';
  }).join('');

/** A regular polygon on the given radius. */
const polygonPath = (radius: number, sides: number, turn = 0) =>
  Array.from({ length: sides }, (_, index) => {
    const point = polar(radius, slotAngle(index, sides) + turn);
    return index === 0 ? moveTo(point) : lineTo(point);
  }).join('') + 'Z';

/** A star polygon {points/step}: joins every `step`-th point (5/2 = pentagram). */
const starPath = (radius: number, points: number, step: number) => {
  const visited = new Set<number>();
  let path = '';
  for (let start = 0; start < points; start += 1) {
    if (visited.has(start)) continue;
    let index = start;
    path += moveTo(polar(radius, slotAngle(index, points)));
    do {
      visited.add(index);
      index = (index + step) % points;
      path += lineTo(polar(radius, slotAngle(index, points)));
    } while (index !== start);
  }
  return path;
};

/** A filled spiky star (the sun-like core in the middle). */
const burstPath = (outer: number, inner: number, points: number) =>
  Array.from({ length: points * 2 }, (_, index) => {
    const point = polar(index % 2 === 0 ? outer : inner, slotAngle(index, points * 2));
    return index === 0 ? moveTo(point) : lineTo(point);
  }).join('') + 'Z';

// --- RUNES ---
type Rune = readonly (readonly [Point, Point])[];

/** A seeded alphabet: each rune is 2-4 strokes between 3 x 3 grid points. */
const makeRuneAlphabet = (random: () => number): Rune[] =>
  Array.from({ length: RUNE_ALPHABET_SIZE }, () =>
    Array.from({ length: pickInt(random, 2, 4) }, () => {
      const point = (): Point => [RUNE_GRID[pickInt(random, 0, 2)] ?? 0, RUNE_GRID[pickInt(random, 0, 2)] ?? 0];
      const from = point();
      let to = point();
      if (to[0] === from[0] && to[1] === from[1]) to = [-from[0] || 1, from[1]];
      return [from, to] as const;
    }),
  );

/** Runes standing round a ring, each turned to face outward. */
const runeBandPath = (radius: number, size: number, count: number, alphabet: Rune[], random: () => number) =>
  Array.from({ length: count }, (_, index) => {
    const angle = slotAngle(index, count);
    const rune = alphabet[pickInt(random, 0, alphabet.length - 1)] ?? [];
    // Local x runs along the ring, local y points outward.
    const along: Point = [-Math.sin(angle), Math.cos(angle)];
    const out: Point = [Math.cos(angle), Math.sin(angle)];
    const place = ([x, y]: Point): Point => [
      round(radius * out[0] + (x * along[0] - y * out[0]) * size),
      round(radius * out[1] + (x * along[1] - y * out[1]) * size),
    ];
    return rune.map(([from, to]) => moveTo(place(from)) + lineTo(place(to))).join('');
  }).join('');

// --- LAYER HELPERS ---
const stroke = (part: MagicCircleLayer['part'], d: string, strokeWidth: number, extra: Partial<MagicCircleLayer> = {}): MagicCircleLayer => ({
  part, d, strokeWidth, isFilled: false, opacity: 1, spinSeconds: 0, ...extra,
});
const fill = (part: MagicCircleLayer['part'], d: string, extra: Partial<MagicCircleLayer> = {}): MagicCircleLayer => ({
  part, d, strokeWidth: 0, isFilled: true, opacity: 1, spinSeconds: 0, ...extra,
});

// --- BUILDERS (ONE PER COMPLEXITY) ---
/** A quick ward: double ring, ticks and a star. */
const buildSmall = (random: () => number): MagicCircleLayer[] => {
  const points = pickInt(random, 5, 7);
  return [
    stroke('ring', circlePath(46), 1.6),
    stroke('ring', circlePath(40), 0.8),
    stroke('ticks', ticksPath(40, 46, points * 2), 0.8, { spinSeconds: 40 }),
    stroke('star', starPath(39, points, 2), 1.2, { spinSeconds: -60 }),
    stroke('ring', circlePath(15), 0.8),
  ];
};

/** A full circle: rings, a rune band, pointers, a polygon and a star. */
const buildLarge = (random: () => number): MagicCircleLayer[] => {
  const alphabet = makeRuneAlphabet(random);
  const sides = pickInt(random, 5, 8);
  return [
    stroke('ring', circlePath(47), 1.4),
    stroke('ring', circlePath(44.5), 0.5, { dash: '6 2' }),
    stroke('runes', runeBandPath(39.5, 1.9, 28, alphabet, random), 0.6, { spinSeconds: 70 }),
    stroke('ring', circlePath(35), 1),
    fill('pointers', pointersPath(35, 2.6, sides * 2), { opacity: 0.9, spinSeconds: 70 }),
    stroke('polygon', polygonPath(34, sides), 0.8, { opacity: 0.85, spinSeconds: -90 }),
    stroke('star', starPath(34, sides, sides > 6 ? 3 : 2), 0.9, { spinSeconds: -90 }),
    stroke('ring', circlePath(14), 0.9),
    fill('core', burstPath(9, 4, sides), { opacity: 0.9 }),
  ];
};

/** A dense sigil: everything in Large plus a gear band, a second rune band and a dashed halo. */
const buildComplex = (random: () => number): MagicCircleLayer[] => {
  const alphabet = makeRuneAlphabet(random);
  const sides = pickInt(random, 6, 9);
  return [
    stroke('ring', circlePath(48), 0.6, { dash: '10 3 2 3', spinSeconds: -120 }),
    fill('pointers', pointersPath(45, 2.4, 8), { spinSeconds: -120 }),
    stroke('ring', circlePath(45), 1.3),
    stroke('runes', runeBandPath(41, 1.7, 36, alphabet, random), 0.55, { spinSeconds: 90 }),
    stroke('ring', circlePath(37.5), 0.8),
    stroke('gear', gearPath(31.5, 35.5, pickInt(random, 18, 26)), 0.9, { spinSeconds: -45 }),
    stroke('ring', circlePath(30), 0.5),
    stroke('runes', runeBandPath(26.5, 1.4, 22, alphabet, random), 0.5, { spinSeconds: 60 }),
    stroke('ring', circlePath(23), 0.9),
    stroke('star', starPath(22.5, sides, Math.floor((sides - 1) / 2)), 0.6, { opacity: 0.8, spinSeconds: -75 }),
    stroke('polygon', polygonPath(22.5, sides), 0.5, { opacity: 0.7, spinSeconds: -75 }),
    stroke('ticks', ticksPath(12, 14, sides * 4), 0.4),
    fill('core', burstPath(11, 4.5, sides * 2), { opacity: 0.95, spinSeconds: 30 }),
    stroke('ring', circlePath(3), 0.6),
  ];
};

const BUILDERS: Record<MagicCircleComplexity, (random: () => number) => MagicCircleLayer[]> = {
  small: buildSmall,
  large: buildLarge,
  complex: buildComplex,
};

// --- ENTRY POINT ---
/** Builds the circle's layers (outer first) for the given options. */
export const buildMagicCircle = ({ complexity, seed }: MagicCircleOptions): MagicCircleLayer[] =>
  BUILDERS[complexity](makeRandom(seed));
