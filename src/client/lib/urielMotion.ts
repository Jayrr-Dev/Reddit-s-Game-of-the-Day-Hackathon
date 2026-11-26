// Frames and timing for the approved Archangel Uriel animation atlas.
export const URIEL_ATLAS = { columns: 8, rows: 9, width: 256, height: 166 } as const;

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

/** Builds compositor-only, held transform keyframes for one atlas clip. */
export const urielPlayback = (pose: UrielPose) => {
  const { columns, rows } = URIEL_ATLAS;
  const { first, count, ms } = CLIPS[pose];
  const frames = Array.from({ length: count + 1 }, (_, step) => {
    const index = first + Math.min(step, count - 1);
    return {
      offset: step / count,
      easing: 'steps(1, end)',
      transform: `translate3d(${-100 * (index % columns) / columns}%, ${-100 * Math.floor(index / columns) / rows}%, 0)`,
    };
  });
  return { frames, duration: ms, loop: pose === 'hover' };
};
