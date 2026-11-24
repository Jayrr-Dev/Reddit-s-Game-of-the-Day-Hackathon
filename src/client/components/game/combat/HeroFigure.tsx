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

import { useId, type ReactNode } from 'react';
import type { HeroId } from '../../../../shared/game/heroes';
import type { HeroSize } from '../../../../shared/game/types';
import {
  ARMOR_STEEL,
  HERO_LOOKS,
  MAIL,
  type HeroActionStyle,
  type HeroLook,
  type Prop,
  type Tone,
} from '../../../content/heroLooks';
import {
  BODY_HEIGHT,
  BODY_WIDTH,
  headCentreOf,
  headRadiusOf,
} from '../../../lib/heroFigure';

// --- TYPES ---
export type HeroFigureProps = {
  heroId: HeroId;
  size: HeroSize;
  /** The attack playing right now, if any. */
  action?: HeroActionStyle | null;
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
const EYE_FILL = '#1a1014';
const FEET_Y = 96;
const LEATHER = '#3a2a26';
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
 * Both arms hanging from the shoulders; the right one ends at the hand
 * holding the prop. Mail sleeves for armoured heroes, cloth otherwise.
 */
const Arms = ({
  f,
  look,
  mail,
}: {
  f: Frame;
  look: HeroLook;
  mail: MailFills;
}) => {
  const isMail = look.armor !== 'cloth';
  const width = f.r * 0.6;
  const left: Point[] = [
    [f.mid - f.sw + 1, f.shoulderY + f.r * 0.3],
    [f.mid - f.sw - width, f.shoulderY + f.r * 0.7],
    [f.mid - f.sw - width * 0.8, f.hand[1] + 2],
    [f.mid - f.sw + width * 0.3, f.hand[1] + 2],
  ];
  return (
    <>
      <polygon
        points={pts(...left)}
        fill={isMail ? `url(#${mail.lit})` : look.robe.lit}
      />
      <polygon
        points={pts(...mirror(f.mid, left))}
        fill={isMail ? `url(#${mail.shade})` : look.robe.shade}
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

/** The face: a long, pointed-chin head, split lit and shadowed. */
const Head = ({ f, look }: { f: Frame; look: HeroLook }) => (
  <>
    <Halves
      mid={f.mid}
      fill={look.skin}
      left={[
        [f.mid, f.top],
        [f.mid - f.hw, f.top],
        [f.mid - f.hw, f.jaw],
        [f.mid, f.chin],
      ]}
    />
    {look.face === 'bare' ? (
      <>
        <rect
          x={f.mid - f.hw * 0.48}
          y={f.eyes - 1.4}
          width="1.4"
          height="3"
          fill={EYE_FILL}
        />
        <rect
          x={f.mid + f.hw * 0.48 - 1.4}
          y={f.eyes - 1.4}
          width="1.4"
          height="3"
          fill={EYE_FILL}
        />
      </>
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
  </>
);

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
            [f.mid - f.hw * 0.7, f.top - f.r * 0.25],
            [f.mid - f.hw * 0.9, f.top + f.r * 0.3],
            [f.mid, f.top + f.r * 0.3],
          ]}
        />
        <Halves
          mid={f.mid}
          fill={gear}
          left={[
            [f.mid, f.top + f.r * 0.2],
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
            [f.mid - f.hw * 0.85, f.top - f.r * 0.55],
            [f.mid - f.hw * 0.85, f.top + f.r * 0.3],
            [f.mid, f.top + f.r * 0.3],
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

const STEEL_LIT = '#d8d2d8';
const STEEL_SHADE = '#9c929e';
const WOOD = '#7a5131';
const WOOD_DARK = '#5a3a22';

/** A blade from the hand up to `length` units, `width` wide. */
const blade = ([x, y]: Point, length: number, width: number): ReactNode => (
  <>
    <polygon
      points={pts([x - width / 2, y - 3], [x, y - length], [x, y - 3])}
      fill={STEEL_LIT}
    />
    <polygon
      points={pts([x, y - 3], [x, y - length], [x + width / 2, y - 3])}
      fill={STEEL_SHADE}
    />
  </>
);

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
        {blade(h, 30 * k, 4 * k)}
        {hilt(h, 8 * k, accent)}
      </>
    ),
    tip: [h[0], h[1] - 30 * k],
  }),
  greatsword: (h, k, { accent }) => ({
    shape: (
      <>
        {blade(h, 44 * k, 6 * k)}
        {hilt(h, 12 * k, accent)}
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
  longbow: ([x, y], k, { accent }) => ({
    shape: (
      <>
        <path
          d={`M${x - 2 * k} ${y - 24 * k}Q${x + 10 * k} ${y} ${x - 2 * k} ${y + 24 * k}`}
          fill="none"
          stroke={WOOD}
          strokeWidth={2.4 * k}
          strokeLinecap="round"
        />
        <line
          className="hero-bowstring"
          x1={x - 2 * k}
          y1={y - 24 * k}
          x2={x - 2 * k}
          y2={y + 24 * k}
          stroke={accent}
          strokeWidth="0.7"
        />
      </>
    ),
    tip: [x + 4 * k, y],
  }),
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

// --- COMPONENT ---
/** Draws the hero, feet at the bottom edge, head near the top. */
export const HeroFigure = ({
  heroId,
  size,
  action = null,
}: HeroFigureProps) => {
  const look = HERO_LOOKS[heroId];
  const f = frameOf(size);
  const width = BODY_WIDTH[size];
  const k = f.r / headRadiusOf(1);
  const prop = PROPS[look.prop](f.hand, k, look);
  const gear = HEADGEAR[look.headgear](f, look);
  const [handX, handY] = f.hand;
  // Pattern ids must be unique per drawing and safe inside url(#...).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const mail: MailFills = { lit: `mail-lit-${uid}`, shade: `mail-${uid}` };
  const isArmored = look.armor !== 'cloth';
  return (
    <svg
      viewBox={`0 0 ${width} ${BODY_HEIGHT}`}
      className="h-full w-full overflow-visible"
      data-action={action ?? undefined}
      aria-hidden="true"
    >
      {/* SHADOW AND SUPPORT AURA */}
      <ellipse
        cx={f.mid}
        cy="97"
        rx={f.bw}
        ry="3"
        fill="black"
        opacity="0.45"
      />
      <ellipse
        className="hero-aura"
        cx={f.mid}
        cy="60"
        rx={f.bw * 1.1}
        ry="42"
        fill={look.accent}
        opacity="0"
      />
      {isArmored && <MailPatterns ids={mail} />}
      {look.cape && <Cape f={f} fill={look.cape} />}
      {gear.back}
      <Arms f={f} look={look} mail={mail} />
      <Body f={f} look={look} />
      {isArmored && <Coif f={f} mail={mail} />}
      {look.armor === 'plate' && <Pauldrons f={f} />}
      <Head f={f} look={look} />
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
      </g>
      {/* THE HAND HOLDING IT */}
      <circle cx={handX} cy={handY} r={f.r * 0.28} fill={look.skin.shade} />
    </svg>
  );
};
