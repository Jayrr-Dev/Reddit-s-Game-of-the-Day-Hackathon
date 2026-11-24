// ===================================================================
// GRAND GRIFFON FIGURE
// Grand Griffon Rio, traced from the concept art (1536 x 1024, art
// units, see lib/creatureArt): a white eagle head and chest with a gold
// beak, purple wings, a tan lion body on gold talons, a tufted tail on
// the right and a gold halo. Flat two-tone like the other creatures.
// It moves through data-action hooks (index.css, "GRAND GRIFFON"):
//   every move   the wings beat once
//   melee        three claw streaks rake down in quick succession
//                (Triple Slice)
//   support      the halo flares
//   signature    Heavenly Dive: the halo blazes as it drops
//   aloft        (data-aloft on the field) the wings beat without rest
//   death        the halo shatters, feathers burst off it and the
//                wings crumple
// ===================================================================

import type { CSSProperties } from 'react';
import type { HeroMood } from '../../../content/heroLooks';
import {
  ART_SCALE,
  ART_WIDTH,
  mirrored,
  originAt,
  pts,
  type Point,
} from '../../../lib/creatureArt';
import {
  DeathBurst,
  HaloLight,
  HaloRing,
  HaloShards,
  type HaloSpec,
} from './HolyHalo';

// --- CONSTANTS: PALETTE ---
const PLUMAGE = { lit: '#f7efe6', shade: '#e6dccf' };
const BREAST = { lit: '#e8dccd', shade: '#d3c4b2' };
const WING = {
  outerLit: '#9a80a3',
  outerShade: '#7f6789',
  innerLit: '#6f5679',
  innerShade: '#5b4465',
};
const LION = { lit: '#e2ab62', shade: '#c38b47' };
const TALON = { lit: '#f4c84f', shade: '#d9a93a' };
const BEAK = { lit: '#f2c14e', shade: '#d8a23a' };
const TUFT = '#5d4466';
const FEATURE = '#2a1d1a';
const CLAW_LIGHT = '#fff6dc';
const CLAW_DARK = '#3a2a20';
const SCALE_LINE = '#c99a32';

// --- CONSTANTS: SHAPES (ART COORDINATES, LEFT SIDE) ---
const GRIFFON_HALO: HaloSpec = { centre: [766, 178], radius: 165, stroke: 10 };
/** Where the death's light bursts out (the chest). */
const CHEST: Point = [768, 470];
/** Where a wing meets the shoulders: the pivot it beats around. */
const WING_ROOT: Point = [640, 330];
/**
 * The whole wing, rooted behind the ruff (so it joins the body with no
 * gap) and sweeping out and down to serrated feather tips.
 */
const WING_OUTER: readonly Point[] = [
  [665, 300],
  [595, 288],
  [540, 300],
  [470, 400],
  [420, 520],
  [385, 640],
  [410, 625],
  [392, 790],
  [430, 750],
  [440, 862],
  [470, 790],
  [500, 840],
  [545, 700],
  [605, 640],
  [665, 610],
];
/**
 * The darker flight feathers along the wing's outer, lower edge (the
 * coverts above and beside the body stay light, as in the art).
 */
const WING_INNER: readonly Point[] = [
  [455, 470],
  [420, 560],
  [385, 640],
  [410, 625],
  [392, 790],
  [430, 750],
  [440, 862],
  [470, 790],
  [500, 840],
  [545, 700],
  [520, 600],
  [480, 520],
];
/** The lion's haunch and hind paw, crouched. */
const HAUNCH: readonly Point[] = [
  [650, 665],
  [540, 680],
  [478, 790],
  [470, 870],
  [640, 900],
];
const HIND_PAW: readonly Point[] = [
  [470, 868],
  [560, 868],
  [578, 935],
  [462, 935],
];
/** The lion belly between the legs, in the body's own tan (no dark gap). */
const BELLY: readonly Point[] = [
  [640, 760],
  [768, 760],
  [768, 900],
  [640, 900],
];
/** The cream breast under the white plumage. */
const BREAST_SHAPE: readonly Point[] = [
  [768, 495],
  [640, 470],
  [598, 625],
  [625, 785],
  [700, 790],
  [745, 705],
  [768, 690],
];
/** Head, ruff and chest in one jagged white shape, down to a point. */
const PLUMAGE_SHAPE: readonly Point[] = [
  [768, 150],
  [655, 118],
  [700, 190],
  [655, 245],
  [686, 262],
  [640, 325],
  [682, 330],
  [625, 415],
  [666, 410],
  [615, 520],
  [662, 500],
  [768, 690],
];
/** An eagle's foreleg: a scaled shank tapering down to the ankle. */
const FORELEG: readonly Point[] = [
  [690, 770],
  [740, 770],
  [732, 862],
  [716, 884],
  [700, 862],
];
/** Scale bands across the shank (thin dark lines). */
const SHANK_SCALES: readonly (readonly Point[])[] = [
  [
    [694, 800],
    [737, 800],
  ],
  [
    [696, 825],
    [735, 825],
  ],
  [
    [699, 850],
    [733, 850],
  ],
];
/** Three toes fanned forward from the ankle: outer, middle, inner. */
const TOES: readonly (readonly Point[])[] = [
  [
    [700, 868],
    [714, 876],
    [692, 934],
    [678, 928],
  ],
  [
    [707, 874],
    [724, 874],
    [726, 944],
    [708, 944],
  ],
  [
    [716, 870],
    [730, 866],
    [756, 926],
    [744, 934],
  ],
];
/** A dark hooked claw at the tip of each toe. */
const CLAWS: readonly (readonly Point[])[] = [
  [
    [677, 926],
    [694, 932],
    [680, 958],
  ],
  [
    [707, 942],
    [727, 942],
    [716, 972],
  ],
  [
    [742, 932],
    [758, 924],
    [754, 958],
  ],
];
const BEAK_SHAPE: readonly Point[] = [
  [768, 205],
  [735, 222],
  [727, 258],
  [748, 284],
  [768, 326],
];
const NOSTRIL: readonly Point[] = [
  [740, 258],
  [752, 262],
  [750, 272],
];
/** The tail curls up on the right only, ending in a purple tuft. */
const TAIL_PATH =
  'M1040 890 C1185 860 1235 650 1175 530 C1145 470 1150 430 1160 405';
const TAIL_WIDTH = 22;
const TUFT_SHAPE: readonly Point[] = [
  [1160, 412],
  [1108, 380],
  [1120, 318],
  [1140, 342],
  [1150, 292],
  [1176, 322],
  [1212, 274],
  [1206, 330],
  [1216, 346],
  [1192, 402],
];
/**
 * Triple Slice: three claw streaks raked down toward the villain, each
 * one a thin wedge; they flash in turn (index.css).
 */
const CLAW_STREAKS: readonly (readonly Point[])[] = [0, 70, 140].map(
  (offset) => [
    [560 + offset, 560],
    [580 + offset, 556],
    [770 + offset, 1000],
    [756 + offset, 1004],
  ]
);
/** Feathers that burst off it as it dies: [x, y, angle, fly x, fly y]. */
const DEATH_FEATHERS: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
])[] = [
  [560, 420, -30, -220, -160],
  [980, 430, 40, 230, -150],
  [520, 620, -60, -260, 40],
  [1010, 640, 70, 250, 60],
  [700, 300, -10, -90, -240],
  [840, 310, 20, 110, -230],
];
/** One feather (art units, pointing up from its quill at 0,0). */
const FEATHER: readonly Point[] = [
  [0, 0],
  [-14, -40],
  [-6, -90],
  [0, -110],
  [8, -88],
  [14, -38],
];

// --- CONSTANTS: FACE ---
/** The left eye's centre; eye shapes are offsets from it (+x inward). */
const EYE_CENTRE: Point = [717, 197];
/**
 * Each mood's eye: a small dark bar at rest, slanted down inward when
 * fierce, lifted inward when worried, squeezed into a ">" in a wince.
 */
const GRIFFON_EYE: Record<HeroMood, readonly Point[]> = {
  calm: [
    [-5, -12],
    [5, -12],
    [5, 12],
    [-5, 12],
  ],
  fierce: [
    [-6, -12],
    [7, -3],
    [6, 10],
    [-6, 10],
  ],
  worried: [
    [-6, -4],
    [6, -14],
    [6, 12],
    [-6, 12],
  ],
  wince: [
    [-8, -12],
    [9, 0],
    [-8, 12],
    [-8, 6],
    [2, 0],
    [-8, -6],
  ],
};

// --- HELPERS ---
/** Offsets moved to the left eye's centre. */
const atEye = (offsets: readonly Point[]): Point[] =>
  offsets.map(([dx, dy]) => [EYE_CENTRE[0] + dx, EYE_CENTRE[1] + dy] as const);

/** A feather placed at (x, y), tilted by `deg`, as SVG points. */
const featherAt = (x: number, y: number, deg: number): string => {
  const rad = (deg * Math.PI) / 180;
  return pts(
    FEATHER.map(([fx, fy]) => [
      x + fx * Math.cos(rad) - fy * Math.sin(rad),
      y + fx * Math.sin(rad) + fy * Math.cos(rad),
    ])
  );
};

// --- SUBCOMPONENTS ---
/** A left part and its mirrored twin, lit and shadowed. */
const Pair = ({
  left,
  lit,
  shade,
}: {
  left: readonly Point[];
  lit: string;
  shade: string;
}) => (
  <>
    <polygon points={pts(left)} fill={lit} />
    <polygon points={pts(mirrored(left))} fill={shade} />
  </>
);

/**
 * Both forelegs as an eagle's: a scaled gold shank, three toes fanned
 * forward, each ending in a dark hooked claw (left drawn, right mirrored).
 */
const Talons = () => (
  <>
    <Pair left={FORELEG} lit={TALON.lit} shade={TALON.shade} />
    {[...SHANK_SCALES, ...SHANK_SCALES.map(mirrored)].map((line, index) => (
      <polyline
        key={`band-${index}`}
        points={pts(line)}
        fill="none"
        stroke={SCALE_LINE}
        strokeWidth="2.5"
      />
    ))}
    {TOES.map((toe, index) => (
      <Pair
        key={`toe-${index}`}
        left={toe}
        lit={TALON.lit}
        shade={TALON.shade}
      />
    ))}
    {CLAWS.map((claw, index) => (
      <Pair
        key={`claw-${index}`}
        left={claw}
        lit={CLAW_DARK}
        shade={CLAW_DARK}
      />
    ))}
  </>
);

/** Both wings, each beating around its root. */
const Wings = () => (
  <>
    <g className="griffon-wing-left" style={originAt(WING_ROOT)}>
      <polygon points={pts(WING_OUTER)} fill={WING.outerLit} />
      <polygon points={pts(WING_INNER)} fill={WING.innerLit} />
    </g>
    <g
      className="griffon-wing-right"
      style={originAt([ART_WIDTH - WING_ROOT[0], WING_ROOT[1]])}
    >
      <polygon points={pts(mirrored(WING_OUTER))} fill={WING.outerShade} />
      <polygon points={pts(mirrored(WING_INNER))} fill={WING.innerShade} />
    </g>
  </>
);

/** The lion's tail and its tuft (right side only). */
const Tail = () => (
  <>
    <path
      d={TAIL_PATH}
      transform={`scale(${ART_SCALE})`}
      fill="none"
      stroke={LION.lit}
      strokeWidth={TAIL_WIDTH}
      strokeLinecap="round"
    />
    <polygon points={pts(TUFT_SHAPE)} fill={TUFT} />
  </>
);

/** The eagle face: beak, nostrils and mood eyes. */
const Face = ({ mood }: { mood: HeroMood }) => (
  <>
    <Pair left={atEye(GRIFFON_EYE[mood])} lit={FEATURE} shade={FEATURE} />
    <Pair left={BEAK_SHAPE} lit={BEAK.lit} shade={BEAK.shade} />
    <Pair left={NOSTRIL} lit={FEATURE} shade={FEATURE} />
  </>
);

/** Three claw streaks for Triple Slice (hidden until it rakes). */
const ClawStreaks = () => (
  <g>
    {CLAW_STREAKS.map((streak, index) => (
      <polygon
        key={streak[0]?.[0]}
        className="griffon-claw"
        points={pts(streak)}
        fill={CLAW_LIGHT}
        opacity="0"
        style={{ animationDelay: `${index * 150}ms` }}
      />
    ))}
  </g>
);

/** Feathers that burst off it as it dies (hidden until then). */
const DeathFeathers = () => (
  <g>
    {DEATH_FEATHERS.map(([x, y, deg, dx, dy], index) => (
      <polygon
        key={`${x}-${y}`}
        className="griffon-feather"
        points={featherAt(x, y, deg)}
        fill={index % 2 === 0 ? PLUMAGE.lit : WING.outerLit}
        opacity="0"
        style={
          {
            '--dx': `${(dx * ART_SCALE).toFixed(1)}px`,
            '--dy': `${(dy * ART_SCALE).toFixed(1)}px`,
            '--spin': `${deg * 3}deg`,
          } as CSSProperties
        }
      />
    ))}
  </g>
);

// --- COMPONENT ---
/** Grand Griffon Rio, seated, wings half spread, haloed. */
export const GrandGriffon = ({ mood }: { mood: HeroMood }) => (
  <>
    <HaloLight halo={GRIFFON_HALO} />
    <Tail />
    <Wings />
    <HaloShards halo={GRIFFON_HALO} />
    <HaloRing halo={GRIFFON_HALO} />
    <Pair left={HAUNCH} lit={LION.lit} shade={LION.shade} />
    <Pair left={HIND_PAW} lit={LION.lit} shade={LION.shade} />
    <Pair left={BELLY} lit={LION.shade} shade={LION.shade} />
    <Pair left={BREAST_SHAPE} lit={BREAST.lit} shade={BREAST.shade} />
    <Talons />
    <Pair left={PLUMAGE_SHAPE} lit={PLUMAGE.lit} shade={PLUMAGE.shade} />
    <Face mood={mood} />
    <ClawStreaks />
    <DeathFeathers />
    <DeathBurst at={CHEST} />
  </>
);
