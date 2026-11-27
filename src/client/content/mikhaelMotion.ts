import type { HeroAction } from './heroLooks.ts';

// --- SWORD PHASE TIMING ---
export const MIKHAEL_ATTACK_SPEED = 1.33;
export const MIKHAEL_SWORD_DURATION_MS = Math.round(1520 / MIKHAEL_ATTACK_SPEED);
const CEL_TIMES = [0, 260, 630, 710, 775, 835, 900, 980, 1100, 1170, 1300, 1520] as const;
const LAST_CEL = CEL_TIMES.length - 1;

export type MikhaelSwordClip = 'idle' | 'rally' | 'downward' | 'upward' | 'backhand' | 'thrust';
export type MikhaelAttackClip = Exclude<MikhaelSwordClip, 'idle' | 'rally'>;

/** Selects a visual without changing the combat move, damage, or phase. */
export function mikhaelSwordClip(action: HeroAction | null | undefined): MikhaelSwordClip {
  if (!action) return 'idle';
  if (action.isCharging || action.style === 'support') return 'rally';
  if (action.isSignature) return 'thrust';
  if (action.moveName === 'Divide the Earth') return 'downward';
  if (action.swing === 'upcut' || action.swing === 'chop' || action.swing === 'forward') return 'upward';
  return 'backhand';
}

/** Returns the held cel at the preview's faster playback rate. */
export function mikhaelCelAt(ms: number): number {
  const t = Math.min(ms * MIKHAEL_ATTACK_SPEED, 1520);
  return ms >= MIKHAEL_SWORD_DURATION_MS ? LAST_CEL : Math.max(0, CEL_TIMES.findLastIndex((start) => start <= t));
}
