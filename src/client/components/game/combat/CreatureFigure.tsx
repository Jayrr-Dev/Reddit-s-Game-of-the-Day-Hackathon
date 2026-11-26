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
//     signature    Halo of Judgment: the halo swells and blazes, rays
//                  of light wheel out from it, then it fires
//     death        the halo cracks into flying shards, light bursts
//                  from its chest and the wings crumple
//   It has a real face (brow ridges, gold slit-pupil eyes, a muzzle
//   with nostrils) that takes the heroes' moods: jaws open and brows
//   down when fierce, squeezed shut and teeth clenched in a wince,
//   brows lifted and mouth turned down when worried.
//
// ANGEL ARCHER
//   A "biblically accurate" angel: one great eye in a gold ring, ringed
//   by six feathered wings that flutter on their own. It looses arrows
//   of light (the eye flares as it fires) and its eye takes the moods.
//
// BALLISTA
//   Sam's painted art (assets/heroes/ballista.webp, its backdrop keyed
//   out), standing on the bottom edge, 1.5 cells wide. A machine:
//   no face, so it takes no moods.
// ===================================================================

import type { JSX } from 'react';
import { IvoryWerewolf, WolfCentaur } from './WolfFigures';
import { AngelMage } from './AngelMageFigure';
import { WingedArcher } from './WingedArcherFigure';
import { ApollyonSeraph } from './ApollyonSeraphFigure';
import slothArt from '../../../assets/heroes/sloth.webp';
import prideArt from '../../../assets/heroes/pride.webp';
import lustArt from '../../../assets/heroes/lust.webp';
import gluttonyArt from '../../../assets/heroes/gluttony.webp';
import greedArt from '../../../assets/heroes/greed.webp';
import envyArt from '../../../assets/heroes/envy.webp';
import moriArt from '../../../assets/heroes/light-lord-mori.webp';
import azulaArt from '../../../assets/heroes/mage-borne-azula.webp';
import cherubielArt from '../../../assets/heroes/grandangel-cherubiel.webp';
import fulgurArt from '../../../assets/heroes/fulgur-dragonknight-idle.webp';
import zadkielArt from '../../../assets/heroes/zadkiel-of-dominations.webp';
import cervielStaffArt from '../../../assets/heroes/cerviel-staff.webp';
import cervielSwordArt from '../../../assets/cerviel/Villain-Run-Cerviel-Sword-Grips.webp';
import cervielOpenArt from '../../../assets/cerviel/Villain-Run-Cerviel-Open-Hands.webp';
import cervielFistsArt from '../../../assets/cerviel/Villain-Run-Cerviel-Closed-Fists.webp';
import { ArcherSprite } from './ArcherSprite';
import cambielArt from '../../../assets/heroes/grandangel-cambiel.webp';
import geonosisArt from '../../../assets/heroes/grandangel-geonosis.webp';
import razielArt from '../../../assets/heroes/grandangel-raziel.webp';
import zeruelArt from '../../../assets/heroes/archangel-zeruel.webp';
import astraArt from '../../../assets/heroes/mage-borne-astra.webp';
import twinAxeArt from '../../../assets/heroes/archangels/general-khan.webp';
import { UrielFigure } from './UrielFigure';
import zeruelArmoredArt from '../../../assets/heroes/archangels/zeruel-armored.webp';
import alphaPlasmaArt from '../../../assets/heroes/archangels/alpha-plasma.webp';
import omegaPlasmaArt from '../../../assets/heroes/archangels/omega-plasma.webp';
import angelAssassinArt from '../../../assets/heroes/angel-assassin.webp';
import ballistaArt from '../../../assets/heroes/ballista.webp';
import type {
  CreatureId,
  HeroAction,
  HeroMood,
} from '../../../content/heroLooks';
import type { HeroSize } from '../../../../shared/game/types';
import {
  ART_WIDTH,
  art,
  mirrored,
  originAt,
  polar,
  pts,
  type Point,
} from '../../../lib/creatureArt';
import { BODY_HEIGHT, BODY_WIDTH } from '../../../lib/heroFigure';
import { GrandGriffon } from './GriffonFigure';
import { TempestWyrm } from './TempestFigure';
import {
  DeathBurst,
  HaloLight,
  HaloRing,
  HaloShards,
  type HaloSpec,
} from './HolyHalo';
import { ProgressiveSvgImage } from '../../ui/ProgressiveImage';

// --- TYPES ---
export type CreatureFigureProps = {
  heroId: CreatureId;
  size: HeroSize;
  action?: HeroAction | null;
  mood?: HeroMood;
};

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
/** The dragon's halo, over its brow. */
const DRAGON_HALO: HaloSpec = { centre: [768, 230], radius: 170, stroke: 10 };
/** Where the death's light bursts out of the dragon (its chest). */
const CHEST: Point = [768, 600];
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
  const [jawX, jawY] = art(JAW);
  return (
    <>
      <HaloLight halo={DRAGON_HALO} />
      <Wings />
      <HaloShards halo={DRAGON_HALO} />
      <HaloRing halo={DRAGON_HALO} />
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
      <DeathBurst at={CHEST} />
    </>
  );
};

// --- CONSTANTS: ANGEL ARCHER (VIEWBOX UNITS, SIZE 1: 60 x 100) ---
/** Where the eye floats: above the ground, like a hovering archer. */
const ANGEL_EYE: Point = [30, 52];
const ANGEL_RING_RADIUS = 8.5;
const ANGEL_SCLERA_RADIUS = 6;
const ANGEL_IRIS_RADIUS = 3.6;
const ANGEL_PUPIL_RADIUS = 1.7;
const ANGEL_GOLD = { lit: '#d9b45a', shade: '#a88536' };
const ANGEL_FEATHER = { lit: '#fffdf8', shade: '#d8deea' };
const ANGEL_IRIS = '#4f8fd6';
const ANGEL_PUPIL = '#14202e';
/**
 * The six wings, as angles from the eye (0 = right, y down): an upper
 * pair raised high, a pair spread level and a pair hanging low. Wings
 * pointing left take the lit tones, right ones the shaded.
 */
const ANGEL_WING_ANGLES = [-125, -55, -170, -10, 120, 60] as const;
/**
 * One wing pointing right from its root (the eye's rim): a smooth upper
 * edge and a serrated lower edge of feather tips.
 */
const ANGEL_WING: readonly Point[] = [
  [0, -2.5],
  [7, -6],
  [15, -7.5],
  [23, -6.5],
  [28, -4],
  [24, -1.5],
  [26, 1],
  [20, 0.5],
  [21, 3],
  [15, 1.5],
  [15, 4],
  [9, 2],
  [8, 4],
  [3, 2.5],
];
/** The wing's upper feather layer, drawn lighter over the whole wing. */
const ANGEL_WING_COVERT: readonly Point[] = [
  [0, -2.5],
  [7, -6],
  [15, -7.5],
  [23, -6.5],
  [28, -4],
  [18, -2.5],
  [8, -1],
];
/** How the eye looks per mood: iris offset and the lid's cover (0-1). */
const ANGEL_GAZE: Record<HeroMood, { dy: number; lid: number }> = {
  calm: { dy: 0, lid: 0 },
  fierce: { dy: 0.6, lid: 0.4 },
  worried: { dy: -1.6, lid: 0 },
  wince: { dy: 0, lid: 1 },
};

/** Points (viewBox units) as an SVG points string. */
const rawPts = (points: readonly Point[]): string =>
  points.map(([x, y]) => `${x},${y}`).join(' ');

// --- SUBCOMPONENTS: ANGEL ARCHER ---
/**
 * One wing, set on the eye's rim at its angle. The outer group places
 * it; the inner one flutters around the root (CSS, transform only).
 * Wings pointing left are flipped so their feathers hang the same way.
 */
const AngelWing = ({ deg, index }: { deg: number; index: number }) => {
  const isLeft = Math.abs(deg) > 90;
  const tone = isLeft ? 'lit' : 'shade';
  const [x, y] = polar(ANGEL_EYE, ANGEL_RING_RADIUS - 1, deg);
  return (
    <g
      transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg}) scale(1 ${isLeft ? -1 : 1})`}
    >
      <g className="angel-wing" style={{ animationDelay: `${-index * 230}ms` }}>
        <polygon points={rawPts(ANGEL_WING)} fill={ANGEL_FEATHER.shade} />
        <polygon
          points={rawPts(ANGEL_WING_COVERT)}
          fill={ANGEL_FEATHER[tone]}
        />
      </g>
    </g>
  );
};

/**
 * The eyelid: the part of the eye above the line `lidY`, in gold (a
 * circular segment cut by that chord); fully shut, the whole eye.
 */
const AngelLid = ({
  cx,
  cy,
  r,
  lidY,
}: {
  cx: number;
  cy: number;
  r: number;
  lidY: number;
}) => {
  if (lidY >= cy + r)
    return <circle cx={cx} cy={cy} r={r} fill={ANGEL_GOLD.lit} />;
  const halfChord = Math.sqrt(r * r - (lidY - cy) ** 2);
  const isPastMiddle = lidY > cy ? 1 : 0;
  return (
    <path
      d={`M${cx - halfChord} ${lidY} A${r} ${r} 0 ${isPastMiddle} 1 ${cx + halfChord} ${lidY} Z`}
      fill={ANGEL_GOLD.lit}
    />
  );
};

/** The great eye: gold ring, white, blue iris, and a lid for moods. */
const AngelEye = ({ mood }: { mood: HeroMood }) => {
  const [cx, cy] = ANGEL_EYE;
  const { dy, lid } = ANGEL_GAZE[mood];
  const r = ANGEL_SCLERA_RADIUS;
  // The lid comes down from the top: its lower edge sits at lidY.
  const lidY = cy - r + 2 * r * lid;
  return (
    <>
      <circle cx={cx} cy={cy} r={ANGEL_RING_RADIUS} fill={ANGEL_GOLD.shade} />
      <path
        d={`M${cx} ${cy - ANGEL_RING_RADIUS} A${ANGEL_RING_RADIUS} ${ANGEL_RING_RADIUS} 0 0 0 ${cx} ${cy + ANGEL_RING_RADIUS} Z`}
        fill={ANGEL_GOLD.lit}
      />
      <circle cx={cx} cy={cy} r={r} fill="#fbf8ef" />
      {lid < 1 && (
        <>
          <circle
            cx={cx}
            cy={cy + dy}
            r={ANGEL_IRIS_RADIUS}
            fill={ANGEL_IRIS}
          />
          <circle
            cx={cx}
            cy={cy + dy}
            r={ANGEL_PUPIL_RADIUS * (mood === 'fierce' ? 0.7 : 1)}
            fill={ANGEL_PUPIL}
          />
          <circle cx={cx - 1.2} cy={cy + dy - 1.3} r="0.8" fill="white" />
        </>
      )}
      {lid > 0 && <AngelLid cx={cx} cy={cy} r={r} lidY={lidY} />}
      {lid === 1 && (
        <line
          x1={cx - r}
          y1={cy}
          x2={cx + r}
          y2={cy}
          stroke={ANGEL_PUPIL}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      )}
      {/* THE EYE FLARES AS IT LOOSES (hidden until it shoots) */}
      <circle
        className="angel-flare"
        cx={cx}
        cy={cy}
        r={ANGEL_RING_RADIUS + 3}
        fill="#fff6cf"
        opacity="0"
      />
    </>
  );
};

/** The angel archer: six wings around one great eye, hovering. */
const AngelArcher = ({ mood }: { mood: HeroMood }) => (
  <>
    <g className="angel-hover">
      {ANGEL_WING_ANGLES.map((deg, index) => (
        <AngelWing key={deg} deg={deg} index={index} />
      ))}
      <AngelEye mood={mood} />
    </g>
  </>
);

// --- BALLISTA ---
/** The art's width / height (480 x 393), to fit it on the ground. */
const BALLISTA_ASPECT = 480 / 393;

/**
 * How many cells wide the ballista is drawn: it fills one cell but its
 * bow spills half a cell past it, centred (the svg doesn't clip).
 */
const BALLISTA_DRAW_SPAN = 1.5;

/** The ballista: Sam's art, 1.5 cells wide, base on the ground. */
const Ballista = () => {
  const width = BODY_WIDTH[1] * BALLISTA_DRAW_SPAN;
  const height = width / BALLISTA_ASPECT;
  return (
    <ProgressiveSvgImage
      href={ballistaArt}
      x={(BODY_WIDTH[1] - width) / 2}
      y={BODY_HEIGHT - height}
      width={width}
      height={height}
    />
  );
};

/** The original Penitent concept art, positioned to show its halo and keep the robe above the shadow. */
const LightLordMori = () => (
  <g className="angel-hover" data-light-lord-mori="">
    <ProgressiveSvgImage href={moriArt} x={21} y={-11} width={108} height={108} />
  </g>
);

/** The original Seven-Eyed Oracle art, positioned with the robe at the shared baseline. */
const MageBorneAzula = () => (
  <g data-mage-borne-azula="">
    <ProgressiveSvgImage href={azulaArt} x={37} y={-12} width={76} height={114} />
  </g>
);

/** The original many-eyed angel art, kept centered above its battlefield shadow. */
const GrandangelCherubiel = () => (
  <g className="angel-hover" data-grandangel-cherubiel="">
    <ProgressiveSvgImage href={cherubielArt} x={15} y={-24} width={120} height={120} />
  </g>
);

const FulgurDragonknight = () => (
  <g className="fulgur-throw-pose">
    <ProgressiveSvgImage data-fulgur-dragonknight="" href={fulgurArt} x={1} y={0} width={148} height={99} />
    <circle data-fulgur-cast-origin="" cx={99} cy={17} r={1} fill="transparent" />
    <g className="fulgur-hand-charge" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M94 13 97 17 101 15 104 19 107 16 M96 21 99 19 102 23 106 21 M100 11l2 4"
        stroke="#ffc440" strokeWidth="2" />
      <path d="M94 13 97 17 101 15 104 19 107 16" stroke="#fff5c5" strokeWidth=".8" />
    </g>
  </g>
);

const ZadkielOfDominations = () => (
  <g className="angel-hover" data-zadkiel-of-dominations="">
    <ProgressiveSvgImage href={zadkielArt} x={-4} y={-14} width={158} height={111} />
  </g>
);

const MageBorneAstra = () => (
  <ProgressiveSvgImage data-mage-borne-astra="" href={astraArt} x={36} y={-15} width={78} height={117} />
);

const CERVIEL_ART = { staff: cervielStaffArt, sword: cervielSwordArt };
const CervielForm = ({ form, size, action }: { form: keyof typeof CERVIEL_ART | 'bow'; size: HeroSize; action?: HeroAction | null | undefined }) => {
  const half = BODY_WIDTH[size] / 2;
  const isStaff = form === 'staff';
  const width = isStaff || form === 'sword' ? 104 : 87;
  const height = width * 1316 / 1195;
  const y = 97 - height;
  const left = half - width / 2;
  return (
    <g className="angel-hover" data-cerviel-form={form}>
      {form === 'bow' ? (
        <foreignObject x={left} y={y} width={width} height={height} pointerEvents="none">
          <div className="relative size-full">
            <ArcherSprite heroId="cervielBow" action={action ?? null} />
          </div>
        </foreignObject>
      ) : (
        <ProgressiveSvgImage href={form === 'sword' && action?.style === 'magic' ? cervielOpenArt : form === 'sword' && action?.style === 'support' ? cervielFistsArt : CERVIEL_ART[form]} x={left} y={y} width={width} height={height} />
      )}
    </g>
  );
};

const GrandangelCambiel = () => (
  <g className="angel-hover" data-grandangel-cambiel="">
    <ProgressiveSvgImage href={cambielArt} x={24} y={-7} width={102} height={103} />
  </g>
);

const GrandangelGeonosis = () => (
  <g className="angel-hover" data-grandangel-geonosis="">
    <ProgressiveSvgImage href={geonosisArt} x={17} y={-19} width={116} height={116} />
  </g>
);

const GrandangelRaziel = () => (
  <g className="angel-hover" data-grandangel-raziel="">
    <ProgressiveSvgImage href={razielArt} x={28} y={-20} width={94} height={117} />
  </g>
);

const ArchangelZeruel = () => (
  <ProgressiveSvgImage data-archangel-zeruel="" href={zeruelArt} x={24} y={-8} width={102} height={109} />
);

const BossSprite = ({ size, art, hover, inset = 0 }: {
  size: HeroSize; art: string; hover?: boolean; inset?: number;
}) => (
  <ProgressiveSvgImage href={art} x={0} y={inset / 2} width={BODY_WIDTH[size]} height={BODY_HEIGHT - inset}
    preserveAspectRatio="xMidYMax meet" className={hover ? 'angel-hover' : undefined} />
);

// --- CATALOG ---
/** Each creature's drawing. */
const CREATURE_DRAWINGS: Record<
  CreatureId,
  (props: { mood: HeroMood; size: HeroSize; action?: HeroAction | null }) => JSX.Element
> = {
  sloth: ({ size }) => <BossSprite size={size} art={slothArt} inset={10} />,
  pride: ({ size }) => <BossSprite size={size} art={prideArt} inset={2} />,
  lust: ({ size }) => <BossSprite size={size} art={lustArt} inset={1} hover />,
  gluttony: ({ size }) => <BossSprite size={size} art={gluttonyArt} inset={9} />,
  greed: ({ size }) => <BossSprite size={size} art={greedArt} inset={2} />,
  envy: ({ size }) => <BossSprite size={size} art={envyArt} inset={10} />,
  holyDragon: HolyDragon,
  angelAssassin: ({ size }) => <BossSprite size={size} art={angelAssassinArt} hover />,
  twinAxeKnight: ({ size }) => <BossSprite size={size} art={twinAxeArt} />,
  archangelUriel: UrielFigure,
  zeruelArmored: ({ size }) => <BossSprite size={size} art={zeruelArmoredArt} hover />,
  angelArcher: AngelArcher,
  grandGriffon: GrandGriffon,
  ballista: Ballista,
  ivoryWerewolf: IvoryWerewolf,
  wolfCentaur: WolfCentaur,
  angelMage: AngelMage,
  wingedArcher: WingedArcher,
  apollyonSeraph: ApollyonSeraph,
  lightLordMori: LightLordMori,
  mageBorneAzula: MageBorneAzula,
  grandangelCherubiel: GrandangelCherubiel,
  fulgurDragonknight: FulgurDragonknight,
  zadkielOfDominations: ZadkielOfDominations,
  grandangelCerviel: ({ size }) => <CervielForm form="staff" size={size} />,
  cervielSword: ({ size, action }) => <CervielForm form="sword" size={size} action={action} />,
  cervielBow: ({ size, action }) => <CervielForm form="bow" size={size} action={action} />,
  grandangelCambiel: GrandangelCambiel,
  grandangelGeonosis: GrandangelGeonosis,
  grandangelRaziel: GrandangelRaziel,
  archangelZeruel: ArchangelZeruel,
  zeruelRedSun: ({ size }) => <BossSprite size={size} art={alphaPlasmaArt} hover inset={14} />,
  zeruelBlueSun: ({ size }) => <BossSprite size={size} art={omegaPlasmaArt} hover inset={14} />,
  mageBorneAstra: MageBorneAstra,
  tempestWyrm: TempestWyrm,
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
      data-signature={action?.isSignature ? '' : undefined}
      data-two-handed={action?.isTwoHanded ? '' : undefined}
      aria-hidden="true"
    >
      <Drawing mood={mood} size={size} action={action} />
    </svg>
  );
};
