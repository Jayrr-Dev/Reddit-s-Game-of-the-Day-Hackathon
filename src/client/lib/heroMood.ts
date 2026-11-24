// ===================================================================
// HERO MOOD
// Picks the expression a hero's face shows from what is happening to it
// right now. One pure rule list, strongest feeling first, so a hero
// that is hit while low on HP winces rather than just looking worried.
// ===================================================================

import type { HeroMood } from '../content/heroLooks';

// --- TYPES ---
export type MoodInputs = {
  /** A damage number is still floating over this hero. */
  isHurt: boolean;
  /** Its own move is playing. */
  isActing: boolean;
  hp: number;
  maxHp: number;
};

// --- CONSTANTS ---
/** At or under this share of max HP a hero looks worried. */
const WORRIED_HP_SHARE = 0.35;

// --- FUNCTIONS ---
/** The mood a hero's face shows, strongest feeling first. */
export const moodOf = ({
  isHurt,
  isActing,
  hp,
  maxHp,
}: MoodInputs): HeroMood => {
  if (isHurt) return 'wince';
  if (isActing) return 'fierce';
  if (hp <= maxHp * WORRIED_HP_SHARE) return 'worried';
  return 'calm';
};
