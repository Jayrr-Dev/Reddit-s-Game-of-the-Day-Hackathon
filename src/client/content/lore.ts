// ===================================================================
// LORE AND COPY
// Story text and labels shown to the player. Kept apart from components
// so the voice of the game can be edited in one place.
// ===================================================================

import type { StopKind } from '../../shared/game/kingdom';
import { ROW_LABEL } from '../../shared/game/rules';

// --- STORY ---
export const STORY_LINES = [
  'They called themselves heroes when they cut her down.',
  'Now you march on their kingdom, one village, one road, one gate at a time.',
  'Take the throne. Make them remember her name.',
] as const;

/** The short line under the logo on the title screen. */
export const LOGO_SUBTITLE = 'A daily deckbuilder of revenge';

export const TAGLINE =
  'An endless march of vengeance. Same horde for everyone, every day.';

// --- HOW TO PLAY ---
export const HOW_TO_PLAY = [
  'Tap a card, then tap a glowing hero. 3 energy a turn.',
  `Melee hits the ${ROW_LABEL.front}. Range, Magic and Curse hit anyone.`,
  'Pull a hiding healer forward. Every 5th stop is a champion.',
] as const;

// --- STOPS ---
export const STOP_COPY: Record<StopKind, { title: string; blurb: string }> = {
  horde: { title: 'Hero Horde', blurb: 'Break the line. Earn a card.' },
  elite: { title: 'Elite Hero', blurb: 'A veteran. Better spoils.' },
  champion: { title: 'Champion', blurb: 'Defeat them to conquer the region.' },
  grave: { title: 'Her Grave', blurb: 'Mourn to heal, or swear vengeance.' },
  'greed-bargain': { title: "Greed's Bargain", blurb: 'Trade away a card now. Take it back after death.' },
  altar: { title: 'Dark Altar', blurb: 'Claim a forbidden card.' },
};

// --- ENDINGS ---
/** The line shown when the run ends, based on how far the villain got. */
export const fallenLine = (regionsConquered: number): string => {
  if (regionsConquered >= 6) return 'You sat upon the throne. Still they came.';
  if (regionsConquered >= 3)
    return 'The castle trembled. The heroes held, barely.';
  if (regionsConquered >= 1)
    return 'A region burns in your name. Rest, and return.';
  return 'The heroes cheer. Tomorrow, they will not.';
};
