// ===================================================================
// TEMPEST WYRM FIGURE
// Tempest Wyrm Vael: a storm giant with a horned dragon's head, risen
// waist-deep out of a thunderhead on four tawny feathered wings. One
// claw hangs low toward the villain, the other holds a spear of
// lightning to the sky. Drawn in art units (1536 x 1024, see
// lib/creatureArt), flat and faceted like the other creatures: every
// part a lit plane on the left and its shadow on the right.
//
// It is built to feel huge: a small head on a wide chest, wings that
// run off both sides of the field, a near hand bigger than the head,
// and no feet (the storm hides where it ends). The spear and the upper
// wing tips rise past the top of the viewBox on purpose.
//
// It moves through the data hooks in index.css ("TEMPEST WYRM"):
//   idle         wings ride the wind, the chest heaves, the cloud
//                drifts and flashes, lightning crawls on the spear
//   every move   all four wings beat once
//   magic        the spear blazes and a bolt drops down it
//   signature    Sky Breaker: the same, held longer and brighter
//   death        the wings crumple and the lightning goes out
// The face takes the heroes' moods through its eyes and jaw.
// ===================================================================

import { useId } from 'react';
import type { HeroMood } from '../../../content/heroLooks';
import {
  art,
  ART_SCALE,
  mirrored,
  originAt,
  pts,
  type Point,
} from '../../../lib/creatureArt';
import { boneStrip, featherRow } from '../../../lib/featherWing';
import {
  type Tone,
  type Side,
  type WingSpec,
  type Bank,
  type LightIds,
  type CloudSpec,
  HIDE,
  PLATE,
  SCUTE,
  HORN,
  STEEL,
  BOLT,
  BOLT_EDGE,
  MAW,
  GLOOM,
  HEART_TONE,
  HEART_CRACK_WIDTH,
  ARC_WIDTH,
  CLOUD_FLASH_WIDTH,
  MID,
  GROUND,
  UPPER_WING,
  LOWER_WING,
  BONE_THICK,
  BONE_THIN,
  TORSO,
  PECTORAL,
  SCUTES,
  SCUTE_HEIGHT,
  SCUTE_DROP,
  SHOULDER_SPIKES,
  NECK,
  STORM_HEART,
  HEART_CRACKS,
  HEAD_SCALE,
  HEAD_PIVOT,
  SKULL,
  MUZZLE,
  BROW,
  NOSTRIL,
  JAW,
  JAW_DROP,
  EYES,
  HORN_HIGH,
  HORN_LOW,
  CHEEK_SPINE,
  CREST,
  NEAR_UPPER_ARM,
  ELBOW_SPUR,
  NEAR_FOREARM,
  NEAR_HAND,
  CLAWS,
  THUMB,
  FAR_UPPER_ARM,
  FAR_FOREARM,
  FIST,
  NEAR_ARM_SPLIT,
  FAR_ARM_SPLIT,
  SPEAR_BUTT,
  SPEAR_NECK,
  SHAFT_WIDTH,
  BLADE,
  BLADE_CORE,
  BARBS,
  GLOW_CENTRE,
  GLOW_RADIUS,
  ARCS,
  SKY_BOLT,
  GLOOM_CENTRE,
  GLOOM_REACH,
  CLOUDS,
  BANK_OUTLINE,
  BANK_TOP_POINTS,
  BANK_FOLD,
  CLOUD_FADE,
  CLOUD_FLASHES,
} from './tempestShapes';

// --- HELPERS ---
/** A bank's outline points placed in the art. */
const placeOn =
  ([x, y, half, thick]: Bank) =>
  ([along, across]: Point): Point => [x + along * half, y + across * thick];

/** A whole bank (drawn in its shadow tone). */
const bankOutline = (bank: Bank): Point[] => BANK_OUTLINE.map(placeOn(bank));

/** The lit plane across a bank's top. */
const bankTop = (bank: Bank): Point[] =>
  [...BANK_OUTLINE.slice(0, BANK_TOP_POINTS), ...BANK_FOLD].map(placeOn(bank));

/** A belly scute: a chevron plate, as its left half. */
const scuteHalf = ([top, half]: readonly [number, number]): Point[] => [
  [MID, top + SCUTE_DROP],
  [MID - half, top],
  [MID - half + 10, top + SCUTE_HEIGHT - SCUTE_DROP],
  [MID, top + SCUTE_HEIGHT],
];

/** Mirrors a shape for the right side, leaves it for the left. */
const onSide = (side: Side, points: readonly Point[]): readonly Point[] =>
  side === 'left' ? points : mirrored(points);

/** A straight strip between two points, `width` across. */
const strip = ([ax, ay]: Point, [bx, by]: Point, width: number): Point[] => {
  const length = Math.hypot(bx - ax, by - ay);
  const nx = ((by - ay) / length) * (width / 2);
  const ny = (-(bx - ax) / length) * (width / 2);
  return [
    [ax + nx, ay + ny],
    [bx + nx, by + ny],
    [bx - nx, by - ny],
    [ax - nx, ay - ny],
  ];
};

// --- SUBCOMPONENTS: SHARED ---
/** A symmetric part: the left half lit, its mirror in shadow. */
const Halves = ({ points, tone }: { points: readonly Point[]; tone: Tone }) => (
  <>
    <polygon points={pts(points)} fill={tone.lit} />
    <polygon points={pts(mirrored(points))} fill={tone.shade} />
  </>
);

/** One part cut by a vertical line: lit left of it, shadow right. */
const Split = ({
  points,
  tone,
  at,
}: {
  points: readonly Point[];
  tone: Tone;
  at: number;
}) => {
  const id = useId();
  const [edge] = art([at, 0]);
  return (
    <>
      <clipPath id={id}>
        <rect x={-400} y={-400} width={edge + 400} height={900} />
      </clipPath>
      <polygon points={pts(points)} fill={tone.shade} />
      <polygon points={pts(points)} fill={tone.lit} clipPath={`url(#${id})`} />
    </>
  );
};

// --- SUBCOMPONENTS: WINGS ---
/** One wing. The far (right) wing sits a step deeper in shadow. */
const Wing = ({ spec, side }: { spec: WingSpec; side: Side }) => {
  const isNear = side === 'left';
  const root = onSide(side, [spec.bone[0]!])[0]!;
  return (
    <g className={`${spec.name} tempest-wing-${side}`} style={originAt(root)}>
      {spec.rows.map(({ row, tone }, band) =>
        featherRow(spec.bone, row).map((feather, i) => (
          <g key={`${band}-${i}`}>
            <polygon
              points={pts(onSide(side, feather.leading))}
              fill={isNear ? tone.lit : tone.shade}
            />
            <polygon
              points={pts(onSide(side, feather.trailing))}
              fill={isNear ? tone.shade : tone.deep}
            />
          </g>
        ))
      )}
      <polygon
        points={pts(onSide(side, boneStrip(spec.bone, BONE_THICK, BONE_THIN)))}
        fill={isNear ? spec.arm.shade : spec.arm.deep}
      />
    </g>
  );
};

/** A pair of wings, the far one first so the near one overlaps it. */
const WingPair = ({ spec }: { spec: WingSpec }) => (
  <>
    <Wing spec={spec} side="right" />
    <Wing spec={spec} side="left" />
  </>
);

// --- SUBCOMPONENTS: BODY ---
/** The chest: hide, breast plates, belly scutes and the storm scar. */
const Torso = () => (
  <g className="tempest-chest">
    {SHOULDER_SPIKES.map((spike, i) => (
      <Halves key={i} points={spike} tone={PLATE} />
    ))}
    <Halves points={TORSO} tone={HIDE} />
    <Halves points={PECTORAL} tone={PLATE} />
    {SCUTES.map((scute) => (
      <Halves key={scute[0]} points={scuteHalf(scute)} tone={SCUTE} />
    ))}
    <g className="tempest-heart">
      {[...HEART_CRACKS, ...HEART_CRACKS.map(mirrored)].map((crack, i) => (
        <polyline
          key={i}
          points={pts(crack)}
          fill="none"
          stroke={BOLT_EDGE}
          strokeWidth={HEART_CRACK_WIDTH}
          strokeLinejoin="bevel"
        />
      ))}
      <Halves points={STORM_HEART} tone={HEART_TONE} />
    </g>
  </g>
);

/** The dragon's head: four horns, a crest, a long muzzle and its eyes. */
const Head = ({ mood }: { mood: HeroMood }) => {
  const [, jawDrop] = art([0, JAW_DROP[mood]]);
  const [pivotX, pivotY] = art(HEAD_PIVOT);
  return (
    <g
      className="tempest-head"
      transform={`translate(${pivotX} ${pivotY}) scale(${HEAD_SCALE}) translate(${-pivotX} ${-pivotY})`}
    >
      <Halves
        points={NECK}
        tone={{ ...HIDE, lit: HIDE.shade, shade: HIDE.deep }}
      />
      <Halves points={HORN_LOW} tone={HORN} />
      <Halves points={HORN_HIGH} tone={HORN} />
      <Halves points={CHEEK_SPINE} tone={PLATE} />
      {/* The open mouth sits behind the jaw, so it shows when it drops. */}
      <polygon points={pts([...JAW, ...mirrored(JAW).reverse()])} fill={MAW} />
      <g transform={`translate(0 ${jawDrop})`}>
        <Halves points={JAW} tone={HIDE} />
      </g>
      <Halves points={SKULL} tone={PLATE} />
      <Halves points={CREST} tone={HORN} />
      <Halves points={MUZZLE} tone={SCUTE} />
      <Halves
        points={BROW}
        tone={{ ...HIDE, lit: HIDE.deep, shade: HIDE.deep }}
      />
      <Halves points={NOSTRIL} tone={{ ...HIDE, lit: MAW, shade: MAW }} />
      <g className="tempest-eyes">
        <Halves
          points={EYES[mood]}
          tone={{ lit: BOLT, shade: BOLT, deep: BOLT }}
        />
      </g>
    </g>
  );
};

/** The near arm and its hanging claw. */
const NearArm = () => (
  <g className="tempest-near-arm" style={originAt(NEAR_UPPER_ARM[1]!)}>
    <polygon points={pts(ELBOW_SPUR)} fill={HORN.shade} />
    <Split points={NEAR_UPPER_ARM} tone={HIDE} at={NEAR_ARM_SPLIT + 30} />
    <Split points={NEAR_FOREARM} tone={PLATE} at={NEAR_ARM_SPLIT - 50} />
    <polygon points={pts(THUMB)} fill={HIDE.deep} />
    {CLAWS.map((claw, i) => (
      <Split key={i} points={claw} tone={HORN} at={claw[0]![0] + 12} />
    ))}
    <Split points={NEAR_HAND} tone={HIDE} at={NEAR_ARM_SPLIT - 115} />
  </g>
);

/** The far arm, raised (the fist is drawn over the spear's shaft). */
const FarArm = () => (
  <>
    <Split points={FAR_UPPER_ARM} tone={HIDE} at={FAR_ARM_SPLIT - 60} />
    <Split points={FAR_FOREARM} tone={PLATE} at={FAR_ARM_SPLIT} />
  </>
);

// --- SUBCOMPONENTS: SPEAR ---
/** The spear: steel shaft, barbs, and a blade of lightning that glows. */
const Spear = ({ glowId }: { glowId: string }) => {
  const [glowX, glowY] = art(GLOW_CENTRE);
  return (
    <g className="tempest-spear">
      <circle
        className="tempest-glow"
        cx={glowX}
        cy={glowY}
        r={GLOW_RADIUS * ART_SCALE}
        fill={`url(#${glowId})`}
      />
      <polygon
        points={pts(strip(SPEAR_BUTT, SPEAR_NECK, SHAFT_WIDTH))}
        fill={STEEL.deep}
      />
      <polygon
        points={pts(strip(SPEAR_BUTT, SPEAR_NECK, SHAFT_WIDTH / 3))}
        fill={STEEL.lit}
      />
      {BARBS.map((barb, i) => (
        <polygon
          key={i}
          points={pts(barb)}
          fill={i ? STEEL.shade : STEEL.lit}
        />
      ))}
      <polygon points={pts(BLADE)} fill={BOLT_EDGE} />
      <polygon points={pts(BLADE_CORE)} fill={BOLT} />
      <polygon className="tempest-skybolt" points={pts(SKY_BOLT)} fill={BOLT} />
    </g>
  );
};

/** Lightning crawling off the spear, each arc flickering in its turn. */
const Arcs = () => (
  <g className="tempest-arcs">
    {ARCS.map((arc, i) => (
      <polyline
        key={i}
        className="tempest-arc"
        points={pts(arc)}
        fill="none"
        stroke={i % 2 ? BOLT_EDGE : BOLT}
        strokeWidth={ARC_WIDTH}
        strokeLinejoin="bevel"
        style={{ animationDelay: `${i * -430}ms` }}
      />
    ))}
  </g>
);

// --- SUBCOMPONENTS: STORM ---
/** One row of the thunderhead: each bank in shadow, its top lit. */
const CloudLayer = ({ spec }: { spec: CloudSpec }) => (
  <g className={spec.name}>
    {spec.banks.map((bank) => (
      <g key={bank[0]}>
        <polygon points={pts(bankOutline(bank))} fill={spec.tone.shade} />
        <polygon points={pts(bankTop(bank))} fill={spec.tone.lit} />
      </g>
    ))}
  </g>
);

/** Lightning buried in the cloud. */
const CloudFlashes = () => (
  <>
    {CLOUD_FLASHES.map((flash, i) => (
      <polyline
        key={i}
        className="tempest-cloud-flash"
        points={pts(flash)}
        fill="none"
        stroke={BOLT}
        strokeWidth={CLOUD_FLASH_WIDTH}
        strokeLinejoin="bevel"
        style={{ animationDelay: `${i * -2600}ms` }}
      />
    ))}
  </>
);

/** Soft light (the storm's gloom, the blade's glow) and the cloud's fade. */
const Lights = ({ gloomId, glowId, fadeId }: LightIds) => (
  <defs>
    {/* Mask just the storm bank. Start above its lowest facets so no
        opaque polygon ends abruptly at the bottom of the sprite. */}
    <linearGradient id={`${fadeId}-ramp`} gradientUnits="userSpaceOnUse"
      x1={0} x2={0} y1={(GROUND - CLOUD_FADE) * ART_SCALE} y2={(GROUND + 44) * ART_SCALE}>
      <stop offset="0%" stopColor="white" />
      <stop offset="34%" stopColor="white" stopOpacity={0.85} />
      <stop offset="68%" stopColor="white" stopOpacity={0.22} />
      <stop offset="90%" stopColor="white" stopOpacity={0.025} />
      <stop offset="100%" stopColor="white" stopOpacity={0} />
    </linearGradient>
    <mask id={fadeId} maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }} x={-50} y={-50} width={300} height={200}>
      <rect x={-50} y={-50} width={300} height={200} fill={`url(#${fadeId}-ramp)`} />
    </mask>
    <radialGradient id={gloomId}>
      <stop offset="0%" stopColor={GLOOM} stopOpacity={0.9} />
      <stop offset="55%" stopColor={GLOOM} stopOpacity={0.7} />
      <stop offset="100%" stopColor={GLOOM} stopOpacity={0} />
    </radialGradient>
    <radialGradient id={glowId}>
      <stop offset="0%" stopColor={BOLT} stopOpacity={0.85} />
      <stop offset="30%" stopColor={BOLT_EDGE} stopOpacity={0.4} />
      <stop offset="100%" stopColor={BOLT_EDGE} stopOpacity={0} />
    </radialGradient>
  </defs>
);

// --- COMPONENT ---
/** Draws Tempest Wyrm Vael, back to front. */
export const TempestWyrm = ({ mood }: { mood: HeroMood }) => {
  const gloomId = useId();
  const glowId = useId();
  const [gloomX, gloomY] = art(GLOOM_CENTRE);
  const [gloomAcross, gloomUp] = art(GLOOM_REACH);
  const fadeId = useId();
  const [back, mid, front] = CLOUDS;
  return (
    <g className="tempest-wyrm">
      <Lights gloomId={gloomId} glowId={glowId} fadeId={fadeId} />
      <ellipse
        cx={gloomX}
        cy={gloomY}
        rx={gloomAcross}
        ry={gloomUp}
        fill={`url(#${gloomId})`}
      />
      <WingPair spec={LOWER_WING} />
      <WingPair spec={UPPER_WING} />
      <g className="tempest-body">
        <FarArm />
        <Spear glowId={glowId} />
        <Split points={FIST} tone={HIDE} at={FAR_ARM_SPLIT} />
        <Torso />
        <Head mood={mood} />
      </g>
      <g mask={`url(#${fadeId})`}>
        <CloudLayer spec={back!} />
        <CloudFlashes />
        <CloudLayer spec={mid!} />
        <CloudLayer spec={front!} />
      </g>
      <NearArm />
      <Arcs />
    </g>
  );
};
