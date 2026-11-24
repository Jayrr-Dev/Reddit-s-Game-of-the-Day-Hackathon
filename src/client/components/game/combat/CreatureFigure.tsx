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
//   Its mood changes the eyes: slits while attacking, ">" "<" squeezed
//   shut when hit.
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
const EYE = '#4a2a22';
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
/** Half the head and neck. */
const HEAD: readonly Point[] = [
  [768, 225],
  [655, 297],
  [690, 330],
  [650, 505],
  [768, 520],
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
/** The left eye's box: left, top, width, height. */
const EYE_BOX = { x: 733, y: 328, width: 12, height: 30 } as const;
/** Holy fire: a cone from the jaws down toward the villain. */
const BREATH: readonly Point[] = [
  [745, 480],
  [791, 480],
  [990, 1060],
  [546, 1060],
];
const JAW: Point = [768, 480];

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

/** The eyes for a mood: slits when fierce, squeezed ">" "<" in a wince. */
const DragonEyes = ({ mood }: { mood: HeroMood }) => {
  if (mood === 'wince') {
    const squint: readonly Point[] = [
      [722, 325],
      [752, 343],
      [722, 361],
      [722, 352],
      [740, 343],
      [722, 334],
    ];
    return <Pair left={squint} lit={EYE} shade={EYE} />;
  }
  const isFierce = mood === 'fierce';
  const height = isFierce ? EYE_BOX.height * 0.4 : EYE_BOX.height;
  const top = EYE_BOX.y + (EYE_BOX.height - height);
  const box: readonly Point[] = [
    [EYE_BOX.x, top],
    [EYE_BOX.x + EYE_BOX.width, top + (isFierce ? 6 : 0)],
    [EYE_BOX.x + EYE_BOX.width, top + height],
    [EYE_BOX.x, top + height],
  ];
  return <Pair left={box} lit={EYE} shade={EYE} />;
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
      <Pair left={HORN} lit={GOLD.lit} shade={GOLD.shade} />
      <Pair left={HEAD} lit={IVORY.lit} shade={IVORY.shade} />
      <DragonEyes mood={mood} />
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
