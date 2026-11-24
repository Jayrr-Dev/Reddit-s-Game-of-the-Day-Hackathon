// ===================================================================
// CREATURE FIGURES
// Drawings for heroes that are not people (see CREATURE_IDS), in the
// same flat, two-tone style as HeroFigure: each part a lit left half
// and a shadowed right half, no outlines. They share HeroFigure's
// viewBox (BODY_WIDTH x BODY_HEIGHT), feet on the bottom edge, so the
// battlefield fits, anchors and animates them like any other hero.
//
// HOLY DRAGON
//   Traced from the concept art (1536 x 1024) and scaled into the
//   viewBox with `art()`, so the shapes stay easy to compare with it.
//   It moves through the same data-action hooks as the heroes (see
//   index.css, "CREATURE ACTIONS"):
//     every move   the wings beat once
//     magic/range  a cone of holy fire pours from its jaws
//     support      the halo flares
//   It has a real face (brow ridges, gold slit-pupil eyes, a muzzle
//   with nostrils) that takes the heroes' moods: jaws open and brows
//   down when fierce, squeezed shut and teeth clenched in a wince,
//   brows lifted and mouth turned down when worried.
// ===================================================================

import type { CSSProperties, JSX } from 'react';
import type {
  CreatureId,
  HeroAction,
  HeroMood,
} from '../../../content/heroLooks';
import type { HeroSize } from '../../../../shared/game/types';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';

// --- TYPES ---
type Point = readonly [number, number];

export type CreatureFigureProps = {
  heroId: CreatureId;
  size: HeroSize;
  action?: HeroAction | null;
  mood?: HeroMood;
};

// --- CONSTANTS: CONCEPT ART FRAME ---
/** The concept art's width; its centre line is the dragon's. */
const ART_WIDTH = 1536;
const ART_MID = ART_WIDTH / 2;

// --- CONSTANTS: HOLY DRAGON PALETTE ---
const IVORY = { lit: '#ece2cf', shade: '#cbbba3' };
const LIMB = { lit: '#ddd0bb', shade: '#bfae95' };
const HAUNCH = '#a99178';
const WING = {
  outerLit: '#8d7596',
  innerLit: '#6e5a7a',
  outerShade: '#7a6684',
  innerShade: '#5c4a68',
};
const GOLD = { lit: '#d2a64c', shade: '#a9822f' };
const FEATURE = '#4a2a22';
const EYE_GOLD = '#f0c95a';
const MUZZLE_TONE = { lit: '#f6eee0', shade: '#d8c9b0' };
const HOLY_FIRE = '#fff0b0';

// --- CONSTANTS: HOLY DRAGON SHAPES (ART COORDINATES, LEFT SIDE) ---
/** Wing: the bright outer membrane and the darker inner one. */
const WING_OUTER: readonly Point[] = [
  [497, 242],
  [270, 440],
  [147, 686],
  [228, 632],
  [302, 627],
  [375, 718],
];
const WING_INNER: readonly Point[] = [
  [497, 242],
  [375, 718],
  [560, 560],
  [640, 515],
  [545, 445],
];
/** Where a wing meets the back: the pivot it beats around. */
const WING_ROOT: Point = [590, 480];
/** The hind leg, crouched behind the body. */
const HAUNCH_SHAPE: readonly Point[] = [
  [505, 760],
  [420, 770],
  [360, 945],
  [470, 945],
  [500, 930],
];
/** The tail curls up on the right only. */
const TAIL: readonly Point[] = [
  [1050, 930],
  [1150, 895],
  [1250, 835],
  [1270, 790],
  [1245, 742],
  [1170, 740],
  [1250, 712],
  [1290, 760],
  [1300, 830],
  [1250, 880],
  [1100, 945],
];
/** Half the chest and belly, centre line to flank. */
const TORSO: readonly Point[] = [
  [768, 505],
  [652, 505],
  [505, 572],
  [445, 720],
  [470, 830],
  [520, 945],
  [768, 945],
];
const FORELEG: readonly Point[] = [
  [505, 640],
  [445, 720],
  [500, 945],
  [640, 945],
  [600, 720],
];
/** Three claws on a forefoot. */
const CLAWS: readonly (readonly Point[])[] = [
  [
    [445, 975],
    [470, 915],
    [500, 915],
    [470, 975],
  ],
  [
    [520, 975],
    [515, 915],
    [545, 915],
    [555, 975],
  ],
  [
    [605, 975],
    [575, 915],
    [605, 915],
    [635, 975],
  ],
];
/** Half the neck, under the head. */
const NECK: readonly Point[] = [
  [768, 340],
  [700, 350],
  [652, 505],
  [768, 520],
];
/** Half the skull: a broad brow narrowing to the cheek. */
const SKULL: readonly Point[] = [
  [768, 212],
  [700, 240],
  [650, 292],
  [668, 340],
  [712, 360],
  [768, 362],
];
/** A spike swept back from each cheek. */
const CHEEK_SPIKE: readonly Point[] = [
  [650, 292],
  [596, 320],
  [668, 332],
];
/** Half the muzzle, jutting down toward you, a shade lighter. */
const MUZZLE: readonly Point[] = [
  [768, 330],
  [722, 342],
  [730, 425],
  [768, 445],
];
const NOSTRIL: readonly Point[] = [
  [740, 404],
  [757, 409],
  [753, 420],
  [738, 415],
];
const HORN: readonly Point[] = [
  [530, 137],
  [700, 195],
  [740, 245],
  [705, 250],
];
const HALO_CENTRE: Point = [768, 230];
const HALO_RADIUS = 170;
const HALO_STROKE = 10;
/** The left eye's centre; eye shapes are offsets from it. */
const EYE_CENTRE: Point = [712, 318];
/** Holy fire: a cone from the jaws down toward the villain. */
const BREATH: readonly Point[] = [
  [745, 440],
  [791, 440],
  [990, 1060],
  [546, 1060],
];
const JAW: Point = [768, 440];

// --- HELPERS ---
/** Concept-art units to viewBox units (one scale for both axes). */
const ART_SCALE = BODY_WIDTH[3] / ART_WIDTH;
const art = ([x, y]: Point): Point => [x * ART_SCALE, y * ART_SCALE];

/** Points (in art units) as an SVG points string in viewBox units. */
const pts = (points: readonly Point[]): string =>
  points
    .map(art)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

/** Mirrors art points across the dragon's centre line. */
const mirrored = (points: readonly Point[]): Point[] =>
  points.map(([x, y]) => [ART_WIDTH - x, y] as const);

/** A CSS transform origin at an art point, in viewBox units. */
const originAt = (point: Point): CSSProperties => {
  const [x, y] = art(point);
  return { transformOrigin: `${x}px ${y}px` };
};

// --- SUBCOMPONENTS: HOLY DRAGON ---
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

/** Both wings, each beating around its root. */
const Wings = () => (
  <>
    <g className="dragon-wing-left" style={originAt(WING_ROOT)}>
      <polygon points={pts(WING_OUTER)} fill={WING.outerLit} />
      <polygon points={pts(WING_INNER)} fill={WING.innerLit} />
    </g>
    <g
      className="dragon-wing-right"
      style={originAt([ART_WIDTH - WING_ROOT[0], WING_ROOT[1]])}
    >
      <polygon points={pts(mirrored(WING_OUTER))} fill={WING.outerShade} />
      <polygon points={pts(mirrored(WING_INNER))} fill={WING.innerShade} />
    </g>
  </>
);

// --- SUBCOMPONENTS: HOLY DRAGON FACE ---
/** Offsets (art units) moved to the left eye's centre. */
const atEye = (offsets: readonly Point[]): Point[] =>
  offsets.map(([dx, dy]) => [EYE_CENTRE[0] + dx, EYE_CENTRE[1] + dy] as const);

/**
 * Each mood's eye: a gold almond with a slit pupil at rest, narrowed
 * when fierce, lifted at the inner corner when worried, and squeezed
 * shut (">" "<") in a wince. Offsets are for the left eye, +x inward.
 */
const DRAGON_EYE: Record<HeroMood, readonly Point[]> = {
  calm: [
    [-26, -2],
    [-6, -12],
    [20, -8],
    [24, 4],
    [2, 12],
    [-22, 6],
  ],
  fierce: [
    [-26, 0],
    [22, -8],
    [24, 2],
    [-22, 6],
  ],
  worried: [
    [-26, 0],
    [-4, -8],
    [20, -16],
    [24, 4],
    [2, 12],
    [-22, 6],
  ],
  wince: [
    [-22, -12],
    [22, 0],
    [-22, 12],
    [-22, 5],
    [6, 0],
    [-22, -5],
  ],
};
/** The slit pupil (hidden when the eye is shut). */
const PUPIL: Record<HeroMood, readonly Point[] | null> = {
  calm: [
    [-3, -10],
    [3, -10],
    [3, 10],
    [-3, 10],
  ],
  fierce: [
    [-3, -6],
    [3, -7],
    [3, 4],
    [-3, 5],
  ],
  worried: [
    [-3, -8],
    [3, -9],
    [3, 10],
    [-3, 10],
  ],
  wince: null,
};

/**
 * The brow ridge over each eye. `tilt` drops its inner end (angry,
 * pained) or lifts it (worried), like the heroes' brows.
 */
const BROW_TILT: Record<HeroMood, number> = {
  calm: 0,
  fierce: 16,
  wince: 10,
  worried: -16,
};
const browRidge = (mood: HeroMood): Point[] => {
  const tilt = BROW_TILT[mood];
  return [
    [672, 290],
    [754, 296 + tilt],
    [754, 309 + tilt],
    [676, 304],
  ];
};

/** Each mood's mouth along the muzzle's tip (left half, mirrored). */
const DRAGON_MOUTH: Record<HeroMood, readonly Point[]> = {
  // A faint closed smile.
  calm: [
    [734, 424],
    [768, 436],
    [768, 442],
    [734, 430],
  ],
  // Jaws open.
  fierce: [
    [732, 420],
    [768, 420],
    [768, 466],
    [748, 464],
  ],
  // Clenched: a short open bar (the teeth go over it).
  wince: [
    [736, 420],
    [768, 420],
    [768, 440],
    [740, 438],
  ],
  // Corners pulled down.
  worried: [
    [734, 438],
    [768, 426],
    [768, 432],
    [734, 444],
  ],
};
/** Fangs (fierce) and a band of clenched teeth (wince). */
const FANG: readonly Point[] = [
  [738, 421],
  [750, 421],
  [744, 440],
];
const CLENCHED_TEETH: readonly Point[] = [
  [739, 423],
  [768, 423],
  [768, 431],
  [740, 430],
];
const TEETH = '#fbf6ea';

/** The face: brow ridges, gold eyes, nostrils and a mood mouth. */
const DragonFace = ({ mood }: { mood: HeroMood }) => {
  const eye = atEye(DRAGON_EYE[mood]);
  const pupil = PUPIL[mood];
  const isShut = mood === 'wince';
  return (
    <>
      <Pair left={MUZZLE} lit={MUZZLE_TONE.lit} shade={MUZZLE_TONE.shade} />
      <Pair left={NOSTRIL} lit={FEATURE} shade={FEATURE} />
      <Pair
        left={eye}
        lit={isShut ? FEATURE : EYE_GOLD}
        shade={isShut ? FEATURE : EYE_GOLD}
      />
      {pupil && <Pair left={atEye(pupil)} lit={FEATURE} shade={FEATURE} />}
      <Pair left={browRidge(mood)} lit={IVORY.shade} shade={HAUNCH} />
      <Pair left={DRAGON_MOUTH[mood]} lit={FEATURE} shade={FEATURE} />
      {mood === 'fierce' && <Pair left={FANG} lit={TEETH} shade={TEETH} />}
      {isShut && <Pair left={CLENCHED_TEETH} lit={TEETH} shade={TEETH} />}
    </>
  );
};

/** The holy dragon, crouched, wings spread, haloed. */
const HolyDragon = ({ mood }: { mood: HeroMood }) => {
  const [haloX, haloY] = art(HALO_CENTRE);
  const [jawX, jawY] = art(JAW);
  return (
    <>
      {/* SHADOW */}
      <ellipse
        cx={ART_MID * ART_SCALE}
        cy="96"
        rx="58"
        ry="3.5"
        fill="black"
        opacity="0.45"
      />
      <Wings />
      <circle
        className="dragon-halo"
        cx={haloX}
        cy={haloY}
        r={HALO_RADIUS * ART_SCALE}
        fill="none"
        stroke={GOLD.lit}
        strokeWidth={HALO_STROKE * ART_SCALE}
      />
      <polygon points={pts(HAUNCH_SHAPE)} fill={HAUNCH} />
      <polygon points={pts(mirrored(HAUNCH_SHAPE))} fill={HAUNCH} />
      <polygon points={pts(TAIL)} fill={IVORY.shade} />
      <Pair left={TORSO} lit={IVORY.lit} shade={IVORY.shade} />
      <Pair left={FORELEG} lit={LIMB.lit} shade={LIMB.shade} />
      {CLAWS.map((claw) => (
        <Pair
          key={claw[0]?.[0]}
          left={claw}
          lit={LIMB.lit}
          shade={LIMB.shade}
        />
      ))}
      <Pair left={NECK} lit={IVORY.lit} shade={IVORY.shade} />
      <Pair left={HORN} lit={GOLD.lit} shade={GOLD.shade} />
      <Pair left={CHEEK_SPIKE} lit={LIMB.lit} shade={LIMB.shade} />
      <Pair left={SKULL} lit={IVORY.lit} shade={IVORY.shade} />
      <DragonFace mood={mood} />
      {/* HOLY FIRE POURS FROM THE JAWS (hidden until it breathes) */}
      <polygon
        className="dragon-breath"
        points={pts(BREATH)}
        fill={HOLY_FIRE}
        opacity="0"
        style={{ transformOrigin: `${jawX}px ${jawY}px` }}
      />
    </>
  );
};

// --- CATALOG ---
/** Each creature's drawing. */
const CREATURE_DRAWINGS: Record<
  CreatureId,
  (props: { mood: HeroMood }) => JSX.Element
> = {
  holyDragon: HolyDragon,
};

// --- COMPONENT ---
/** Draws a creature hero in the shared hero viewBox. */
export const CreatureFigure = ({
  heroId,
  size,
  action = null,
  mood = 'calm',
}: CreatureFigureProps) => {
  const Drawing = CREATURE_DRAWINGS[heroId];
  return (
    <svg
      viewBox={`0 0 ${BODY_WIDTH[size]} ${BODY_HEIGHT}`}
      className="h-full w-full overflow-visible"
      data-action={action?.style}
      aria-hidden="true"
    >
      <Drawing mood={mood} />
    </svg>
  );
};
