// ===================================================================
// TEMPEST WYRM FIGURE
// Tempest Wyrm Vael: a towering, slate-dark giant with a horned dragon
// head, rising out of storm cloud on huge tawny feathered wings, one
// claw hanging low and the other raising a crackling lightning spear.
// Flat and faceted like the other creatures (each part a lit tone with
// its shadow tone on the right, no outlines). Drawn larger than the
// viewBox on purpose (overflow is visible): the wings and spear spill
// past the field slot so it looms over everything.
// It moves through the shared data-action hooks (index.css, reusing the
// "GRAND GRIFFON" wing beats): every move beats the wings once.
// ===================================================================

import { useId } from 'react';
import type { HeroMood } from '../../../content/heroLooks';
import { BODY_HEIGHT } from '../../../lib/heroFigure';

// --- TYPES ---
type Pt = readonly [number, number];
type Tone = { lit: string; shade: string };

// --- CONSTANTS: PALETTE ---
const HIDE: Tone = { lit: '#474b5a', shade: '#31343f' };
const LIMB: Tone = { lit: '#3d4150', shade: '#2a2d37' };
const HORN: Tone = { lit: '#8d8a84', shade: '#64615c' };
const FEATHER_OUTER: Tone = { lit: '#c08441', shade: '#9a6430' };
const FEATHER_INNER: Tone = { lit: '#7d5129', shade: '#5f3c1f' };
const CLOUD: Tone = { lit: '#7b7e88', shade: '#5c5f6a' };
const BOLT = '#eef6ff';
const BOLT_GLOW = '#f2e27a';
const EYE = '#f4e36a';

/** Drawing space (1500 x 1000, feet on the bottom) to viewBox units. */
const SCALE = BODY_HEIGHT / 1000;
/** The centre line the body is drawn on. */
const MID = 750;

// --- CONSTANTS: SHAPES (LEFT SIDE, MIRRORED FOR THE RIGHT) ---
/** Where a wing meets the shoulders: the pivot it beats around. */
const WING_ROOT: Pt = [640, 360];
/** The wing's arm: shoulder, up to the wrist, out to the tip. */
const WING_ARM: readonly Pt[] = [WING_ROOT, [430, 120], [250, 40], [40, 230]];
/**
 * Feathers hanging off the arm: [share along the arm 0..1, angle deg
 * (90 = straight down), length]. Long primaries out at the tip, short
 * coverts near the shoulder, so the wing reads as one great sail.
 */
const FEATHERS: readonly (readonly [number, number, number])[] = [
  [0.12, 98, 330],
  [0.24, 102, 430],
  [0.36, 106, 520],
  [0.48, 110, 600],
  [0.58, 116, 660],
  [0.68, 122, 690],
  [0.78, 130, 660],
  [0.88, 140, 600],
  [0.97, 152, 520],
];
const TORSO: readonly Pt[] = [
  [632, 330],
  [868, 330],
  [842, 640],
  [790, 830],
  [710, 830],
  [658, 640],
];
const HEAD: readonly Pt[] = [
  [706, 118],
  [794, 118],
  [812, 206],
  [772, 304],
  [728, 304],
  [688, 206],
];
const HORN_LEFT: readonly Pt[] = [
  [704, 136],
  [640, 30],
  [690, 60],
  [724, 122],
];
const CREST: readonly Pt[] = [
  [730, 120],
  [750, 50],
  [770, 120],
];
const ARM_LOW: readonly Pt[] = [
  [636, 350],
  [598, 366],
  [520, 626],
  [476, 772],
  [528, 780],
  [566, 640],
  [652, 430],
];
const CLAWS: readonly Pt[] = [
  [470, 770],
  [452, 830],
  [488, 790],
  [500, 842],
  [514, 792],
  [540, 836],
  [532, 778],
];
const ARM_RAISED: readonly Pt[] = [
  [860, 342],
  [906, 352],
  [966, 184],
  [996, 46],
  [960, 36],
  [926, 172],
];
/** The spear: a jagged bolt of light from the sky through the claw. */
const SPEAR: readonly Pt[] = [
  [1030, -170],
  [1046, -164],
  [1000, 40],
  [1020, 46],
  [940, 400],
  [960, 404],
  [898, 660],
  [924, 396],
  [902, 392],
  [984, 40],
  [962, 34],
];
/** Loose arcs of lightning crackling off the spear. */
const SPARKS: readonly (readonly Pt[])[] = [
  [
    [1010, 60],
    [1070, 110],
    [1050, 140],
    [1110, 190],
  ],
  [
    [950, 300],
    [890, 340],
    [910, 370],
    [850, 420],
  ],
  [
    [1036, -120],
    [1100, -90],
    [1080, -60],
    [1140, -40],
  ],
];
/** Storm cloud rolling over the legs: [x, y, radius]. */
const CLOUDS: readonly (readonly [number, number, number])[] = [
  [560, 900, 150],
  [760, 880, 170],
  [950, 905, 150],
  [420, 950, 110],
  [1090, 950, 110],
  [660, 980, 140],
  [860, 985, 140],
];

// --- HELPERS ---
const toPoints = (points: readonly Pt[]): string =>
  points.map(([x, y]) => `${x},${y}`).join(' ');

const mirror = (points: readonly Pt[]): Pt[] =>
  points.map(([x, y]) => [2 * MID - x, y] as const);

/** A point `length` from `from`, at `deg`. */
const toward = ([x, y]: Pt, deg: number, length: number): Pt => {
  const rad = (deg * Math.PI) / 180;
  return [x + length * Math.cos(rad), y + length * Math.sin(rad)];
};

/** The point `share` (0..1) of the way along a polyline, by length. */
const along = (line: readonly Pt[], share: number): Pt => {
  const lengths = line
    .slice(1)
    .map(([x, y], i) => Math.hypot(x - line[i]![0], y - line[i]![1]));
  let left = share * lengths.reduce((a, b) => a + b, 0);
  for (const [i, length] of lengths.entries()) {
    if (left <= length) {
      const [ax, ay] = line[i]!;
      const [bx, by] = line[i + 1]!;
      return [
        ax + ((bx - ax) * left) / length,
        ay + ((by - ay) * left) / length,
      ];
    }
    left -= length;
  }
  return line[line.length - 1]!;
};

/** One feather: a long blade from the root, widest two thirds out. */
const featherShape = (root: Pt, deg: number, length: number): Pt[] => {
  const tip = toward(root, deg, length);
  const sideA = toward(toward(root, deg, length * 0.62), deg + 90, 60);
  const sideB = toward(toward(root, deg, length * 0.62), deg - 90, 60);
  return [
    toward(root, deg + 90, 14),
    sideA,
    tip,
    sideB,
    toward(root, deg - 90, 14),
  ];
};

// --- SUBCOMPONENTS ---
/** A part in its shadow tone, with the lit tone clipped left of `split`. */
const Facet = ({
  tone,
  points,
  split,
}: {
  tone: Tone;
  points: readonly Pt[];
  split: number;
}) => {
  const id = useId();
  return (
    <g>
      <clipPath id={id}>
        <rect x={-2000} y={-2000} width={split + 2000} height={4000} />
      </clipPath>
      <polygon points={toPoints(points)} fill={tone.shade} />
      <polygon
        points={toPoints(points)}
        fill={tone.lit}
        clipPath={`url(#${id})`}
      />
    </g>
  );
};

/** One wing: inner feathers under outer ones, hung from its arm. */
const Wing = ({ side }: { side: 'left' | 'right' }) => {
  const flip = (points: Pt[]) => (side === 'left' ? points : mirror(points));
  const root = side === 'left' ? WING_ROOT : mirror([WING_ROOT])[0]!;
  const lit = side === 'left';
  const arm = [
    ...WING_ARM,
    ...WING_ARM.slice(1)
      .reverse()
      .map(([x, y]) => [x + 10, y + 34] as const),
  ];
  return (
    <g
      className={`griffon-wing-${side}`}
      // The origin is in viewBox units (outside the drawing's scale).
      style={{ transformOrigin: `${root[0] * SCALE}px ${root[1] * SCALE}px` }}
    >
      {FEATHERS.map(([share, deg, length]) => (
        <polygon
          key={`inner-${share}`}
          points={toPoints(
            flip(featherShape(along(WING_ARM, share), deg - 12, length * 0.75))
          )}
          fill={lit ? FEATHER_INNER.lit : FEATHER_INNER.shade}
        />
      ))}
      {FEATHERS.map(([share, deg, length]) => (
        <polygon
          key={`outer-${share}`}
          points={toPoints(
            flip(featherShape(along(WING_ARM, share), deg, length))
          )}
          fill={lit ? FEATHER_OUTER.lit : FEATHER_OUTER.shade}
        />
      ))}
      <polygon
        points={toPoints(flip(arm))}
        fill={lit ? LIMB.lit : LIMB.shade}
      />
    </g>
  );
};

/** The dragon head: horns, crest, a long snout and two burning eyes. */
const Head = () => (
  <g>
    <Facet tone={HORN} points={HORN_LEFT} split={2000} />
    <Facet tone={HORN} points={mirror(HORN_LEFT)} split={0} />
    <Facet tone={HORN} points={CREST} split={MID} />
    <Facet tone={HIDE} points={HEAD} split={MID} />
    <polygon
      points={toPoints([
        [712, 196],
        [742, 206],
        [716, 214],
      ])}
      fill={EYE}
    />
    <polygon
      points={toPoints(
        mirror([
          [712, 196],
          [742, 206],
          [716, 214],
        ])
      )}
      fill={EYE}
    />
  </g>
);

/** The lightning spear and the sparks crackling off it. */
const Spear = () => (
  <g>
    <polygon
      points={toPoints(SPEAR)}
      fill={BOLT_GLOW}
      opacity={0.45}
      transform="translate(-6 0) scale(1.01 1)"
    />
    <polygon points={toPoints(SPEAR)} fill={BOLT} />
    {SPARKS.map((spark, i) => (
      <polyline
        key={i}
        points={toPoints(spark)}
        fill="none"
        stroke={BOLT}
        strokeWidth={7}
        strokeLinejoin="bevel"
      />
    ))}
  </g>
);

/** Storm cloud rolling over the giant's legs. */
const Cloudbank = () => (
  <g>
    {CLOUDS.map(([x, y, r]) => (
      <g key={`${x}-${y}`}>
        <circle cx={x} cy={y} r={r} fill={CLOUD.shade} />
        <circle
          cx={x - r * 0.18}
          cy={y - r * 0.14}
          r={r * 0.78}
          fill={CLOUD.lit}
        />
      </g>
    ))}
  </g>
);

// --- COMPONENT ---
/** Draws Tempest Wyrm Vael (it takes no moods yet). */
export const TempestWyrm = (_props: { mood: HeroMood }) => (
  <g transform={`scale(${SCALE})`}>
    <Wing side="left" />
    <Wing side="right" />
    <Facet tone={LIMB} points={ARM_LOW} split={600} />
    <Facet tone={LIMB} points={CLAWS} split={500} />
    <Facet tone={HIDE} points={TORSO} split={MID} />
    <Facet tone={LIMB} points={ARM_RAISED} split={930} />
    <Head />
    <Spear />
    <Cloudbank />
  </g>
);
