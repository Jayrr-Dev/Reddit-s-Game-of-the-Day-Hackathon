// ===================================================================
// URIEL MOTION
// Which pose Archangel Uriel plays for a move, and how each pose's clip
// maps real time onto the rig's choreography time (the seconds used by
// the approved demo in tools/uriel). The drawing itself lives in
// urielRig.ts; this file only answers "which clip, and where in it".
// ===================================================================

// --- TYPES ---
export type UrielPose = 'hover' | 'diagonal' | 'raise' | 'overhead';

/** One stretch of a clip: until `until` (share of the clip), rig time runs `from` to `to`. */
type ClipSegment = { until: number; from: number; to: number };

type UrielClip = { ms: number; segments: readonly ClipSegment[] };

// --- CLIPS ---
// Each attack squeezes a slow stretch of the choreography into a short
// clip, spending most of its time on the anticipation and the hit.
const CLIPS: Record<Exclude<UrielPose, 'hover'>, UrielClip> = {
  diagonal: {
    ms: 560,
    segments: [
      { until: 0.5, from: 1.35, to: 2.58 },
      { until: 0.75, from: 2.58, to: 2.91 },
      { until: 1, from: 2.91, to: 4.6 },
    ],
  },
  raise: { ms: 620, segments: [{ until: 1, from: 1.65, to: 2.88 }] },
  overhead: {
    ms: 560,
    segments: [
      { until: 0.45, from: 3.58, to: 3.93 },
      { until: 1, from: 3.93, to: 5.2 },
    ],
  },
};

// --- POSE SELECTION ---
/** Selects the approved pose without changing the move's damage type or effects. */
export const urielPoseOf = (
  action?: { style: string; isSignature: boolean } | null
): UrielPose =>
  !action || (action.style === 'support' && !action.isSignature) ? 'hover' :
    action.isSignature ? (action.style === 'support' ? 'raise' : 'overhead') : 'diagonal';

// --- CLIP CLOCK ---
/**
 * Rig time for a pose `elapsedMs` after it started. A finished clip
 * holds its last moment, so a raised sword stays raised until the next
 * pose. Hover has no clip: its motion runs on the ambient clock.
 */
export const urielClipTime = (pose: UrielPose, elapsedMs: number): number => {
  if (pose === 'hover') return 0;
  const { ms, segments } = CLIPS[pose];
  const progress = Math.max(0, Math.min(1, elapsedMs / ms));
  let segmentStart = 0;
  for (const { until, from, to } of segments) {
    if (progress <= until) return from + (to - from) * (progress - segmentStart) / (until - segmentStart);
    segmentStart = until;
  }
  return segments[segments.length - 1]?.to ?? 0;
};
