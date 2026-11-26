// Frames and timing for the approved Archangel Uriel animation atlas.
export const URIEL_ATLAS = { columns: 8, rows: 9, width: 416, height: 270 } as const;

export type UrielPose = 'hover' | 'diagonal' | 'raise' | 'overhead';

const CLIPS = {
  hover: { first: 0, count: 24, ms: 1800 },
  diagonal: { first: 24, count: 18, ms: 560 },
  raise: { first: 42, count: 12, ms: 620 },
  overhead: { first: 54, count: 18, ms: 560 },
} as const;

/** Selects the approved pose without changing the move's damage type or effects. */
export const urielPoseOf = (
  action?: { style: string; isSignature: boolean } | null
): UrielPose =>
  !action || (action.style === 'support' && !action.isSignature) ? 'hover' :
    action.isSignature ? (action.style === 'support' ? 'raise' : 'overhead') : 'diagonal';

/** Loops idle and holds the final frame of an action instead of repeating the attack. */
export const urielFrameAt = (pose: UrielPose, elapsed: number): number => {
  const clip = CLIPS[pose];
  const progress = Math.max(0, elapsed) / clip.ms;
  return clip.first + Math.min(clip.count - 1, Math.floor((pose === 'hover' ? progress % 1 : progress) * clip.count));
};

/** Selects one cell of the atlas in a nested SVG viewport. */
export const urielFrameBox = (index: number): string => {
  const { columns, width, height } = URIEL_ATLAS;
  return `${(index % columns) * width} ${Math.floor(index / columns) * height} ${width} ${height}`;
};
