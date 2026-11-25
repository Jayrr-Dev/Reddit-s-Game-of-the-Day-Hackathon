// ===================================================================
// TEMPEST WYRM SHAPES
// Everything Tempest Wyrm Vael is made of: its palette, and each part
// traced in art units (1536 x 1024, see lib/creatureArt). Symmetric
// parts are traced on the left and mirrored by the drawing
// (TempestFigure), which also explains the pose and the motion.
// ===================================================================

import type { HeroMood } from '../../../content/heroLooks';
import type { Point } from '../../../lib/creatureArt';
import type { FeatherRow } from '../../../lib/featherWing';

// --- TYPES ---
/** A part's three planes: lit, shadowed, and deep shadow. */
export type Tone = { lit: string; shade: string; deep: string };
export type Side = 'left' | 'right';
export type WingSpec = {
  /** The hook index.css animates ("tempest-wing-upper"...). */
  name: string;
  /** Shoulder, elbow, wrist, tip. The shoulder is the pivot. */
  bone: readonly Point[];
  /** Feather bands, bottom layer first. */
  rows: readonly { row: FeatherRow; tone: Tone }[];
  /** The arm's own tone (the far wing takes its shadow planes). */
  arm: Tone;
};
/** A bank of cloud: centre x, centre y, half-length, thickness. */
export type Bank = readonly [number, number, number, number];
export type CloudTone = Pick<Tone, 'lit' | 'shade'>;
export type LightIds = { gloomId: string; glowId: string; fadeId: string };
export type CloudSpec = {
  name: string;
  banks: readonly Bank[];
  tone: CloudTone;
};

// --- CONSTANTS: PALETTE ---
export const HIDE: Tone = { lit: '#4a5063', shade: '#343848', deep: '#262936' };
export const PLATE: Tone = {
  lit: '#69708a',
  shade: '#474c61',
  deep: '#343848',
};
export const SCUTE: Tone = {
  lit: '#8a8fa6',
  shade: '#5c6079',
  deep: '#474c61',
};
export const HORN: Tone = { lit: '#d9d6cc', shade: '#9d9a94', deep: '#6f6c68' };
export const FLIGHT: Tone = {
  lit: '#e0a04a',
  shade: '#b97a30',
  deep: '#8c5a22',
};
export const COVERT: Tone = {
  lit: '#a8662c',
  shade: '#834d20',
  deep: '#623a1a',
};
export const DOWN: Tone = { lit: '#6b4a3a', shade: '#523a30', deep: '#3d2c27' };
export const FAR_FLIGHT: Tone = {
  lit: '#9c6a34',
  shade: '#7c5228',
  deep: '#5e3e20',
};
export const FAR_COVERT: Tone = {
  lit: '#6e4a2c',
  shade: '#573a25',
  deep: '#422d1f',
};
export const CLOUD_BACK: CloudTone = { lit: '#4d536a', shade: '#383d50' };
export const CLOUD_MID: CloudTone = { lit: '#7b829a', shade: '#585e75' };
export const CLOUD_FRONT: CloudTone = { lit: '#cdd2e2', shade: '#989eb5' };
export const STEEL: Tone = {
  lit: '#9aa0b4',
  shade: '#5e6378',
  deep: '#3d4152',
};
export const BOLT = '#f6fcff';
export const BOLT_EDGE = '#7fdcff';
export const STORM_LIGHT = '#bfe9ff';
export const MAW = '#12131b';
export const GLOOM = '#1b1e2c';
export const HEART_TONE: Tone = {
  lit: BOLT,
  shade: STORM_LIGHT,
  deep: BOLT_EDGE,
};
/** Stroke widths, in viewBox units. */
export const HEART_CRACK_WIDTH = 0.45;
export const ARC_WIDTH = 0.5;
export const CLOUD_FLASH_WIDTH = 0.8;

// --- CONSTANTS: LAYOUT ---
/** The centre line the giant is drawn on. */
export const MID = 768;
/** The cloud runs down to the ground line. */
export const GROUND = 1024;

// --- CONSTANTS: WINGS (LEFT SIDE, MIRRORED FOR THE RIGHT) ---
/**
 * The raised pair: the arm arches up and out, and the feathers hang
 * from it, swinging outward toward the tip so the wing opens like a
 * hand. Long flight feathers lie under two shorter bands of coverts.
 */
export const UPPER_WING: WingSpec = {
  name: 'tempest-wing-upper',
  arm: HIDE,
  bone: [
    [690, 452],
    [548, 214],
    [338, 52],
    [196, 84],
  ],
  rows: [
    {
      tone: FLIGHT,
      row: {
        count: 17,
        shares: [0.06, 1],
        degrees: [94, 156],
        lengths: [250, 330, 420, 470, 440, 330],
        width: 66,
      },
    },
    {
      tone: COVERT,
      row: {
        count: 15,
        shares: [0.05, 1],
        degrees: [96, 158],
        lengths: [130, 180, 230, 240, 200, 150],
        width: 54,
      },
    },
    {
      tone: DOWN,
      row: {
        count: 13,
        shares: [0.05, 0.98],
        degrees: [98, 160],
        lengths: [70, 96, 112, 104, 84, 64],
        width: 42,
      },
    },
  ],
};
/** The lower pair: swept down and back into the cloud, in shadow. */
export const LOWER_WING: WingSpec = {
  name: 'tempest-wing-lower',
  arm: FAR_COVERT,
  bone: [
    [690, 566],
    [530, 548],
    [348, 610],
    [196, 706],
  ],
  rows: [
    {
      tone: FAR_FLIGHT,
      row: {
        count: 13,
        shares: [0.1, 1],
        degrees: [100, 150],
        lengths: [230, 300, 340, 310, 240],
        width: 62,
      },
    },
    {
      tone: FAR_COVERT,
      row: {
        count: 11,
        shares: [0.08, 1],
        degrees: [102, 152],
        lengths: [110, 150, 170, 150, 110],
        width: 50,
      },
    },
  ],
};
/** How thick a wing's arm is at the shoulder and at the tip. */
export const BONE_THICK = 58;
export const BONE_THIN = 14;

// --- CONSTANTS: BODY (LEFT HALF, MIRRORED) ---
export const TORSO: readonly Point[] = [
  [MID, 400],
  [706, 400],
  [590, 412],
  [500, 476],
  [552, 580],
  [612, 700],
  [650, 800],
  [626, 900],
  [MID, 900],
];
/** The chest plate over each breast. */
export const PECTORAL: readonly Point[] = [
  [MID, 440],
  [640, 430],
  [540, 488],
  [580, 584],
  [690, 612],
  [MID, 586],
];
/** Belly scutes: chevrons stepping down the middle, [top y, half-width]. */
export const SCUTES: readonly (readonly [number, number])[] = [
  [622, 104],
  [682, 96],
  [742, 88],
  [802, 80],
  [862, 72],
];
export const SCUTE_HEIGHT = 46;
export const SCUTE_DROP = 22;
/** Spikes of hide standing off each shoulder. */
export const SHOULDER_SPIKES: readonly (readonly Point[])[] = [
  [
    [640, 410],
    [596, 316],
    [590, 416],
  ],
  [
    [594, 416],
    [516, 338],
    [532, 458],
  ],
  [
    [536, 452],
    [440, 410],
    [508, 502],
  ],
];
export const NECK: readonly Point[] = [
  [MID, 300],
  [704, 320],
  [680, 412],
  [MID, 436],
];
/** The storm heart: a shard of light set in the breastbone (left half). */
export const STORM_HEART: readonly Point[] = [
  [MID, 466],
  [744, 512],
  [MID, 566],
];
/** Cracks of light running out from the heart (left side). */
export const HEART_CRACKS: readonly (readonly Point[])[] = [
  [
    [746, 512],
    [704, 498],
    [684, 528],
    [640, 520],
  ],
  [
    [752, 540],
    [720, 566],
    [728, 596],
  ],
];

// --- CONSTANTS: HEAD (LEFT HALF, MIRRORED) ---
/**
 * The head is traced at sketch size and drawn larger, about the base
 * of the neck, so the face still reads on a phone.
 */
export const HEAD_SCALE = 1.4;
export const HEAD_PIVOT: Point = [MID, 420];
export const SKULL: readonly Point[] = [
  [MID, 226],
  [718, 246],
  [698, 300],
  [722, 350],
  [742, 398],
  [MID, 414],
];
/** The long plane down the top of the snout. */
export const MUZZLE: readonly Point[] = [
  [MID, 288],
  [746, 306],
  [750, 388],
  [MID, 402],
];
export const BROW: readonly Point[] = [
  [702, 262],
  [762, 292],
  [760, 306],
  [704, 284],
];
export const NOSTRIL: readonly Point[] = [
  [752, 372],
  [762, 378],
  [754, 386],
];
/** The lower jaw, which drops when it roars. */
export const JAW: readonly Point[] = [
  [MID, 404],
  [738, 392],
  [748, 430],
  [MID, 446],
];
export const JAW_DROP: Record<HeroMood, number> = {
  calm: 0,
  fierce: 26,
  worried: 6,
  wince: 0,
};
/** Each mood's eye: a slit of storm light under the brow. */
export const EYES: Record<HeroMood, readonly Point[]> = {
  calm: [
    [712, 290],
    [756, 308],
    [722, 306],
  ],
  fierce: [
    [708, 284],
    [758, 310],
    [720, 310],
  ],
  worried: [
    [712, 298],
    [754, 300],
    [724, 310],
  ],
  wince: [
    [712, 296],
    [756, 306],
    [754, 310],
    [712, 300],
  ],
};
/** The great horns, swept up and back. */
export const HORN_HIGH: readonly Point[] = [
  [716, 262],
  [668, 196],
  [640, 96],
  [704, 178],
  [744, 238],
];
/** The lower horns, thrust out to the sides. */
export const HORN_LOW: readonly Point[] = [
  [704, 296],
  [636, 276],
  [574, 198],
  [650, 300],
  [710, 326],
];
export const CHEEK_SPINE: readonly Point[] = [
  [712, 332],
  [660, 352],
  [724, 356],
];
export const CREST: readonly Point[] = [
  [MID, 150],
  [750, 236],
  [MID, 250],
];

// --- CONSTANTS: ARMS ---
/** The near arm hangs toward the villain, its hand bigger than the head. */
export const NEAR_UPPER_ARM: readonly Point[] = [
  [506, 462],
  [584, 432],
  [606, 548],
  [548, 668],
  [452, 650],
  [440, 560],
];
/** A spur of bone off the elbow. */
export const ELBOW_SPUR: readonly Point[] = [
  [456, 640],
  [396, 704],
  [476, 676],
];
export const NEAR_FOREARM: readonly Point[] = [
  [430, 612],
  [540, 660],
  [452, 822],
  [340, 790],
];
export const NEAR_HAND: readonly Point[] = [
  [322, 780],
  [458, 812],
  [450, 890],
  [306, 862],
];
/** Claws: base left, base right, tip. */
export const CLAWS: readonly (readonly Point[])[] = [
  [
    [306, 852],
    [338, 862],
    [250, 980],
  ],
  [
    [342, 864],
    [376, 872],
    [322, 1016],
  ],
  [
    [380, 874],
    [414, 880],
    [390, 1024],
  ],
  [
    [418, 880],
    [452, 884],
    [462, 1004],
  ],
];
export const THUMB: readonly Point[] = [
  [452, 816],
  [506, 860],
  [492, 950],
  [462, 886],
];
/** The far arm is raised, fist around the spear. */
export const FAR_UPPER_ARM: readonly Point[] = [
  [960, 424],
  [1040, 486],
  [1164, 402],
  [1108, 318],
];
export const FAR_FOREARM: readonly Point[] = [
  [1090, 346],
  [1166, 380],
  [1176, 232],
  [1098, 208],
];
export const FIST: readonly Point[] = [
  [1086, 176],
  [1180, 186],
  [1186, 262],
  [1088, 254],
];
/** Where one plane of a limb meets the other (its lit/shadow line). */
export const NEAR_ARM_SPLIT = 500;
export const FAR_ARM_SPLIT = 1132;

// --- CONSTANTS: SPEAR ---
/** The shaft runs from its butt, through the fist, to the blade. */
export const SPEAR_BUTT: Point = [1080, 740];
export const SPEAR_NECK: Point = [1143, 120];
export const SPEAR_TIP: Point = [1168, -80];
export const SHAFT_WIDTH = 22;
/** The blade: a long leaf of white-hot light, and its bright core. */
export const BLADE: readonly Point[] = [
  [1128, 130],
  [1092, 40],
  SPEAR_TIP,
  [1200, 48],
  [1160, 134],
];
export const BLADE_CORE: readonly Point[] = [
  [1140, 114],
  [1122, 42],
  [1164, -46],
  [1174, 46],
  [1152, 116],
];
/** The barbs swept back under the blade. */
export const BARBS: readonly (readonly Point[])[] = [
  [
    [1128, 126],
    [1056, 168],
    [1126, 166],
  ],
  [
    [1160, 128],
    [1236, 154],
    [1156, 168],
  ],
];
/** Where the blade's glow is centred, and how far it reaches. */
export const GLOW_CENTRE: Point = [1148, 30];
export const GLOW_RADIUS = 280;
/** Arcs of lightning crawling off the spear (they flicker in turn). */
export const ARCS: readonly (readonly Point[])[] = [
  [
    [1168, -72],
    [1226, -30],
    [1200, 0],
    [1274, 44],
    [1250, 72],
    [1314, 104],
  ],
  [
    [1126, 84],
    [1062, 56],
    [1078, 20],
    [1006, -10],
    [1022, -42],
    [962, -62],
  ],
  [
    [1128, 270],
    [1050, 298],
    [1072, 330],
    [996, 366],
  ],
  [
    [1112, 480],
    [1170, 522],
    [1142, 552],
    [1204, 604],
  ],
];
/** The bolt that drops down the spear when it casts. */
export const SKY_BOLT: readonly Point[] = [
  [1222, -380],
  [1254, -380],
  [1190, -190],
  [1226, -184],
  SPEAR_TIP,
  [1170, -210],
  [1142, -216],
];

// --- CONSTANTS: STORM ---
/**
 * The gloom of the storm behind the giant: a soft dark pool that frames
 * the head and wings, so the pale horns and tawny feathers stand out
 * against any battlefield. Centre, then its reach across and up.
 */
export const GLOOM_CENTRE: Point = [MID, 380];
export const GLOOM_REACH: Point = [860, 520];
/**
 * The thunderhead, back to front: long wind-torn banks of cloud, each
 * lit along its top. The back row hides the waist, and the near hand
 * hangs between the last two.
 */
export const CLOUDS: readonly CloudSpec[] = [
  {
    name: 'tempest-cloud-back',
    tone: CLOUD_BACK,
    banks: [
      [210, 850, 360, 210],
      [1340, 860, 340, 200],
      [620, 880, 330, 230],
      [960, 850, 360, 240],
    ],
  },
  {
    name: 'tempest-cloud-mid',
    tone: CLOUD_MID,
    banks: [
      [120, 930, 300, 170],
      [1210, 920, 330, 180],
      [1500, 950, 220, 150],
      [720, 945, 360, 180],
    ],
  },
  {
    name: 'tempest-cloud-front',
    tone: CLOUD_FRONT,
    banks: [
      [30, 990, 250, 130],
      [1000, 996, 380, 140],
      [1470, 1000, 270, 130],
      [450, 990, 330, 140],
    ],
  },
];
/**
 * A bank's outline as [share of half-length, share of thickness] from
 * its centre: a ragged lens, blunt on the windward side. The first
 * BANK_TOP_POINTS run over the top, the rest come back underneath.
 */
export const BANK_OUTLINE: readonly Point[] = [
  [-1, 0.1],
  [-0.8, -0.28],
  [-0.62, -0.2],
  [-0.42, -0.5],
  [-0.2, -0.42],
  [-0.02, -0.62],
  [0.2, -0.5],
  [0.36, -0.3],
  [0.56, -0.36],
  [0.78, -0.16],
  [1, 0.1],
  [0.5, 0.4],
  [-0.1, 0.48],
  [-0.6, 0.36],
];
export const BANK_TOP_POINTS = 11;
/** Where the lit top gives way to the shadowed belly (thickness share). */
export const BANK_FOLD: readonly Point[] = [
  [0.6, -0.06],
  [0.3, -0.02],
  [0.12, -0.2],
  [-0.12, -0.14],
  [-0.3, -0.04],
  [-0.56, 0.02],
  [-0.74, 0.06],
];
/** The cloud thins out over this much height above the ground. */
export const CLOUD_FADE = 90;
/** Lightning inside the cloud: it flashes now and then. */
export const CLOUD_FLASHES: readonly (readonly Point[])[] = [
  [
    [300, 850],
    [270, 900],
    [300, 906],
    [262, 970],
  ],
  [
    [1180, 830],
    [1216, 882],
    [1188, 892],
    [1232, 960],
  ],
];
