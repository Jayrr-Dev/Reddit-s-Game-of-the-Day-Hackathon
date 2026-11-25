// ===================================================================
// HORNED KNIGHT FIGURE
// A heavy knight in dark plate with bone horns on a closed helm, skull
// pauldrons and a skull on the breastplate, his crossed gauntlets
// resting on the pommel of a great warhammer that stands on the ground.
// Drawn from Sam's reference in the creatures' flat, faceted style:
// each part is its shadowed tone with the lit tone clipped to the left
// of a split line, no outlines. Figure only for now (no hero uses it
// yet). Drawn in a 1100 x 1000 space, scaled into the size-2 viewBox
// (BODY_WIDTH[2] x BODY_HEIGHT), feet on the bottom edge.
// ===================================================================

import { useId } from 'react';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';

// --- TYPES ---
type Pt = readonly [number, number];
type Tone = { lit: string; shade: string };
type Part = { tone: Tone; points: readonly Pt[]; split: number };

// --- CONSTANTS: PALETTE ---
const PLATE: Tone = { lit: '#9a95a3', shade: '#757080' };
const DARK_PLATE: Tone = { lit: '#666270', shade: '#4d4a57' };
const BONE: Tone = { lit: '#ddd3c1', shade: '#b4a891' };
const CLOTH: Tone = { lit: '#5c4838', shade: '#45352a' };
const HAFT: Tone = { lit: '#8f7f66', shade: '#6c5f4c' };
const HAMMER: Tone = { lit: '#5a5664', shade: '#403d49' };
const STUD: Tone = { lit: '#8a8594', shade: '#2e2b35' };
const VISOR = '#1d1b22';

/** Drawing space to viewBox units (size-2 body, 1100 x 1000). */
const SCALE = BODY_HEIGHT / 1000;

// --- CONSTANTS: PARTS (BACK TO FRONT) ---
/** One faceted part: `tone` split into lit/shade at x = `split`. */
const part = (tone: Tone, split: number, ...points: Pt[]): Part => ({
  tone,
  points,
  split,
});

const LEGS: Part[] = [
  part(DARK_PLATE, 595, [560, 690], [632, 690], [642, 900], [568, 900]),
  part(DARK_PLATE, 470, [436, 680], [522, 680], [520, 900], [428, 900]),
  part(DARK_PLATE, 615, [556, 895], [662, 895], [676, 1000], [552, 1000]),
  part(DARK_PLATE, 455, [404, 895], [528, 895], [530, 1000], [376, 1000]),
];
const TABARD = part(
  CLOTH,
  555,
  [478, 560],
  [626, 560],
  [646, 812],
  [560, 786],
  [468, 820]
);
const FAULDS: Part[] = [
  part(PLATE, 545, [452, 520], [642, 520], [654, 598], [444, 604]),
  part(PLATE, 495, [430, 598], [560, 598], [552, 666], [424, 676]),
  part(PLATE, 600, [560, 598], [650, 598], [660, 660], [566, 666]),
];
const TORSO = part(
  DARK_PLATE,
  548,
  [466, 296],
  [634, 296],
  [646, 522],
  [550, 566],
  [454, 522]
);
const RIGHT_PAULDRON = part(
  PLATE,
  660,
  [598, 252],
  [724, 270],
  [746, 360],
  [690, 380],
  [616, 352]
);
const HAFT_PARTS: Part[] = [
  part(HAFT, 712, [700, 452], [724, 452], [736, 850], [712, 850]),
  part(HAFT, 714, [694, 560], [730, 560], [732, 584], [696, 584]),
  part(HAFT, 718, [698, 680], [734, 680], [736, 704], [700, 704]),
];
const HAMMER_HEAD: Part[] = [
  part(HAMMER, 735, [640, 842], [834, 842], [840, 1000], [634, 1000]),
  part(DARK_PLATE, 735, [652, 826], [822, 826], [834, 842], [640, 842]),
];
/** Pyramid studs on the hammer's face: [centre x, centre y]. */
const STUDS: readonly Pt[] = [
  [680, 890],
  [680, 955],
  [790, 890],
  [790, 955],
];
const HORNS: Part[] = [
  part(
    BONE,
    470,
    [478, 200],
    [428, 126],
    [436, 34],
    [462, 22],
    [474, 108],
    [512, 186]
  ),
  part(
    BONE,
    662,
    [622, 200],
    [690, 116],
    [684, 22],
    [658, 34],
    [652, 112],
    [590, 186]
  ),
];
const HELM = part(
  PLATE,
  550,
  [488, 150],
  [612, 150],
  [628, 262],
  [550, 304],
  [472, 262]
);
const LEFT_PAULDRON: Part[] = [
  part(PLATE, 430, [350, 284], [502, 246], [526, 330], [474, 404], [336, 386]),
  part(BONE, 430, [342, 372], [476, 392], [470, 410], [334, 394]),
];
const ARMS: Part[] = [
  part(PLATE, 560, [430, 392], [474, 378], [702, 448], [700, 492], [452, 444]),
  part(DARK_PLATE, 700, [638, 428], [744, 438], [746, 500], [652, 504]),
];
/** Skulls: on the left pauldron and the breastplate. [x, y, radius]. */
const SKULLS: readonly (readonly [number, number, number])[] = [
  [412, 316, 28],
  [562, 382, 30],
];

// --- HELPERS ---
const toPoints = (points: readonly Pt[]): string =>
  points.map(([x, y]) => `${x},${y}`).join(' ');

// --- SUBCOMPONENTS ---
/** One part: its shade tone, then its lit tone clipped left of the split. */
const Facet = ({ tone, points, split }: Part) => {
  const id = useId();
  return (
    <g>
      <clipPath id={id}>
        <rect x={0} y={0} width={split} height={1000} />
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

/** A small skull: a lit dome, dark eye sockets and a jaw. */
const Skull = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={BONE.shade} />
    <path
      d={`M${x - r} ${y} A${r} ${r} 0 0 1 ${x} ${y - r} L${x} ${y + r} Z`}
      fill={BONE.lit}
    />
    <rect
      x={x - r * 0.45}
      y={y + r * 0.7}
      width={r * 0.9}
      height={r * 0.5}
      fill={BONE.shade}
    />
    <circle cx={x - r * 0.38} cy={y + r * 0.05} r={r * 0.24} fill={VISOR} />
    <circle cx={x + r * 0.38} cy={y + r * 0.05} r={r * 0.24} fill={VISOR} />
  </g>
);

/** A pyramid stud: four facets meeting at its centre. */
const Stud = ([x, y]: Pt) => {
  const s = 22;
  return (
    <g key={`${x}-${y}`}>
      <polygon
        points={toPoints([
          [x - s, y - s],
          [x + s, y - s],
          [x, y],
        ])}
        fill={STUD.lit}
      />
      <polygon
        points={toPoints([
          [x - s, y - s],
          [x - s, y + s],
          [x, y],
        ])}
        fill={HAMMER.lit}
      />
      <polygon
        points={toPoints([
          [x + s, y - s],
          [x + s, y + s],
          [x, y],
        ])}
        fill={STUD.shade}
      />
      <polygon
        points={toPoints([
          [x - s, y + s],
          [x + s, y + s],
          [x, y],
        ])}
        fill={HAMMER.shade}
      />
    </g>
  );
};

/** The closed helm's visor: a cross of dark slits. */
const Visor = () => (
  <g fill={VISOR}>
    <rect x={494} y={212} width={112} height={12} />
    <rect x={544} y={212} width={12} height={74} />
  </g>
);

// --- COMPONENT ---
/** Draws the horned knight leaning on his warhammer. */
export const HornedKnightFigure = () => (
  <svg
    viewBox={`0 0 ${BODY_WIDTH[2]} ${BODY_HEIGHT}`}
    className="h-full w-full overflow-visible"
    aria-hidden="true"
  >
    <g transform={`scale(${SCALE})`}>
      {LEGS.map((p, i) => (
        <Facet key={`leg-${i}`} {...p} />
      ))}
      <Facet {...TABARD} />
      {FAULDS.map((p, i) => (
        <Facet key={`fauld-${i}`} {...p} />
      ))}
      <Facet {...TORSO} />
      <Skull x={SKULLS[1]![0]} y={SKULLS[1]![1]} r={SKULLS[1]![2]} />
      <Facet {...RIGHT_PAULDRON} />
      {HAFT_PARTS.map((p, i) => (
        <Facet key={`haft-${i}`} {...p} />
      ))}
      {HAMMER_HEAD.map((p, i) => (
        <Facet key={`head-${i}`} {...p} />
      ))}
      {STUDS.map(Stud)}
      {HORNS.map((p, i) => (
        <Facet key={`horn-${i}`} {...p} />
      ))}
      <Facet {...HELM} />
      <Visor />
      {LEFT_PAULDRON.map((p, i) => (
        <Facet key={`pauldron-${i}`} {...p} />
      ))}
      <Skull x={SKULLS[0]![0]} y={SKULLS[0]![1]} r={SKULLS[0]![2]} />
      {ARMS.map((p, i) => (
        <Facet key={`arm-${i}`} {...p} />
      ))}
    </g>
  </svg>
);
