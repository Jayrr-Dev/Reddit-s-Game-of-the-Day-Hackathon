// ===================================================================
// HERO FIGURE
// A hero standing on the battlefield, drawn flat and hard-edged: a few
// polygons per part, each face, robe and cape split down the middle into
// a lit half and a shadowed half, tiny line eyes, no outlines. Heroes are
// told apart by their headgear and the prop in their hand, then by their
// armour and cape (see content/heroLooks.ts). The knightly touches:
// mail drawn as a fine dotted texture (an SVG pattern), steel pauldrons,
// a leather belt with a buckle, and capes with torn, ragged hems. Wider heroes (elites, champions) are drawn
// broader, not just scaled, so a size 3 champion fills the front row.
//
// ATTACKS: `action` names the move being made (melee, range, magic or
// support). It is set as data-action on the drawing, and CSS in
// index.css animates the parts for it: the prop swings, draws, raises
// or lifts; magic flares the prop's tip; support pulses an aura.
// PERFORMANCE: static shapes; the animations touch transform and
// opacity only.
// ===================================================================

import { useId, type CSSProperties, type ReactNode } from 'react';
import { getHero, type HeroId } from '../../../../shared/game/heroes';
import type { HeroSize } from '../../../../shared/game/types';
import {
  ARMOR_STEEL,
  HERO_LOOKS,
  MAIL,
  type HeroAction,
  type HeroLook,
  type Prop,
  type Tone,
  type FaceFeatures,
  type HeroMood,
  type HumanoidId,
  isCreature,
} from '../../../content/heroLooks';
import {
  BODY_HEIGHT,
  BODY_WIDTH,
  headCentreOf,
  headRadiusOf,
} from '../../../lib/heroFigure';
import { CreatureFigure } from './CreatureFigure';
import { HeroFace } from './HeroFace';
import { HolyKingFigure } from './HolyKingFigure';
import { ArcherSprite } from './ArcherSprite';

// --- TYPES ---
export type HeroFigureProps = {
  heroId: HeroId;
  size: HeroSize;
  phase?: 2 | undefined;
  /** The attack playing right now, if any. */
  action?: HeroAction | null;
  /** How the hero feels right now (shown on a bare face). */
  mood?: HeroMood;
};

type Point = readonly [number, number];

/** The figure's key measurements, in viewBox units. */
type Frame = {
  mid: number;
  /** Head size unit (the old helmet radius). */
  r: number;
  /** Head: half width, top, jaw corner and chin point heights. */
  hw: number;
  top: number;
  eyes: number;
  jaw: number;
  chin: number;
  /** Shoulder and hem half widths, and the shoulder line. */
  sw: number;
  bw: number;
  shoulderY: number;
  /** Where the prop is held. */
  hand: Point;
};

// --- CONSTANTS ---
/** Features for a bare face that has none of its own. */
const DEFAULT_FEATURES: FaceFeatures = {
  eyes: 'round',
  brow: 'flat',
  mouth: 'line',
};
const EYE_FILL = '#1a1014';
const FEET_Y = 96;
const LEATHER = '#3a2a26';
/** How oversized the weapons are, against the hero's own scale. */
const WEAPON_SCALE = 1.35;
/** Mail ring spacing and dot radius (viewBox units). */
const MAIL_STEP = 1.25;
const MAIL_DOT = 0.36;
/** The ragged hem: how far each tear rises from the bottom (units). */
const HEM_TEARS = [2, 6, 1, 5, 0, 4] as const;

// --- HELPERS ---
/** Points as an SVG points string. */
const pts = (...points: readonly Point[]): string =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Mirrors points across the figure's centre line. */
const mirror = (mid: number, points: readonly Point[]): Point[] =>
  points.map(([x, y]) => [mid * 2 - x, y] as const);

/** The figure's measurements for a size. */
const frameOf = (size: HeroSize): Frame => {
  const width = BODY_WIDTH[size];
  const mid = width / 2;
  const r = headRadiusOf(size);
  const centre = headCentreOf(size);
  const sw = width * 0.36;
  const chin = centre + r * 1.15;
  return {
    mid,
    r,
    hw: r * 0.85,
    top: centre - r,
    eyes: centre,
    jaw: centre + r * 0.45,
    chin,
    sw,
    bw: width * 0.44,
    shoulderY: chin - r * 0.2,
    hand: [mid + sw * 1.02, 64],
  };
};

/**
 * Moves the hand for props held high: a bow is raised to the chest, so
 * the whole draw stays in view even on front-row heroes, whose lower
 * body sits below the battlefield's edge.
 */
const withGrip = (f: Frame, prop: Prop): Frame =>
  prop === 'longbow' ? { ...f, hand: [f.hand[0], f.shoulderY + f.r * 1.5] } : f;

// --- SUBCOMPONENTS: SHAPES ---
/**
 * A shape drawn as a lit left half and a shadowed right half: `left`
 * is the left half's outline; the right half is its mirror image.
 */
const Halves = ({
  mid,
  left,
  fill,
}: {
  mid: number;
  left: readonly Point[];
  fill: Tone;
}) => (
  <>
    <polygon points={pts(...left)} fill={fill.lit} />
    <polygon points={pts(...mirror(mid, left))} fill={fill.shade} />
  </>
);

/** Fill ids of the two mail patterns (lit and shaded) in one drawing. */
type MailFills = { lit: string; shade: string };

/** The mail patterns: rings dotted over a base, one lit and one shaded. */
const MailPatterns = ({ ids }: { ids: MailFills }) => (
  <defs>
    {(['lit', 'shade'] as const).map((side) => (
      <pattern
        key={side}
        id={ids[side]}
        width={MAIL_STEP}
        height={MAIL_STEP}
        patternUnits="userSpaceOnUse"
      >
        <rect width={MAIL_STEP} height={MAIL_STEP} fill={MAIL[side].base} />
        <circle
          cx={MAIL_STEP / 2}
          cy={MAIL_STEP / 2}
          r={MAIL_DOT}
          fill={MAIL[side].ring}
        />
      </pattern>
    ))}
  </defs>
);

/** A cape behind the body: wider than the robe, with a torn hem. */
const Cape = ({ f, fill }: { f: Frame; fill: Tone }) => {
  // TORN HEM: points from the outer edge back to the middle, each tear
  // rising a different amount so the edge reads as ragged cloth.
  const hem = HEM_TEARS.map(
    (rise, index) =>
      [
        f.mid - f.bw * 1.2 * (1 - (index + 1) / (HEM_TEARS.length + 1)),
        FEET_Y - rise,
      ] as const
  );
  return (
    <Halves
      mid={f.mid}
      fill={fill}
      left={[
        [f.mid, f.shoulderY],
        [f.mid - f.sw * 1.05, f.shoulderY + f.r * 0.3],
        [f.mid - f.bw * 1.22, FEET_Y - 3],
        ...hem,
        [f.mid, FEET_Y - 3],
      ]}
    />
  );
};

/**
 * How the arms hold the prop:
 *   one  the weapon hand grips it; the off hand rests at the hip
 *   two  the off hand reaches across to grip just below the weapon hand
 *   bow  the off hand draws the string (and pulls back on a shot)
 */
type Grip = 'one' | 'two' | 'bow';

/** The grip a hero uses, from its prop and look. */
const gripOf = (look: HeroLook): Grip =>
  look.prop === 'longbow' ? 'bow' : look.isTwoHanded ? 'two' : 'one';

/** One arm: a thick bent stroke from shoulder through elbow to hand. */
const Limb = ({
  points,
  width,
  fill,
}: {
  points: readonly Point[];
  width: number;
  fill: string;
}) => (
  <polyline
    points={pts(...points)}
    fill="none"
    stroke={fill}
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

/**
 * Both arms, as two jointed strokes. The weapon arm (right) always
 * ends at the hand holding the prop; the off arm (left) follows the
 * grip. Mail sleeves for armoured heroes, cloth otherwise. For a bow
 * the off forearm and hand sit in their own groups so CSS can draw
 * them back with the string (the forearm shortens about the elbow).
 */
const Arms = ({
  f,
  look,
  mail,
  k,
}: {
  f: Frame;
  look: HeroLook;
  mail: MailFills;
  k: number;
}) => {
  const isMail = look.armor !== 'cloth';
  const litFill = isMail ? `url(#${mail.lit})` : look.robe.lit;
  const shadeFill = isMail ? `url(#${mail.shade})` : look.robe.shade;
  const width = f.r * 0.55;
  const [handX, handY] = f.hand;
  const shoulderY = f.shoulderY + f.r * 0.45;
  const leftShoulder: Point = [f.mid - f.sw * 0.9, shoulderY];
  const rightShoulder: Point = [f.mid + f.sw * 0.9, shoulderY];
  const weaponArm: Point[] = [
    rightShoulder,
    [rightShoulder[0] + f.r * 0.3, (shoulderY + handY) / 2],
    [handX, handY],
  ];
  const grip = gripOf(look);
  const skin = look.skin.shade;
  const handR = f.r * 0.28;
  return (
    <>
      <Limb points={weaponArm} width={width} fill={shadeFill} />
      {grip === 'one' && (
        <>
          <Limb
            points={[
              leftShoulder,
              [leftShoulder[0] - f.r * 0.3, (shoulderY + 66) / 2],
              [leftShoulder[0] - f.r * 0.05, 66],
            ]}
            width={width}
            fill={litFill}
          />
          <circle
            cx={leftShoulder[0] - f.r * 0.05}
            cy={66}
            r={handR}
            fill={skin}
          />
        </>
      )}
      {grip === 'two' && (
        <>
          <Limb
            points={[
              leftShoulder,
              [f.mid - f.r * 0.2, (shoulderY + handY) / 2 + f.r * 0.6],
              [handX - f.r * 0.1, handY + f.r * 0.55],
            ]}
            width={width}
            fill={litFill}
          />
          <circle
            cx={handX - f.r * 0.1}
            cy={handY + f.r * 0.55}
            r={handR}
            fill={skin}
          />
        </>
      )}
      {grip === 'bow' && (
        <DrawArm
          shoulder={leftShoulder}
          elbow={[f.mid - f.r * 0.2, handY]}
          nock={[handX - 2 * k, handY]}
          width={width}
          fill={litFill}
          skin={skin}
          handR={handR}
          pull={8 * k}
        />
      )}
    </>
  );
};

/**
 * The bow's drawing arm: upper arm to an elbow level with the string,
 * then a forearm along the arrow to the hand on the nock. --draw-scale
 * is how short the forearm gets at full draw (pulling `pull` units).
 */
const DrawArm = ({
  shoulder,
  elbow,
  nock,
  width,
  fill,
  skin,
  handR,
  pull,
}: {
  shoulder: Point;
  elbow: Point;
  nock: Point;
  width: number;
  fill: string;
  skin: string;
  handR: number;
  pull: number;
}) => {
  const forearm = Math.max(1, nock[0] - elbow[0]);
  const drawScale = Math.max(0.2, (forearm - pull) / forearm);
  return (
    <>
      <Limb points={[shoulder, elbow]} width={width} fill={fill} />
      <g
        className="hero-draw-forearm"
        style={
          {
            transformOrigin: `${elbow[0]}px ${elbow[1]}px`,
            '--draw-scale': drawScale,
          } as CSSProperties
        }
      >
        <Limb points={[elbow, nock]} width={width} fill={fill} />
      </g>
      <circle
        className="hero-draw-hand"
        cx={nock[0]}
        cy={nock[1]}
        r={handR}
        fill={skin}
      />
    </>
  );
};

/** Shoulders and robe down to the feet, with a leather belt and buckle. */
const Body = ({ f, look }: { f: Frame; look: HeroLook }) => (
  <>
    <Halves
      mid={f.mid}
      fill={look.robe}
      left={[
        [f.mid, f.shoulderY - 1],
        [f.mid - f.sw, f.shoulderY + f.r * 0.35],
        [f.mid - f.bw, FEET_Y],
        [f.mid, FEET_Y],
      ]}
    />
    <polygon
      points={pts(
        [f.mid - f.sw * 1.02, 66],
        [f.mid + f.sw * 1.02, 66],
        [f.mid + f.sw * 1.03, 68.5],
        [f.mid - f.sw * 1.03, 68.5]
      )}
      fill={LEATHER}
    />
    <rect
      x={f.mid - f.r * 0.22}
      y={65.6}
      width={f.r * 0.44}
      height={3.3}
      fill={look.accent}
    />
  </>
);

/** A mail coif round the neck, up to the jaw (mail and plate only). */
const Coif = ({ f, mail }: { f: Frame; mail: MailFills }) => {
  const left: Point[] = [
    [f.mid, f.chin - f.r * 0.2],
    [f.mid - f.hw * 1.1, f.jaw - f.r * 0.1],
    [f.mid - f.hw * 1.7, f.shoulderY + f.r * 0.45],
    [f.mid, f.shoulderY + f.r * 0.7],
  ];
  return (
    <>
      <polygon points={pts(...left)} fill={`url(#${mail.lit})`} />
      <polygon
        points={pts(...mirror(f.mid, left))}
        fill={`url(#${mail.shade})`}
      />
    </>
  );
};

/** Steel plates capping both shoulders (plate armour only). */
const Pauldrons = ({ f }: { f: Frame }) => {
  const left: Point[] = [
    [f.mid - f.sw + f.r * 0.9, f.shoulderY + f.r * 0.15],
    [f.mid - f.sw - f.r * 0.2, f.shoulderY + f.r * 0.3],
    [f.mid - f.sw - f.r * 0.45, f.shoulderY + f.r * 0.9],
    [f.mid - f.sw - f.r * 0.15, f.shoulderY + f.r * 1.3],
    [f.mid - f.sw + f.r * 0.55, f.shoulderY + f.r * 1.0],
  ];
  return (
    <>
      <polygon points={pts(...left)} fill={ARMOR_STEEL.lit} />
      <polygon points={pts(...mirror(f.mid, left))} fill={ARMOR_STEEL.shade} />
    </>
  );
};

/**
 * The head: a long, pointed-chin face split lit and shadowed, with the
 * hero's features (see HeroFace) or a closed helm's visor slit.
 */
const Head = ({
  f,
  look,
  mood,
  serious,
}: {
  f: Frame;
  look: HeroLook;
  mood: HeroMood;
  serious: boolean;
}) => {
  // Keep the head polygon below the brim rather than overlapping its crown.
  const coveredTop = look.headgear === 'kettleHelm' ? .45 : look.headgear === 'mitre' ? .29 : look.headgear === 'featherCap' ? .28 : 0;
  const hairline = f.top + f.r * coveredTop;
  return (
  <g data-humanoid-head={look.headgear}>
    <Halves
      mid={f.mid}
      fill={look.skin}
      left={[
        [f.mid, hairline],
        [f.mid - f.hw * (coveredTop ? .94 : 1), hairline],
        [f.mid - f.hw, f.jaw],
        [f.mid, f.chin],
      ]}
    />
    {look.face === 'bare' ? (
      <HeroFace
        at={f}
        features={look.features ?? DEFAULT_FEATURES}
        mood={mood}
        serious={serious}
      />
    ) : (
      <>
        {/* CLOSED HELM: a visor slit and a breathing line */}
        <rect
          x={f.mid - f.hw * 0.75}
          y={f.eyes - 1}
          width={f.hw * 1.5}
          height="2"
          fill={EYE_FILL}
        />
        <rect
          x={f.mid - 0.5}
          y={f.eyes + 2}
          width="1"
          height={f.r * 0.6}
          fill={EYE_FILL}
          opacity="0.6"
        />
      </>
    )}
  </g>
  );
};

// --- SUBCOMPONENTS: HEADGEAR ---
/**
 * Headgear in two layers: `back` is drawn behind the head (hoods, hair,
 * veils, halos), `front` over it (helmets, hats, crowns).
 */
type Layers = { back?: ReactNode; front?: ReactNode };

/** Each kind of headgear, built from the frame and the hero's look. */
const HEADGEAR: Record<
  HeroLook['headgear'],
  (f: Frame, look: HeroLook) => Layers
> = {
  /** Squire: an open steel dome with a wide flat brim. */
  kettleHelm: (f, { gear }) => ({
    front: (
      <>
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top - f.r * 0.55],
            [f.mid - f.hw * 0.83, f.top - f.r * 0.28],
            [f.mid - f.hw * 1.09, f.top + f.r * 0.46],
            [f.mid, f.top + f.r * 0.46],
          ]}
        />
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top + f.r * 0.39],
            [f.mid - f.hw * 1.45, f.top + f.r * 0.35],
            [f.mid - f.hw * 1.35, f.top + f.r * 0.55],
            [f.mid, f.top + f.r * 0.5],
          ]}
        />
      </>
    ),
  }),
  /** Shieldmaiden: a hair cap with two long braids to the shoulders. */
  braids: (f, { gear }) => {
    const braid = (side: 1 | -1) => (
      <polygon
        points={pts(
          [f.mid + side * f.hw * 0.75, f.jaw - f.r * 0.3],
          [f.mid + side * f.hw * 1.3, f.jaw],
          [f.mid + side * f.hw * 1.25, f.shoulderY + f.r * 1.4],
          [f.mid + side * f.hw * 0.95, f.shoulderY + f.r * 1.7],
          [f.mid + side * f.hw * 0.85, f.jaw + f.r * 0.2]
        )}
        fill={side < 0 ? gear.lit : gear.shade}
      />
    );
    return {
      back: (
        <>
          {braid(-1)}
          {braid(1)}
        </>
      ),
      front: (
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top - f.r * 0.3],
            [f.mid - f.hw * 1.1, f.top + f.r * 0.05],
            [f.mid - f.hw * 1.05, f.top + f.r * 0.75],
            [f.mid - f.hw * 0.7, f.top + f.r * 0.35],
            [f.mid, f.top + f.r * 0.2],
          ]}
        />
      ),
    };
  },
  /** Archer: a hood rising to a point that flops to one side. */
  pointedHood: (f, { gear }) => ({
    back: (
      <>
        <polygon
          points={pts(
            [f.mid - f.hw * 1.3, f.shoulderY + 2],
            [f.mid - f.hw * 1.25, f.top],
            [f.mid + f.hw * 0.3, f.top - f.r * 1.2],
            [f.mid + f.hw * 1.6, f.top - f.r * 0.4],
            [f.mid + f.hw * 1.25, f.top + f.r * 0.1],
            [f.mid + f.hw * 1.3, f.shoulderY + 2]
          )}
          fill={gear.lit}
        />
        <polygon
          points={pts(
            [f.mid + f.hw * 0.3, f.top - f.r * 1.2],
            [f.mid + f.hw * 1.6, f.top - f.r * 0.4],
            [f.mid + f.hw * 1.25, f.top + f.r * 0.1],
            [f.mid + f.hw * 1.3, f.shoulderY + 2],
            [f.mid, f.shoulderY + 2],
            [f.mid, f.top - f.r * 0.6]
          )}
          fill={gear.shade}
        />
      </>
    ),
  }),
  /** Rogue: a low cowl and a mask over the lower face. */
  maskedHood: (f, { gear }) => ({
    back: (
      <Halves
        mid={f.mid}
        fill={gear}
        left={[
          [f.mid, f.top - f.r * 0.45],
          [f.mid - f.hw * 1.25, f.top - f.r * 0.05],
          [f.mid - f.hw * 1.4, f.shoulderY + 3],
          [f.mid, f.shoulderY + 3],
        ]}
      />
    ),
    front: (
      <Halves
        mid={f.mid}
        fill={gear}
        left={[
          [f.mid, f.eyes + f.r * 0.25],
          [f.mid - f.hw * 1.02, f.eyes + f.r * 0.15],
          [f.mid - f.hw * 1.02, f.jaw],
          [f.mid, f.chin + 0.5],
        ]}
      />
    ),
  }),
  /** Priest: a tall cloth mitre with a gold stripe. */
  mitre: (f, { gear, accent }) => ({
    front: (
      <>
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top - f.r * 1.45],
            [f.mid - f.hw * 1.04, f.top - f.r * 0.55],
            [f.mid - f.hw * 1.04, f.top + f.r * 0.39],
            [f.mid, f.top + f.r * 0.39],
          ]}
        />
        <rect
          x={f.mid - 1}
          y={f.top - f.r * 1.25}
          width="2"
          height={f.r * 1.5}
          fill={accent}
        />
      </>
    ),
  }),
  /** Bard: a floppy cap tipped to one side, with a long feather. */
  featherCap: (f, { gear, accent }) => ({
    front: (
      <>
        <polygon
          points={pts(
            [f.mid + f.hw * 0.4, f.top - f.r * 1.5],
            [f.mid + f.hw * 0.75, f.top - f.r * 1.4],
            [f.mid + f.hw * 0.2, f.top - f.r * 0.1],
            [f.mid, f.top - f.r * 0.1]
          )}
          fill={accent}
        />
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top - f.r * 0.55],
            [f.mid - f.hw * 1.5, f.top - f.r * 0.05],
            [f.mid - f.hw * 1.2, f.top + f.r * 0.35],
            [f.mid, f.top + f.r * 0.25],
          ]}
        />
      </>
    ),
  }),
  /** Paladin: a closed great helm under a tall red crest. */
  greatHelm: (f, { gear, accent }) => ({
    front: (
      <>
        <polygon
          points={pts(
            [f.mid - f.r * 0.25, f.top + 0.5],
            [f.mid - f.r * 0.45, f.top - f.r * 0.9],
            [f.mid + f.r * 0.9, f.top - f.r * 1.3],
            [f.mid + f.r * 0.35, f.top + 0.5]
          )}
          fill={accent}
        />
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top - f.r * 0.15],
            [f.mid - f.hw * 1.08, f.top],
            [f.mid - f.hw * 1.08, f.top + f.r * 0.45],
            [f.mid, f.top + f.r * 0.45],
          ]}
        />
      </>
    ),
  }),
  /** Archmage: a wide brim under a tall cone that bends at the tip. */
  wizardHat: (f, { gear, accent }) => ({
    front: (
      <>
        <polygon
          points={pts(
            [f.mid - f.hw * 0.8, f.top + f.r * 0.1],
            [f.mid - f.hw * 0.1, f.top - f.r * 1.5],
            [f.mid + f.hw * 0.9, f.top - f.r * 1.9],
            [f.mid + f.hw * 0.35, f.top - f.r * 1.25],
            [f.mid + f.hw * 0.8, f.top + f.r * 0.1]
          )}
          fill={gear.lit}
        />
        <polygon
          points={pts(
            [f.mid - f.hw * 0.1, f.top - f.r * 1.5],
            [f.mid + f.hw * 0.35, f.top - f.r * 1.25],
            [f.mid + f.hw * 0.8, f.top + f.r * 0.1],
            [f.mid, f.top + f.r * 0.1]
          )}
          fill={gear.shade}
        />
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top - f.r * 0.05],
            [f.mid - f.hw * 1.8, f.top + f.r * 0.25],
            [f.mid - f.hw * 1.6, f.top + f.r * 0.45],
            [f.mid, f.top + f.r * 0.35],
          ]}
        />
        <circle
          cx={f.mid + f.hw * 0.05}
          cy={f.top - f.r * 0.3}
          r={f.r * 0.14}
          fill={accent}
        />
      </>
    ),
  }),
  /** Holt: an open steel helm with a tall comb and up-swept brim. */
  combHelm: (f, { gear }) => ({
    front: (
      <>
        <polygon
          points={pts(
            [f.mid - f.hw * 0.55, f.top - f.r * 0.35],
            [f.mid - f.hw * 0.2, f.top - f.r * 1.05],
            [f.mid + f.hw * 0.35, f.top - f.r * 1.05],
            [f.mid + f.hw * 0.6, f.top - f.r * 0.35]
          )}
          fill={gear.shade}
        />
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top - f.r * 0.5],
            [f.mid - f.hw * 0.85, f.top - f.r * 0.15],
            [f.mid - f.hw * 1.65, f.top - f.r * 0.2],
            [f.mid - f.hw * 1.1, f.top + f.r * 0.35],
            [f.mid, f.top + f.r * 0.3],
          ]}
        />
      </>
    ),
  }),
  /** Lysa: long hair down the back, and a circlet of leaves. */
  leafCirclet: (f, { gear, accent }) => ({
    back: (
      <Halves
        mid={f.mid}
        fill={gear}
        left={[
          [f.mid, f.top - f.r * 0.3],
          [f.mid - f.hw * 1.15, f.top - f.r * 0.1],
          [f.mid - f.hw * 1.5, f.shoulderY + f.r * 1.2],
          [f.mid - f.hw * 0.6, f.shoulderY + f.r * 0.6],
          [f.mid, f.shoulderY],
        ]}
      />
    ),
    front: (
      <>
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top - f.r * 0.3],
            [f.mid - f.hw * 1.1, f.top - f.r * 0.05],
            [f.mid - f.hw * 1.0, f.top + f.r * 0.4],
            [f.mid, f.top + f.r * 0.1],
          ]}
        />
        {[-0.7, -0.25, 0.25, 0.7].map((at) => (
          <polygon
            key={at}
            points={pts(
              [f.mid + f.hw * at - f.r * 0.15, f.top + f.r * 0.05],
              [f.mid + f.hw * at, f.top - f.r * 0.45],
              [f.mid + f.hw * at + f.r * 0.15, f.top + f.r * 0.05]
            )}
            fill={accent}
          />
        ))}
      </>
    ),
  }),
  /** Maren: a white veil to the shoulders under a tall gold halo. */
  veilHalo: (f, { gear, accent }) => ({
    back: (
      <>
        <circle
          cx={f.mid}
          cy={f.top - f.r * 0.1}
          r={f.r * 1.35}
          fill="none"
          stroke={accent}
          strokeWidth={f.r * 0.18}
        />
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top - f.r * 0.4],
            [f.mid - f.hw * 1.2, f.top - f.r * 0.1],
            [f.mid - f.hw * 1.45, f.shoulderY + f.r * 0.9],
            [f.mid, f.shoulderY + f.r * 0.9],
          ]}
        />
      </>
    ),
    front: (
      <Halves
        mid={f.mid}
        fill={gear}
        left={[
          [f.mid, f.top - f.r * 0.4],
          [f.mid - f.hw * 1.1, f.top - f.r * 0.1],
          [f.mid - f.hw * 1.05, f.top + f.r * 0.25],
          [f.mid, f.top + f.r * 0.2],
        ]}
      />
    ),
  }),
  /** Brannoc: a closed bucket helm with two great curved horns. */
  hornedHelm: (f, { gear }) => {
    const horn = (side: 1 | -1) => (
      <polygon
        points={pts(
          [f.mid + side * f.hw * 0.9, f.top + f.r * 0.15],
          [f.mid + side * f.hw * 1.7, f.top - f.r * 0.1],
          [f.mid + side * f.hw * 1.9, f.top - f.r * 1.1],
          [f.mid + side * f.hw * 1.45, f.top - f.r * 0.35],
          [f.mid + side * f.hw * 0.9, f.top - f.r * 0.2]
        )}
        fill={side < 0 ? gear.lit : gear.shade}
      />
    );
    return {
      back: (
        <>
          {horn(-1)}
          {horn(1)}
        </>
      ),
    };
  },
  /** Seris: a high ponytail and a slim tiara with a jewel. */
  ponytailTiara: (f, { gear, accent }) => ({
    back: (
      <polygon
        points={pts(
          [f.mid + f.hw * 0.2, f.top - f.r * 0.2],
          [f.mid + f.hw * 0.7, f.top - f.r * 0.9],
          [f.mid + f.hw * 1.9, f.top + f.r * 0.2],
          [f.mid + f.hw * 1.7, f.shoulderY + f.r * 0.6],
          [f.mid + f.hw * 1.0, f.top + f.r * 0.6]
        )}
        fill={gear.shade}
      />
    ),
    front: (
      <>
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top - f.r * 0.25],
            [f.mid - f.hw * 1.08, f.top],
            [f.mid - f.hw * 1.05, f.top + f.r * 0.6],
            [f.mid - f.hw * 0.6, f.top + f.r * 0.25],
            [f.mid, f.top + f.r * 0.15],
          ]}
        />
        <polygon
          points={pts(
            [f.mid - f.hw * 0.75, f.top + f.r * 0.05],
            [f.mid, f.top - f.r * 0.55],
            [f.mid + f.hw * 0.75, f.top + f.r * 0.05]
          )}
          fill="none"
          stroke={accent}
          strokeWidth="1.2"
        />
        <circle
          cx={f.mid}
          cy={f.top - f.r * 0.4}
          r={f.r * 0.13}
          fill={accent}
        />
      </>
    ),
  }),
  /** Valen: a gold crown of sun rays before a pale halo. */
  sunCrown: (f, { gear, accent }) => ({
    back: (
      <circle
        cx={f.mid}
        cy={f.top + f.r * 0.1}
        r={f.r * 1.6}
        fill={accent}
        opacity="0.35"
      />
    ),
    front: (
      <>
        {[-0.8, -0.4, 0, 0.4, 0.8].map((at) => (
          <polygon
            key={at}
            points={pts(
              [f.mid + f.hw * at - f.r * 0.2, f.top + f.r * 0.1],
              [
                f.mid + f.hw * at * 1.5,
                f.top - f.r * (0.9 - Math.abs(at) * 0.3),
              ],
              [f.mid + f.hw * at + f.r * 0.2, f.top + f.r * 0.1]
            )}
            fill={at < 0 ? gear.lit : gear.shade}
          />
        ))}
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top],
            [f.mid - f.hw * 1.05, f.top],
            [f.mid - f.hw * 1.05, f.top + f.r * 0.3],
            [f.mid, f.top + f.r * 0.3],
          ]}
        />
      </>
    ),
  }),
};

// --- SUBCOMPONENTS: PROPS ---
/** A prop's drawing and the tip a spell flares from. */
type PropDrawing = { shape: ReactNode; tip: Point };

const STEEL_LIT = '#c4bcc5';
const STEEL_SHADE = '#8e8491';
const WOOD = '#7a5131';
const FULLER = '#5f5662';
const WOOD_DARK = '#5a3a22';

/** A blade from the hand up to `length` units, `width` wide. */
const blade = ([x, y]: Point, length: number, width: number): ReactNode => {
  // A slab: straight parallel edges, then a short point, so a wide
  // blade reads as heavy iron rather than a needle.
  const shoulder = y - length + width * 0.9;
  return (
    <>
      <polygon
        points={pts(
          [x - width / 2, y - 3],
          [x - width / 2, shoulder],
          [x, y - length],
          [x, y - 3]
        )}
        fill={STEEL_LIT}
      />
      <polygon
        points={pts(
          [x, y - 3],
          [x, y - length],
          [x + width / 2, shoulder],
          [x + width / 2, y - 3]
        )}
        fill={STEEL_SHADE}
      />
      {/* FULLER: a dark groove down the middle of a broad blade */}
      {width > 5 && (
        <rect
          x={x - width * 0.07}
          y={shoulder + width * 0.4}
          width={width * 0.14}
          height={y - 3 - shoulder - width * 0.6}
          fill={FULLER}
        />
      )}
    </>
  );
};

/** A crossguard and grip under a blade. */
const hilt = ([x, y]: Point, width: number, accent: string): ReactNode => (
  <>
    <rect x={x - width / 2} y={y - 4} width={width} height="2" fill={accent} />
    <rect x={x - 0.8} y={y - 2} width="1.6" height="6" fill={WOOD_DARK} />
  </>
);

/** A pole from the hand up to `length` units. */
const pole = ([x, y]: Point, length: number): ReactNode => (
  <rect
    x={x - 0.9}
    y={y - length}
    width="1.8"
    height={length + 8}
    fill={WOOD}
  />
);

/** Each prop, drawn at the hand `h`, scaled by the head size `k`. */
const PROPS: Record<
  Prop,
  (h: Point, k: number, look: HeroLook) => PropDrawing
> = {
  sword: (h, k, { accent }) => ({
    shape: (
      <>
        {blade(h, 30 * k, 6 * k)}
        {hilt(h, 10 * k, accent)}
      </>
    ),
    tip: [h[0], h[1] - 30 * k],
  }),
  greatsword: (h, k, { accent }) => ({
    shape: (
      <>
        {blade(h, 46 * k, 10 * k)}
        {hilt(h, 15 * k, accent)}
      </>
    ),
    tip: [h[0], h[1] - 44 * k],
  }),
  rapier: (h, k, { accent }) => ({
    shape: (
      <>
        {blade(h, 38 * k, 2.2 * k)}
        <circle
          cx={h[0]}
          cy={h[1] - 3}
          r={2.6 * k}
          fill="none"
          stroke={accent}
          strokeWidth="1"
        />
        {hilt(h, 5 * k, accent)}
      </>
    ),
    tip: [h[0], h[1] - 38 * k],
  }),
  daggers: ([x, y], k, { accent }) => ({
    shape: (
      <>
        {blade([x, y], 14 * k, 3.4 * k)}
        {hilt([x, y], 5 * k, accent)}
        {blade([x - 6 * k, y + 4], 12 * k, 3 * k)}
        {hilt([x - 6 * k, y + 4], 4 * k, accent)}
      </>
    ),
    tip: [x, y - 14 * k],
  }),
  /** A kite shield in the hero's colours with a chevron sigil. */
  kiteShield: ([x, y], k, { accent, robe }) => {
    // Held on the far side, across the body.
    const cx = x - 4 * k;
    const half: Point[] = [
      [cx, y - 16 * k],
      [cx - 9 * k, y - 16 * k],
      [cx - 9 * k, y - 2 * k],
      [cx, y + 12 * k],
    ];
    const rim = 1.4 * k;
    return {
      shape: (
        <>
          {/* STEEL RIM, THEN THE PAINTED FIELD INSIDE IT */}
          <polygon points={pts(...half)} fill={STEEL_LIT} />
          <polygon points={pts(...mirror(cx, half))} fill={STEEL_SHADE} />
          <polygon
            points={pts(
              [cx, y - 16 * k + rim],
              [cx - 9 * k + rim, y - 16 * k + rim],
              [cx - 9 * k + rim, y - 2 * k],
              [cx, y + 12 * k - rim * 1.6]
            )}
            fill={robe.lit}
          />
          <polygon
            points={pts(
              [cx, y - 16 * k + rim],
              [cx + 9 * k - rim, y - 16 * k + rim],
              [cx + 9 * k - rim, y - 2 * k],
              [cx, y + 12 * k - rim * 1.6]
            )}
            fill={robe.shade}
          />
          {/* SIGIL: an upturned chevron */}
          <polyline
            points={pts(
              [cx - 5 * k, y - 9 * k],
              [cx, y - 3 * k],
              [cx + 5 * k, y - 9 * k]
            )}
            fill="none"
            stroke={accent}
            strokeWidth={2 * k}
            strokeLinejoin="round"
          />
        </>
      ),
      tip: [cx, y - 16 * k],
    };
  },
  /**
   * A longbow with its string in two halves, each pivoting on its own
   * bow tip: turning them in opposite directions pulls the middle back
   * into a V (a drawn string) with transforms alone. The arrow sits on
   * the string, hidden until a shot draws it back and looses it.
   */
  longbow: ([x, y], k, { accent }) => {
    const tipX = x - 2 * k;
    const top = y - 24 * k;
    const bottom = y + 24 * k;
    return {
      shape: (
        <>
          <path
            className="hero-bow"
            style={{ transformOrigin: `${x + 4 * k}px ${y}px` }}
            d={`M${tipX} ${top}Q${x + 10 * k} ${y} ${tipX} ${bottom}`}
            fill="none"
            stroke={WOOD}
            strokeWidth={2.4 * k}
            strokeLinecap="round"
          />
          <line
            className="hero-string-top"
            style={{ transformOrigin: `${tipX}px ${top}px` }}
            x1={tipX}
            y1={top}
            x2={tipX}
            y2={y}
            stroke={accent}
            strokeWidth="0.7"
          />
          <line
            className="hero-string-bottom"
            style={{ transformOrigin: `${tipX}px ${bottom}px` }}
            x1={tipX}
            y1={y}
            x2={tipX}
            y2={bottom}
            stroke={accent}
            strokeWidth="0.7"
          />
          {/* THE ARROW: shaft from the nock, head forward, fletching back */}
          <g className="hero-arrow" opacity="0">
            <line
              x1={tipX}
              y1={y}
              x2={x + 14 * k}
              y2={y}
              stroke={WOOD_DARK}
              strokeWidth={1.1 * k}
            />
            <polygon
              points={pts(
                [x + 17 * k, y],
                [x + 13 * k, y - 1.8 * k],
                [x + 13 * k, y + 1.8 * k]
              )}
              fill={STEEL_LIT}
            />
            <polygon
              points={pts(
                [tipX, y],
                [tipX + 4 * k, y],
                [tipX + 1.5 * k, y - 2 * k],
                [tipX - 1 * k, y - 2 * k]
              )}
              fill={accent}
            />
          </g>
        </>
      ),
      tip: [x + 4 * k, y],
    };
  },
  holyStaff: ([x, y], k, { accent }) => ({
    shape: (
      <>
        {pole([x, y], 34 * k)}
        <circle cx={x} cy={y - 36 * k} r={4.5 * k} fill={accent} />
        <rect
          x={x - 6 * k}
          y={y - 36.8 * k}
          width={12 * k}
          height={1.6 * k}
          fill={accent}
        />
      </>
    ),
    tip: [x, y - 36 * k],
  }),
  orbStaff: ([x, y], k, { accent }) => ({
    shape: (
      <>
        {pole([x, y], 38 * k)}
        <polygon
          points={pts(
            [x - 3 * k, y - 38 * k],
            [x, y - 46 * k],
            [x + 3 * k, y - 38 * k]
          )}
          fill={WOOD_DARK}
        />
        <circle cx={x} cy={y - 42 * k} r={3.6 * k} fill={accent} />
      </>
    ),
    tip: [x, y - 42 * k],
  }),
  crescentStaff: ([x, y], k, { accent }) => ({
    shape: (
      <>
        {pole([x, y], 38 * k)}
        <path
          d={`M${x - 6 * k} ${y - 44 * k}A${6 * k} ${6 * k} 0 0 0 ${x + 6 * k} ${y - 44 * k}A${4.5 * k} ${4.5 * k} 0 0 1 ${x - 6 * k} ${y - 44 * k}Z`}
          fill={accent}
        />
      </>
    ),
    tip: [x, y - 42 * k],
  }),
  lute: ([x, y], k, { accent }) => ({
    shape: (
      <>
        <rect
          x={x - 1}
          y={y - 22 * k}
          width="2"
          height={16 * k}
          fill={WOOD_DARK}
        />
        <polygon
          points={pts(
            [x - 2.5 * k, y - 24 * k],
            [x + 2.5 * k, y - 24 * k],
            [x + 1.5 * k, y - 20 * k],
            [x - 1.5 * k, y - 20 * k]
          )}
          fill={WOOD_DARK}
        />
        <ellipse cx={x} cy={y} rx={7 * k} ry={8.5 * k} fill={WOOD} />
        <circle cx={x} cy={y - 1 * k} r={2 * k} fill={WOOD_DARK} />
        <rect
          x={x - 3 * k}
          y={y + 4 * k}
          width={6 * k}
          height="1.2"
          fill={accent}
        />
      </>
    ),
    tip: [x, y - 22 * k],
  }),
  halberd: ([x, y], k) => ({
    shape: (
      <>
        {pole([x, y], 46 * k)}
        <polygon
          points={pts(
            [x, y - 44 * k],
            [x + 8 * k, y - 40 * k],
            [x + 8 * k, y - 32 * k],
            [x, y - 34 * k]
          )}
          fill={STEEL_SHADE}
        />
        <polygon
          points={pts(
            [x, y - 44 * k],
            [x - 4 * k, y - 38 * k],
            [x, y - 36 * k]
          )}
          fill={STEEL_LIT}
        />
        <polygon
          points={pts(
            [x - 1, y - 44 * k],
            [x, y - 54 * k],
            [x + 1, y - 44 * k]
          )}
          fill={STEEL_LIT}
        />
      </>
    ),
    tip: [x, y - 54 * k],
  }),
  warhammer: ([x, y], k, { accent }) => ({
    shape: (
      <>
        {pole([x, y], 32 * k)}
        <polygon
          points={pts(
            [x - 7 * k, y - 38 * k],
            [x, y - 38 * k],
            [x, y - 28 * k],
            [x - 7 * k, y - 28 * k]
          )}
          fill={STEEL_LIT}
        />
        <polygon
          points={pts(
            [x, y - 38 * k],
            [x + 7 * k, y - 38 * k],
            [x + 7 * k, y - 28 * k],
            [x, y - 28 * k]
          )}
          fill={STEEL_SHADE}
        />
        <rect
          x={x - 7 * k}
          y={y - 34 * k}
          width={14 * k}
          height={1.6 * k}
          fill={accent}
        />
      </>
    ),
    tip: [x, y - 33 * k],
  }),
};

/** The forward cut's streak, from the top right down to the left. */
const swipeLeft = (f: Frame): Point[] => [
  [f.mid + f.sw * 1.3, f.shoulderY - f.r * 0.6],
  [f.mid + f.sw * 1.1, f.shoulderY - f.r * 1.0],
  [f.mid - f.sw * 1.4, 78],
  [f.mid - f.sw * 1.25, 80],
];

// --- SUBCOMPONENTS: SPELL EFFECTS ---
/** Where the sparks start, around the tip (share of the head size). */
const SPARK_STARTS: readonly Point[] = [
  [-2.2, -1.2],
  [2.2, -1.6],
  [-1.8, 2],
  [2, 1.6],
  [0, -2.6],
];

/**
 * Drawn at a prop's tip, hidden until a spell is cast: a spinning rune
 * ring that opens out, sparks that gather into the tip, and a burst
 * that leaves it. Each spark carries its start offset as --sx / --sy
 * (viewBox units) for the gather keyframes in index.css.
 */
const CastEffects = ({
  at: [x, y],
  r,
  accent,
}: {
  at: Point;
  r: number;
  accent: string;
}) => (
  <>
    <g className="hero-rune" opacity="0">
      <circle
        cx={x}
        cy={y}
        r={r * 1.1}
        fill="none"
        stroke={accent}
        strokeWidth="0.9"
        strokeDasharray="3 1.5"
      />
      <polygon
        points={pts(
          [x, y - r * 1.1],
          [x + r * 0.95, y + r * 0.55],
          [x - r * 0.95, y + r * 0.55]
        )}
        fill="none"
        stroke={accent}
        strokeWidth="0.6"
      />
    </g>
    {SPARK_STARTS.map(([dx, dy], index) => (
      <polygon
        key={index}
        className="hero-spark"
        style={
          {
            '--sx': `${dx * r}px`,
            '--sy': `${dy * r}px`,
            animationDelay: `${index * 25}ms`,
          } as CSSProperties
        }
        points={pts(
          [x, y - r * 0.3],
          [x + r * 0.15, y],
          [x, y + r * 0.3],
          [x - r * 0.15, y]
        )}
        fill="white"
        opacity="0"
      />
    ))}
    <circle
      className="hero-burst"
      cx={x}
      cy={y}
      r={r * 0.8}
      fill="none"
      stroke="white"
      strokeWidth="1.4"
      opacity="0"
    />
  </>
);

// --- SUBCOMPONENTS: FIGURE ---
/** Draws a humanoid hero, feet at the bottom edge, head near the top. */
const HumanoidFigure = ({
  heroId,
  size,
  action = null,
  mood = 'calm',
}: HeroFigureProps & { heroId: HumanoidId }) => {
  const look = HERO_LOOKS[heroId];
  const f = withGrip(frameOf(size), look.prop);
  const width = BODY_WIDTH[size];
  // Weapons are drawn oversized and heavy, well past the body's scale.
  const k = (f.r / headRadiusOf(1)) * WEAPON_SCALE;
  const prop = PROPS[look.prop](f.hand, k, look);
  const gear = HEADGEAR[look.headgear](f, look);
  const [handX, handY] = f.hand;
  // --k lets the CSS animations move parts by the prop's own scale.
  const scaleVar = { '--k': k } as CSSProperties;
  // Pattern ids must be unique per drawing and safe inside url(#...).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const mail: MailFills = { lit: `mail-lit-${uid}`, shade: `mail-${uid}` };
  const isArmored = look.armor !== 'cloth';
  return (
    <svg
      viewBox={`0 0 ${width} ${BODY_HEIGHT}`}
      className="h-full w-full overflow-visible"
      data-action={action?.style}
      data-swing={action?.style === 'melee' ? action.swing : undefined}
      style={scaleVar}
      aria-hidden="true"
    >
      {/* SUPPORT AURA (the ground shadow is drawn by HeroOnField, so it
          stays put while the body sways and lunges) */}
      <ellipse
        className="hero-aura"
        cx={f.mid}
        cy="60"
        rx={f.bw * 1.1}
        ry="42"
        fill={look.accent}
        opacity="0"
      />
      {/* MAGIC: a rune circle flashes on the ground as the spell goes */}
      <ellipse
        className="hero-floor-sigil"
        cx={f.mid}
        cy={FEET_Y}
        rx={f.bw * 1.15}
        ry={f.bw * 0.22}
        fill="none"
        stroke={look.accent}
        strokeWidth="1.2"
        strokeDasharray="4 2"
        opacity="0"
      />
      {isArmored && <MailPatterns ids={mail} />}
      {look.cape && <Cape f={f} fill={look.cape} />}
      {gear.back}
      <Body f={f} look={look} />
      {isArmored && <Coif f={f} mail={mail} />}
      <Arms f={f} look={look} mail={mail} k={k} />
      {look.armor === 'plate' && <Pauldrons f={f} />}
      <Head f={f} look={look} mood={mood} serious={getHero(heroId).tier === 'grunt'} />
      {gear.front}
      {/* THE PROP SWINGS, DRAWS OR RISES AROUND THE HAND */}
      <g
        className="hero-prop"
        style={{ transformOrigin: `${handX}px ${handY}px` }}
      >
        {prop.shape}
        <circle
          className="hero-glow"
          cx={prop.tip[0]}
          cy={prop.tip[1]}
          r={f.r * 0.9}
          fill={look.accent}
          opacity="0"
        />
        <CastEffects at={prop.tip} r={f.r} accent={look.accent} />
      </g>
      {/* FORWARD CUTS: a streak across the body where the blade passes
          (top right to bottom left, and its mirror) */}
      <polygon
        className="hero-swipe"
        points={pts(...swipeLeft(f))}
        fill="white"
        opacity="0"
      />
      <polygon
        className="hero-swipe-right"
        points={pts(...mirror(f.mid, swipeLeft(f)))}
        fill="white"
        opacity="0"
      />
      {/* THE HAND HOLDING IT */}
      <circle cx={handX} cy={handY} r={f.r * 0.28} fill={look.skin.shade} />
    </svg>
  );
};

// --- COMPONENT ---
/**
 * Draws any hero: creatures (see CREATURE_IDS) have drawings of their
 * own; everyone else uses the shared humanoid figure.
 */
export const HeroFigure = (props: HeroFigureProps) => {
  const { heroId } = props;
  if (heroId === 'archer' || heroId === 'lysa' || heroId === 'wingedArcher') {
    return <div className="relative size-full"><ArcherSprite heroId={heroId} action={props.action ?? null} /></div>;
  }
  if (heroId === 'holyKing') return <HolyKingFigure {...props} />;
  return isCreature(heroId) ? (
    <CreatureFigure {...props} heroId={heroId} />
  ) : (
    <HumanoidFigure {...props} heroId={heroId} />
  );
};
