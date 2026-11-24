// ===================================================================
// MOTION
// Shared motion helpers for imperative (Web Animations) effects.
// ===================================================================

/** True when the player asked the system for less motion. */
export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
