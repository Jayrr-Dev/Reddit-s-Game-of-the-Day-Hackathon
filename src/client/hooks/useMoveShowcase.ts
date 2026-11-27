// ===================================================================
// MOVE SHOWCASE
// Plays a boss's moves one after another on a loop, for the Sprite tab
// of the unit info window: each beat hands HeroFigure the same
// HeroAction a fight would, so the boss animates exactly as in the arena.
// ===================================================================

import { useEffect, useState } from 'react';
import { describeHeroMoveList, type MoveIntent } from '../../shared/game/describe';
import type { HeroId } from '../../shared/game/heroes';
import { MIKHAEL_SWORD_DURATION_MS } from '../content/mikhaelMotion';
import { wolfAttackOf, type HeroAction, type HeroActionStyle } from '../content/heroLooks';

// --- CONSTANTS ---
/** How long each move plays, then the pause before the next (ms). */
const ACT_MS = 1100;
const REST_MS = 900;

/** A move's look in a fight comes from its first chip's kind. */
const STYLE_OF_KIND: Partial<Record<MoveIntent['intents'][number]['kind'], HeroActionStyle>> = {
  attack: 'melee',
  range: 'range',
  magic: 'magic',
};

// --- TYPES ---
export type ShowcaseBeat = { moveName: string; action: HeroAction | null };

// --- HELPERS ---
/** The HeroAction a move plays as, like useHeroTurn builds in a fight. */
export const showcaseActionOf = (move: MoveIntent): HeroAction => ({
  style: STYLE_OF_KIND[move.intents[0]?.kind ?? 'buff'] ?? 'support',
  swing: 'slash',
  isSignature: move.isSignature,
  isTwoHanded: false,
  moveName: move.name,
});

// --- HOOK ---
/**
 * The beat on screen: a move playing, then a rest (action null), cycling
 * through every move. Off (always resting) when isPlaying is false.
 */
export const useMoveShowcase = (heroId: HeroId, isPlaying: boolean): ShowcaseBeat => {
  const [step, setStep] = useState(0);
  const moves = describeHeroMoveList(heroId);
  const isActing = step % 2 === 0;
  const move = moves[Math.floor(step / 2) % Math.max(moves.length, 1)];

  // Advance to the next beat after this one's duration.
  useEffect(() => {
    if (!isPlaying || moves.length === 0) return;
    const actMs = heroId === 'archangelMikhael' ? MIKHAEL_SWORD_DURATION_MS : ACT_MS;
    const timer = window.setTimeout(() => setStep((current) => current + 1), isActing ? actMs : REST_MS);
    return () => window.clearTimeout(timer);
  }, [heroId, isPlaying, isActing, step, moves.length]);

  if (!isPlaying || !move) return { moveName: '', action: null };
  if (!isActing) return { moveName: move.name, action: null };
  const action = showcaseActionOf(move);
  const wolfAttack = wolfAttackOf(heroId, move.name);
  if (wolfAttack) action.wolfAttack = wolfAttack;
  if (heroId === 'twinAxeKnight' && action.style === 'melee') {
    action.khanAttackPhase = action.isSignature ? 'signature-preview' : 'cleave';
  }
  return { moveName: move.name, action };
};
