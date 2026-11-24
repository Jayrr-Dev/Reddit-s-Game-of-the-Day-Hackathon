// ===================================================================
// HERO FACE
// Eyebrows, eyes and a mouth for a bare-faced hero, in the same flat,
// hard-edged polygons as the rest of the figure. Each hero has its own
// features (an eye cut, a brow and a resting mouth, see HERO_LOOKS) so
// it reads as a personality at a glance; its mood (attacking, aimed at,
// hurt, low on HP) then bends the brows and swaps the mouth and eyes.
//
// Every shape is written once for the LEFT side in "face units" (about
// a tenth of the head radius), with +x pointing in toward the nose and
// +y down; the right side is the same shape mirrored. So one table
// entry draws both eyes, and every face scales with its head.
// ===================================================================

import type {
  BrowStyle,
  EyeCut,
  FaceFeatures,
  HeroMood,
  MouthStyle,
} from '../../../content/heroLooks';

// --- TYPES ---
type Point = readonly [number, number];
type Side = 'left' | 'right';

/** Where the face sits on the head, in viewBox units. */
export type FacePlacement = {
  /** The head's centre line, and the eye line. */
  mid: number;
  eyes: number;
  /** Head radius and half width (features scale with them). */
  r: number;
  hw: number;
};

/** What the mood does to the mouth: the hero's own, or a mood shape. */
type MoodMouth = MouthStyle | 'grit' | 'gasp';

// --- CONSTANTS: COLOURS ---
const FEATURE_FILL = '#1a1014';
const TEETH_FILL = '#efe6da';
const GLINT_FILL = '#fff8ee';
/** Mouths are drawn this much bigger than the eyes' scale to read. */
const MOUTH_SCALE = 1.3;
/** The mouth sits a touch softer than the eyes, so eyes lead. */
const MOUTH_OPACITY = 0.8;

// --- CONSTANTS: PLACEMENT (face units, or shares of the head) ---
/** Eye centres sit this share of the head's half width off centre. */
const EYE_SPREAD = 0.46;
/** How far below the eye line the mouth sits, as a share of r. */
const MOUTH_DROP = 0.68;
/** Brow line height above the eye centre, and its ends. */
const BROW_Y = -3;
const BROW_OUTER_X = -1.9;
const BROW_INNER_X = 1.5;

// --- CONSTANTS: SHAPES (left side, +x toward the nose) ---
/** The eye cuts. Each reads as a different temperament. */
const EYE_SHAPES: Record<EyeCut, readonly Point[]> = {
  round: [
    [-0.8, -1.5],
    [0.8, -1.5],
    [0.8, 1.5],
    [-0.8, 1.5],
  ],
  narrow: [
    [-1.4, -0.3],
    [1.2, -0.5],
    [1.2, 0.6],
    [-1.4, 0.6],
  ],
  // Outer corner flicks up: a cat eye.
  sharp: [
    [-1.6, -1.3],
    [1.2, -0.4],
    [1.2, 1],
    [-0.8, 1],
  ],
  // Lid slopes down to the outer corner: gentle, a little sad.
  droopy: [
    [-1.4, 0.1],
    [1.1, -1.2],
    [1.1, 1.1],
    [-1.2, 1.1],
  ],
  wide: [
    [-1, -1.8],
    [1, -1.8],
    [1, 1.6],
    [-1, 1.6],
  ],
  // A heavy, flat lid over a rounded lower edge: calm, knowing.
  hooded: [
    [-1.3, -0.1],
    [1.3, -0.1],
    [1, 1.3],
    [-1, 1.3],
  ],
};

/** The little light catch in a wide eye. */
const GLINT: readonly Point[] = [
  [0.05, -1.4],
  [0.6, -1.4],
  [0.6, -0.8],
  [0.05, -0.8],
];

/** A squeezed-shut eye: a ">" pointing at the nose (">_<"). */
const WINCE_EYE: readonly Point[] = [
  [-1.4, -1.3],
  [1.3, 0],
  [-1.4, 1.3],
  [-1.4, 0.65],
  [0.2, 0],
  [-1.4, -0.65],
];

/** Brow thickness per style. */
const BROW_THICKNESS: Record<BrowStyle, number> = {
  thin: 0.55,
  flat: 0.85,
  heavy: 1.4,
  arched: 0.75,
  stern: 0.95,
};
/** A stern brow rests angled in, as if always a little cross. */
const BROW_REST_TILT: Record<BrowStyle, number> = {
  thin: 0,
  flat: 0,
  heavy: 0.2,
  arched: 0,
  stern: 0.8,
};
/** How high an arched brow peaks above its ends. */
const ARCH_RISE = 0.8;

/**
 * What each mood does to the brows: `tilt` drops the inner end (a
 * positive tilt reads angry or pained, a negative one worried), and
 * `lift` raises the whole brow.
 */
const MOOD_BROW: Record<HeroMood, { tilt: number; lift: number }> = {
  calm: { tilt: 0, lift: 0 },
  fierce: { tilt: 1.5, lift: 0.3 },
  wince: { tilt: 1.1, lift: 0.4 },
  alarmed: { tilt: -1.3, lift: -0.7 },
  worried: { tilt: -1.1, lift: -0.2 },
};

/** The mouth each mood shows; calm keeps the hero's own. */
const MOOD_MOUTH: Record<Exclude<HeroMood, 'calm'>, MoodMouth> = {
  fierce: 'grit',
  wince: 'grit',
  alarmed: 'gasp',
  worried: 'frown',
};

/** Mouth outlines, centred on the mouth point (face units). */
const MOUTH_SHAPES: Record<Exclude<MoodMouth, 'grit'>, readonly Point[]> = {
  line: [
    [-1.6, -0.3],
    [1.6, -0.3],
    [1.6, 0.3],
    [-1.6, 0.3],
  ],
  smile: [
    [-2, -0.6],
    [0, 0.4],
    [2, -0.6],
    [2, 0],
    [0, 1.1],
    [-2, 0],
  ],
  // One corner pulled up.
  smirk: [
    [-1.6, 0],
    [1, 0],
    [2, -0.9],
    [2, -0.3],
    [1.2, 0.6],
    [-1.6, 0.6],
  ],
  frown: [
    [-1.9, 0.6],
    [0, -0.3],
    [1.9, 0.6],
    [1.9, 1.2],
    [0, 0.35],
    [-1.9, 1.2],
  ],
  small: [
    [-0.9, -0.25],
    [0.9, -0.25],
    [0.9, 0.35],
    [-0.9, 0.35],
  ],
  // A small open "o".
  gasp: [
    [-0.6, -0.9],
    [0.6, -0.9],
    [0.9, 0],
    [0.6, 0.9],
    [-0.6, 0.9],
    [-0.9, 0],
  ],
};

/** Gritted teeth: a dark open mouth with a band of teeth across it. */
const GRIT_MOUTH: readonly Point[] = [
  [-1.9, -0.8],
  [1.9, -0.8],
  [1.6, 0.9],
  [-1.6, 0.9],
];
const GRIT_TEETH: readonly Point[] = [
  [-1.55, -0.55],
  [1.55, -0.55],
  [1.45, 0.15],
  [-1.45, 0.15],
];

// --- HELPERS ---
/** Points as an SVG points string. */
const pts = (points: readonly Point[]): string =>
  points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/**
 * Places a left-side shape (face units) at a centre point, mirrored for
 * the right side so "inward" always points at the nose.
 */
const placed = (
  shape: readonly Point[],
  [cx, cy]: Point,
  unit: number,
  side: Side = 'left'
): Point[] => {
  const flip = side === 'left' ? 1 : -1;
  return shape.map(([x, y]) => [cx + x * flip * unit, cy + y * unit] as const);
};

/**
 * One brow's outline: a band from the outer end to the inner end, the
 * inner end dropped by the tilt, with a peak in the middle if arched.
 * The inner end tapers a little so the brow reads as a stroke.
 */
const browShape = (style: BrowStyle, mood: HeroMood): Point[] => {
  const { tilt, lift } = MOOD_BROW[mood];
  const y = BROW_Y + lift;
  const innerY = y + BROW_REST_TILT[style] + tilt;
  const thick = BROW_THICKNESS[style];
  const midX = (BROW_OUTER_X + BROW_INNER_X) / 2;
  const peakY = (y + innerY) / 2 - (style === 'arched' ? ARCH_RISE : 0);
  return [
    [BROW_OUTER_X, y],
    [midX, peakY],
    [BROW_INNER_X, innerY],
    [BROW_INNER_X, innerY + thick * 0.8],
    [midX, peakY + thick],
    [BROW_OUTER_X, y + thick],
  ];
};

// --- SUBCOMPONENTS ---
/** One eye, its brow and (for wide eyes) its glint, on one side. */
const EyeAndBrow = ({
  side,
  centre,
  unit,
  features,
  mood,
}: {
  side: Side;
  centre: Point;
  unit: number;
  features: FaceFeatures;
  mood: HeroMood;
}) => {
  const isShut = mood === 'wince';
  const eye = isShut ? WINCE_EYE : EYE_SHAPES[features.eyes];
  const hasGlint = !isShut && features.eyes === 'wide';
  return (
    <>
      <polygon
        points={pts(placed(browShape(features.brow, mood), centre, unit, side))}
        fill={FEATURE_FILL}
      />
      <polygon
        points={pts(placed(eye, centre, unit, side))}
        fill={FEATURE_FILL}
      />
      {hasGlint && (
        <polygon
          points={pts(placed(GLINT, centre, unit, side))}
          fill={GLINT_FILL}
        />
      )}
    </>
  );
};

/** The mouth for this mood, centred on its point. */
const Mouth = ({
  centre,
  unit,
  shape,
}: {
  centre: Point;
  unit: number;
  shape: MoodMouth;
}) => {
  if (shape === 'grit') {
    return (
      <>
        <polygon
          points={pts(placed(GRIT_MOUTH, centre, unit))}
          fill={FEATURE_FILL}
          opacity={MOUTH_OPACITY}
        />
        <polygon
          points={pts(placed(GRIT_TEETH, centre, unit))}
          fill={TEETH_FILL}
        />
      </>
    );
  }
  return (
    <polygon
      points={pts(placed(MOUTH_SHAPES[shape], centre, unit))}
      fill={FEATURE_FILL}
      opacity={MOUTH_OPACITY}
    />
  );
};

// --- COMPONENT ---
/** Draws the brows, eyes and mouth of a bare face. */
export const HeroFace = ({
  at,
  features,
  mood,
}: {
  at: FacePlacement;
  features: FaceFeatures;
  mood: HeroMood;
}) => {
  const unit = at.r / 10;
  const eyeOffset = at.hw * EYE_SPREAD;
  const mouth = mood === 'calm' ? features.mouth : MOOD_MOUTH[mood];
  return (
    <g className="hero-face">
      <EyeAndBrow
        side="left"
        centre={[at.mid - eyeOffset, at.eyes]}
        unit={unit}
        features={features}
        mood={mood}
      />
      <EyeAndBrow
        side="right"
        centre={[at.mid + eyeOffset, at.eyes]}
        unit={unit}
        features={features}
        mood={mood}
      />
      <Mouth
        centre={[at.mid, at.eyes + at.r * MOUTH_DROP]}
        unit={unit * MOUTH_SCALE}
        shape={mouth}
      />
    </g>
  );
};
