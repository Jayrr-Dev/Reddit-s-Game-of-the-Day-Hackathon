// ===================================================================
// URIEL RIG
// Pure geometry for Archangel Uriel's layered rig: given the time and
// her sword arm's pose, it returns the attribute every moving part
// should have. Drawn live (instead of from a baked sprite sheet) so the
// figure stays sharp at any size, moves at the display's frame rate and
// has no loop seam.
//
// TWO CLOCKS, ON PURPOSE:
// - `ambient` (seconds, never restarts) drives the wings, ribbons, halo
//   and float. Every ambient cycle divides AMBIENT_PERIOD, so wrapping
//   the clock there is invisible.
// - the clip time (see urielMotion.ts) drives only the sword arm. An
//   attack starting or ending therefore never jolts the wings.
//
// Coordinates are the art's own 1050 x 525 space, same as the approved
// demo in tools/uriel. Self-contained so `node --test` can import it.
// ===================================================================

import type { UrielPose } from './urielMotion';

// --- TYPES ---
export type UrielPoint = readonly [number, number];

/** Everything the sword arm contributes to a frame. */
export type UrielArm = {
  /** 0..1 how far the sword is raised overhead. */
  up: number;
  /** 0..1 how far a cut has landed and not yet recovered. */
  amount: number;
  /** 0..1 shoulder lift; rolls the sword pauldron. */
  armLift: number;
  /** Blade length factor; under 1 foreshortens it mid-swing. */
  reach: number;
  /** Body lean in degrees. */
  lean: number;
  /** Sword angle in degrees. */
  angle: number;
  elbow: UrielPoint;
  wrist: UrielPoint;
};

/** Attribute values for one frame, keyed by attribute then by part name. */
export type UrielFrame = Record<'transform' | 'd' | 'opacity', Record<string, string>>;

type UrielRibbon = { colors: readonly [string, string]; nodes: readonly (readonly [number, number, number])[]; amp: number };

// --- CONSTANTS ---
const TAU = Math.PI * 2;
/** Wingbeat (1.8 s), ribbon wave (2.25 s) and sway (4.5 s) all repeat exactly every 9 s. */
export const AMBIENT_PERIOD = 9;
const WINGBEAT_SECONDS = 1.8;
const RIBBON_SECONDS = 2.25;
const SWAY_SECONDS = 4.5;
const BLADE_LENGTH = 197;
const TRAIL_SAMPLES = 10;
export const BLUR_GHOSTS = 19;
/** Art-space segments the arm plates were drawn along; artLink re-aims them. */
const UPPER_ARM: readonly [UrielPoint, UrielPoint] = [[570, 151], [591, 190]];
const FOREARM: readonly [UrielPoint, UrielPoint] = [[591, 190], [623, 229]];

// --- RIBBONS ---
/** Cloth strips: [x, y, width] nodes from the waist to the tip. */
export const URIEL_RIBBONS: readonly UrielRibbon[] = [
  { colors: ['#d99349', '#f9cc88'], nodes: [[487, 241, 15], [451, 253, 13], [384, 276, 10], [302, 316, 10], [281, 360, 0]], amp: 18 },
  { colors: ['#e3b879', '#ffe0a6'], nodes: [[499, 254, 13], [461, 293, 12], [410, 312, 10], [343, 321, 8], [287, 370, 11], [289, 399, 5], [311, 419, 0]], amp: 15 },
  { colors: ['#d89149', '#fac97f'], nodes: [[558, 253, 15], [589, 309, 12], [654, 335, 13], [694, 376, 13], [689, 423, 6], [657, 460, 0]], amp: 18 },
  { colors: ['#e3b47c', '#ffddab'], nodes: [[547, 252, 19], [565, 314, 19], [585, 365, 25], [594, 401, 17], [575, 434, 0]], amp: 13 },
  { colors: ['#812428', '#b43d35'], nodes: [[551, 271, 19], [576, 318, 13], [606, 370, 11], [625, 427, 16], [598, 465, 8], [556, 487, 0]], amp: 19 },
  { colors: ['#d99754', '#f6c783'], nodes: [[505, 269, 18], [471, 315, 20], [430, 359, 17], [383, 397, 14], [376, 427, 9], [386, 454, 0]], amp: 13 },
  { colors: ['#e3b780', '#ffdb9e'], nodes: [[500, 254, 16], [465, 306, 13], [414, 352, 14], [391, 383, 10], [380, 426, 7], [394, 451, 0]], amp: 16 },
  { colors: ['#87282b', '#bd3e34'], nodes: [[497, 267, 19], [469, 320, 16], [427, 363, 14], [352, 389, 17], [331, 423, 16], [342, 459, 9], [370, 497, 0]], amp: 19 },
  { colors: ['#c68743', '#f9c788'], nodes: [[506, 271, 15], [471, 349, 20], [430, 392, 18], [417, 439, 16], [420, 475, 7], [438, 495, 0]], amp: 13 },
  { colors: ['#d0a172', '#f7cc98'], nodes: [[522, 272, 18], [491, 359, 18], [464, 413, 19], [455, 455, 13], [453, 487, 7], [475, 514, 0]], amp: 11 },
  { colors: ['#b97d50', '#eaba80'], nodes: [[545, 271, 19], [555, 345, 14], [550, 391, 16], [525, 440, 15], [498, 475, 0]], amp: 12 },
  { colors: ['#81232b', '#a43736'], nodes: [[529, 264, 25], [532, 325, 33], [529, 389, 28], [516, 451, 26], [503, 512, 0]], amp: 14 },
];

// --- MATH HELPERS ---
/** Clamps to 0..1. */
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

/** Smoothstep from 0 at `start` to 1 at `end`. */
const ease = (start: number, end: number, value: number): number => {
  const u = clamp((value - start) / (end - start));
  return u * u * (3 - 2 * u);
};

/** Linear mix of two numbers. */
const mix = (from: number, to: number, share: number): number => from + (to - from) * share;

/** Formats a number for an SVG attribute; rounding first keeps a tiny negative from printing as "-0.00". */
const fmt = (value: number): string => (Math.round(value * 100) / 100 || 0).toFixed(2);

/** Formats a point as "x y". */
const pt = (point: UrielPoint): string => `${fmt(point[0])} ${fmt(point[1])}`;

// --- SWORD ARM POSES ---
/** The resting guard: sword held low to the side. */
export const URIEL_REST_ARM: UrielArm = {
  up: 0, amount: 0, armLift: 0, reach: 1, lean: 0, angle: 46, elbow: [598, 191], wrist: [632, 248],
};

/** Overhead choreography: raise (1.65-2.88 s), cut (3.58-3.93 s), recover (4.22-5.20 s). */
const overheadArm = (t: number): UrielArm => {
  const cut = ease(3.58, 3.93, t);
  const recover = ease(4.22, 5.2, t);
  const amount = cut * (1 - recover);
  const up = ease(1.65, 2.88, t) * (1 - cut);
  const sweep = Math.sin(Math.PI * cut) * (1 - recover);
  return {
    up, amount, armLift: up, reach: 1, lean: 3 * up - 12 * amount, angle: 46 - 138 * up + 82 * amount,
    elbow: [598 - 5 * up + 21 * sweep + 9 * amount, 191 - 94 * up - 17 * sweep - 6 * amount],
    wrist: [632 - 32 * up + 66 * sweep - 32 * amount, 248 - 204 * up - 55 * sweep - 23 * amount],
  };
};

/** Diagonal choreography: the elbow leads, the wrist catches up, then the blade travels high right to low left. */
const diagonalArm = (t: number): UrielArm => {
  const elbowLead = ease(1.35, 1.98, t);
  const wristLoad = ease(1.71, 2.34, t);
  const hit = ease(2.58, 2.91, t);
  const rest = 1 - ease(3.21, 4.6, t);
  return {
    up: 0, amount: hit * rest, armLift: elbowLead * (1 - hit) * rest,
    reach: 1 - 0.54 * Math.pow(Math.sin(Math.PI * hit), 1.25) * rest,
    lean: (7 * elbowLead - 17 * hit) * rest, angle: 46 + (-74 * wristLoad - 174 * hit) * rest,
    elbow: [598 + (7 * elbowLead - 36 * hit) * rest, 191 + (-77 * elbowLead + 77 * hit) * rest],
    wrist: [632 + (23 * wristLoad - 140 * hit) * rest, 248 + (-62 * elbowLead - 39 * wristLoad + 97 * hit) * rest],
  };
};

/** The sword arm for a pose at rig time `t`. */
export const urielArmAt = (pose: UrielPose, t: number): UrielArm =>
  pose === 'hover' ? URIEL_REST_ARM : pose === 'diagonal' ? diagonalArm(t) : overheadArm(t);

/** Mixes two arm poses, so a pose change eases in instead of snapping. */
export const blendUrielArms = (from: UrielArm, to: UrielArm, share: number): UrielArm => {
  const k = ease(0, 1, share);
  if (k >= 1) return to;
  return {
    up: mix(from.up, to.up, k), amount: mix(from.amount, to.amount, k), armLift: mix(from.armLift, to.armLift, k),
    reach: mix(from.reach, to.reach, k), lean: mix(from.lean, to.lean, k), angle: mix(from.angle, to.angle, k),
    elbow: [mix(from.elbow[0], to.elbow[0], k), mix(from.elbow[1], to.elbow[1], k)],
    wrist: [mix(from.wrist[0], to.wrist[0], k), mix(from.wrist[1], to.wrist[1], k)],
  };
};

// --- FRAME PARTS ---
/** A point `along` the blade and `across` it, for a sword at `wrist` and `angleDeg`. */
const bladePoint = (wrist: UrielPoint, angleDeg: number, along: number, across = 0): string => {
  const angle = angleDeg * Math.PI / 180;
  const x = wrist[0] + Math.cos(angle) * along - Math.sin(angle) * across;
  const y = wrist[1] + Math.sin(angle) * along + Math.cos(angle) * across;
  return `${x.toFixed(1)} ${y.toFixed(1)}`;
};

/** Re-aims arm plates drawn along `source` so they span `from` to `to` (mirrored for the shield arm). */
const artLink = (source: readonly [UrielPoint, UrielPoint], from: UrielPoint, to: UrielPoint, isMirrored = false): string => {
  const [sourceFrom, sourceTo] = source;
  const sourceX = sourceTo[0] - sourceFrom[0], sourceY = sourceTo[1] - sourceFrom[1];
  const x = to[0] - from[0], y = to[1] - from[1];
  const stretch = Math.max(0.6, Math.hypot(x, y) / Math.hypot(sourceX, sourceY));
  const turn = Math.atan2(y, x) * 180 / Math.PI, sourceTurn = Math.atan2(sourceY, sourceX) * 180 / Math.PI;
  return `translate(${pt(from)}) rotate(${fmt(turn)}) scale(${stretch.toFixed(4)} ${isMirrored ? -1 : 1}) ` +
    `rotate(${fmt(-sourceTurn)}) translate(${-sourceFrom[0]} ${-sourceFrom[1]})`;
};

/** One wing's flap around its shoulder pivot. */
const wingTransform = (pivot: number, side: 1 | -1, phase: number, beat: number, arm: UrielArm): string => {
  const wave = Math.sin(beat + phase);
  const squeeze = 1 - 0.095 * (1 - wave) - 0.035 * Math.max(arm.up, arm.amount);
  const turn = ((7 - 3 * arm.up) * wave + 32 * arm.up - 8 * arm.amount) * side;
  return `translate(${pivot} 145) rotate(${fmt(turn)}) scale(${squeeze.toFixed(3)} ${(1 + 0.055 * wave).toFixed(3)}) translate(${-pivot} -145)`;
};

/** Writes one ribbon's base and facet outlines; `motion` flares them during a swing. */
const paintRibbon = (frame: UrielFrame, ribbon: UrielRibbon, index: number, ambient: number, motion: number): void => {
  const wave = TAU * ambient / RIBBON_SECONDS;
  const last = ribbon.nodes.length - 1;
  const spine = ribbon.nodes.map(([x, y, width], node): readonly [number, number, number] => {
    const u = node / last;
    return [
      x + u ** 1.35 * (ribbon.amp * Math.sin(wave - index * 0.63 - u * 2.3) + motion * (x < 525 ? -9 : 9)),
      y + u ** 1.6 * (5 * Math.cos(wave - index * 0.58) - motion * 11),
      width,
    ];
  });
  const left: string[] = [], right: string[] = [], crease: string[] = [];
  spine.forEach(([x, y, width], node) => {
    const before = spine[Math.max(0, node - 1)] ?? spine[0], after = spine[Math.min(node + 1, last)] ?? spine[last];
    if (!before || !after) return;
    const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy) || 1;
    const nx = -dy * width / length, ny = dx * width / length;
    left.push(pt([x + nx / 2, y + ny / 2]));
    right.push(pt([x - nx / 2, y - ny / 2]));
    crease.push(pt([x + nx * 0.08, y + ny * 0.08]));
  });
  frame.d[`ribbon-${index}-base`] = `M ${left.join(' L ')} L ${right.reverse().join(' L ')} Z`;
  frame.d[`ribbon-${index}-facet`] = `M ${left.join(' L ')} L ${crease.reverse().join(' L ')} Z`;
};

/** Poses both arms, the pauldrons and the sword grip. */
const paintArms = (frame: UrielFrame, arm: UrielArm, pulse: number): void => {
  const { elbow, wrist, up } = arm;
  const shoulder: UrielPoint = [570 + 8 * up, 153 + 2 * pulse - 18 * up];
  const guardShift = 2 * pulse - 2 * up;
  const guardShoulder: UrielPoint = [480, 153 + guardShift];
  const guardElbow: UrielPoint = [458, 187 + guardShift * 0.45];
  const guardWrist: UrielPoint = [445, 215];
  const forearm = Math.hypot(wrist[0] - elbow[0], wrist[1] - elbow[1]) || 1;
  // The connector runs 4 units past the wrist so no gap shows under the hand.
  const overlap: UrielPoint = [wrist[0] + 4 * (wrist[0] - elbow[0]) / forearm, wrist[1] + 4 * (wrist[1] - elbow[1]) / forearm];
  frame.transform.shieldPauldron = `translate(495 ${fmt(125 + guardShift)}) rotate(${fmt(-3 * pulse + 4 * up)}) scale(-1 1)`;
  frame.transform.swordPauldron = `translate(546 112) rotate(${fmt(3 * pulse - 38 * arm.armLift)}) translate(9 13)`;
  frame.d.guardConnection = `M 499 139 L ${pt(guardShoulder)} L ${pt(guardElbow)} L ${pt(guardWrist)}`;
  frame.d.armConnection = `M 551 139 L ${pt(shoulder)} L ${pt(elbow)} L ${pt(overlap)}`;
  frame.transform.swordUpper = artLink(UPPER_ARM, shoulder, elbow);
  frame.transform.swordFore = artLink(FOREARM, elbow, wrist);
  frame.transform.shieldUpper = artLink(UPPER_ARM, guardShoulder, guardElbow, true);
  frame.transform.shieldFore = artLink(FOREARM, guardElbow, guardWrist, true);
  frame.transform.grip = `translate(${pt(wrist)}) rotate(${fmt(arm.angle)})`;
  frame.transform.blade = `scale(${arm.reach.toFixed(4)} 1)`;
};

/** The overhead cut's golden trail: the blade's last few positions joined into a fan. */
const paintTrail = (frame: UrielFrame, t: number, isOverhead: boolean): void => {
  const strength = isOverhead ? ease(3.63, 3.76, t) * (1 - ease(3.94, 4.1, t)) : 0;
  frame.opacity.slashTrail = (0.43 * strength).toFixed(3);
  frame.opacity.slashEdge = (0.83 * strength).toFixed(3);
  if (strength === 0) return;
  const outer: string[] = [], inner: string[] = [];
  for (let sample = 0; sample < TRAIL_SAMPLES; sample++) {
    const past = overheadArm(Math.max(3.58, t - (TRAIL_SAMPLES - 1 - sample) * 0.017));
    outer.push(bladePoint(past.wrist, past.angle, BLADE_LENGTH));
    inner.push(bladePoint(past.wrist, past.angle, BLADE_LENGTH - (4 + 18 * Math.sin(sample * Math.PI / (TRAIL_SAMPLES - 1)))));
  }
  frame.d.slashEdge = `M ${outer.join(' L ')}`;
  frame.d.slashTrail = `M ${outer.join(' L ')} L ${inner.reverse().join(' L ')} Z`;
};

/** The diagonal swing's blade-only motion blur: fading copies of the blade where it just was. */
const paintBlur = (frame: UrielFrame, t: number, isDiagonal: boolean): void => {
  const envelope = isDiagonal ? ease(2.6, 2.67, t) * (1 - ease(2.87, 3.02, t)) : 0;
  for (let ghost = 0; ghost < BLUR_GHOSTS; ghost++) {
    frame.opacity[`ghost-${ghost}`] = (envelope * (0.022 + 0.17 * (ghost / (BLUR_GHOSTS - 1)) ** 1.8)).toFixed(3);
    if (envelope === 0) continue;
    const past = diagonalArm(Math.max(2.57, t - (BLUR_GHOSTS - ghost) * 0.008));
    const at = (along: number, across: number) => bladePoint(past.wrist, past.angle, along * past.reach, across);
    frame.d[`ghost-${ghost}`] = `M ${at(47, 10)} L ${at(196, 0)} L ${at(55, -9)} Z`;
  }
};

// --- FRAME ---
/**
 * Every moving part's attribute for one frame. `ambient` is the endless
 * clock in seconds, `arm` the (possibly blended) sword arm, and `pose`
 * with its clip time `t` picks the swing effects.
 */
export const urielFrame = (ambient: number, arm: UrielArm, pose: UrielPose = 'hover', t = 0): UrielFrame => {
  const frame: UrielFrame = { transform: {}, d: {}, opacity: {} };
  const beat = TAU * ambient / WINGBEAT_SECONDS;
  const rise = Math.sin(beat - 0.62);
  const lean = `rotate(${fmt(arm.lean)} 525 238)`;
  const driftX = 5 * Math.sin(TAU * ambient / SWAY_SECONDS) - 3 * arm.up + 16 * arm.amount;
  const driftY = 8 * rise - 8 * arm.up + 8 * arm.amount;
  frame.transform.float = `translate(${fmt(driftX)} ${fmt(driftY)})`;
  frame.transform.bodyLean = lean;
  frame.transform.haloAnchor = lean;
  frame.transform.haloHighlight = `rotate(${fmt(360 * ambient / WINGBEAT_SECONDS % 360)})`;
  frame.transform.wingLeft = wingTransform(462, 1, 0.06, beat, arm);
  frame.transform.wingRight = wingTransform(586, -1, -0.15, beat, arm);
  URIEL_RIBBONS.forEach((ribbon, index) => paintRibbon(frame, ribbon, index, ambient, Math.max(arm.up, arm.amount)));
  paintArms(frame, arm, Math.sin(beat - 0.85));
  paintTrail(frame, t, pose === 'overhead');
  paintBlur(frame, t, pose === 'diagonal');
  return frame;
};
