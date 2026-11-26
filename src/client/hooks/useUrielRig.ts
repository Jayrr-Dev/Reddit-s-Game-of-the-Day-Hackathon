// ===================================================================
// USE URIEL RIG
// Drives Archangel Uriel's live rig: every animation frame it asks
// urielRig for the frame at "now" and writes it onto the SVG parts.
//
// WHY WRITE ATTRIBUTES DIRECTLY: about a hundred attributes change per
// frame. Going through React state would re-render the whole figure
// sixty times a second; setting them on the elements costs almost
// nothing and keeps React out of the frame loop.
// ===================================================================

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { urielClipTime, type UrielPose } from '../lib/urielMotion';
import {
  AMBIENT_PERIOD,
  blendUrielArms,
  URIEL_REST_ARM,
  urielArmAt,
  urielFrame,
  type UrielArm,
  type UrielFrame,
} from '../lib/urielRig';

// --- CONSTANTS ---
/** How long a pose change takes to ease from the arm's current position. */
const POSE_BLEND_MS = 180;
/** Marks a rig part; its value is the part's key in a UrielFrame. */
export const URIEL_PART_ATTRIBUTE = 'data-uriel-part';
const FRAME_ATTRIBUTES = ['transform', 'd', 'opacity'] as const;

// --- HELPERS ---
/** Finds every rig part under `root`, keyed by its part name. */
const collectParts = (root: SVGElement): Map<string, Element> =>
  new Map(Array.from(root.querySelectorAll(`[${URIEL_PART_ATTRIBUTE}]`), (part): [string, Element] =>
    [part.getAttribute(URIEL_PART_ATTRIBUTE) ?? '', part]));

/** Writes one frame's attributes onto the rig parts. */
const applyFrame = (parts: Map<string, Element>, frame: UrielFrame): void => {
  for (const attribute of FRAME_ATTRIBUTES) {
    for (const [part, value] of Object.entries(frame[attribute])) parts.get(part)?.setAttribute(attribute, value);
  }
};

// --- HOOK ---
/**
 * Poses the rig under `root` and, when `isAnimated`, keeps it moving.
 * A still rig (small portraits, reduced motion) holds the resting pose.
 */
export const useUrielRig = (root: RefObject<SVGSVGElement | null>, pose: UrielPose, isAnimated: boolean): void => {
  // The arm as last drawn, so the next pose eases out of wherever it is.
  const drawnArm = useRef<UrielArm>(URIEL_REST_ARM);

  // Layout effect: the parts have no pose in the markup, so the first
  // frame must land before the browser paints.
  useLayoutEffect(() => {
    const svg = root.current;
    if (!svg) return;
    const parts = collectParts(svg);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const blendFrom = drawnArm.current;
    const poseStartedAt = performance.now();
    let nextFrame = 0;

    const drawStill = () => applyFrame(parts, urielFrame(0, URIEL_REST_ARM));
    const drawMoving = (now: number) => {
      const elapsed = Math.max(0, now - poseStartedAt);
      const clipTime = urielClipTime(pose, elapsed);
      const arm = blendUrielArms(blendFrom, urielArmAt(pose, clipTime), elapsed / POSE_BLEND_MS);
      drawnArm.current = arm;
      // The ambient clock is the page clock, so it never restarts with a pose.
      applyFrame(parts, urielFrame(now / 1000 % AMBIENT_PERIOD, arm, pose, clipTime));
      nextFrame = requestAnimationFrame(drawMoving);
    };
    const start = () => {
      cancelAnimationFrame(nextFrame);
      if (isAnimated && !reducedMotion.matches) drawMoving(performance.now());
      else drawStill();
    };

    start();
    reducedMotion.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(nextFrame);
      reducedMotion.removeEventListener('change', start);
    };
  }, [root, pose, isAnimated]);
};
