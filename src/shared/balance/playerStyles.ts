// ===================================================================
// PLAYER STYLES
// The five builds the player power estimate compares, as data: which
// cards each deck draws from, which damage traits it raises, and the
// skill tree circles it buys, in the order a player would buy them.
//
// Skill multipliers are BALLPARK guesses for how much each circle adds
// on average (a +25% bonus that only works on some targets counts for
// less). Tune them here.
// ===================================================================

import type { TraitId } from '../game/character.ts';
import type { CardType } from '../game/types.ts';

// --- TYPES ---
export type PlayStyleId = 'archer' | 'melee' | 'mage' | 'curses' | 'hybrid';

/** One skill tree circle bought to its full rank, and what it adds. */
export type SkillStep = {
  name: string;
  /** Skill points it costs (an entry circle 3, a 5-rank circle 5, a capstone 1). */
  points: number;
  /** Multiplies the deck's hit damage. */
  damage?: number;
  /** Multiplies the deck's affliction damage. */
  affliction?: number;
  /** Multiplies affliction stacks laid (Virulence). */
  stacks?: number;
};

export type PlayStyle = {
  id: PlayStyleId;
  label: string;
  /** Card types the deck is built from. */
  cardTypes: readonly CardType[];
  /** Damage traits it raises (the optimiser splits points between them). */
  damageTraits: readonly TraitId[];
  /** Skill circles in buying order (each already includes its path's entry). */
  skills: readonly SkillStep[];
};

// --- SHARED SKILL STEPS ---
const MOVEMENT_ENTRY: SkillStep = { name: 'Endurance (Movement entry)', points: 3, damage: 1.05 };
const AFFLICTION_ENTRY: SkillStep = { name: 'Grimoire (Afflictions entry)', points: 3 };
const MALEDICTION: SkillStep = { name: 'Malediction', points: 5, affliction: 1.25 };
const VIRULENCE: SkillStep = { name: 'Virulence', points: 5, stacks: 1.25 };
const UTILITY_ENTRY: SkillStep = { name: 'Apothecary (Utility entry)', points: 3 };
const POTENCY: SkillStep = { name: 'Potency', points: 5, damage: 1.03 };

// --- STYLES ---
export const PLAY_STYLES: readonly PlayStyle[] = [
  {
    id: 'archer',
    label: 'Archer',
    cardTypes: ['range'],
    damageTraits: ['dexterity'],
    skills: [
      { name: 'Quiver (Range entry)', points: 3 },
      { name: 'Sniper', points: 5, damage: 1.2 },
      { name: 'Steady Aim (crits)', points: 5, damage: 1.2 },
      { name: 'Volley', points: 1, damage: 1.15 },
      MOVEMENT_ENTRY,
      { name: 'Skirmisher', points: 5, damage: 1.15 },
      AFFLICTION_ENTRY,
      MALEDICTION,
      VIRULENCE,
      UTILITY_ENTRY,
      POTENCY,
    ],
  },
  {
    id: 'melee',
    label: 'Melee',
    cardTypes: ['melee'],
    damageTraits: ['strength'],
    skills: [
      { name: 'Armory (Melee entry)', points: 3 },
      { name: 'Keen Edge', points: 5, damage: 1.25 },
      { name: 'Flesh Wound', points: 5, damage: 1.12 },
      { name: 'Overwhelm (Cleave)', points: 1, damage: 1.25 },
      MOVEMENT_ENTRY,
      { name: 'Impact (Momentum)', points: 5, damage: 1.08 },
      { name: 'Battle Rush', points: 1, damage: 1.08 },
      AFFLICTION_ENTRY,
      MALEDICTION,
      VIRULENCE,
      UTILITY_ENTRY,
      POTENCY,
    ],
  },
  {
    id: 'mage',
    label: 'Mage',
    cardTypes: ['magic'],
    damageTraits: ['intelligence'],
    skills: [
      { name: 'Quiver (Magic entry)', points: 3 },
      { name: 'Battlemage', points: 5, damage: 1.2 },
      { name: 'Arcane Focus (crits)', points: 5, damage: 1.2 },
      { name: 'Spellpierce', points: 1, damage: 1.1 },
      AFFLICTION_ENTRY,
      MALEDICTION,
      VIRULENCE,
      MOVEMENT_ENTRY,
      UTILITY_ENTRY,
      POTENCY,
    ],
  },
  {
    id: 'curses',
    label: 'Curses',
    cardTypes: ['curse'],
    damageTraits: ['scorn'],
    skills: [
      AFFLICTION_ENTRY,
      MALEDICTION,
      { name: 'Sixfold Curse', points: 1, affliction: 1.25 },
      VIRULENCE,
      { name: 'Debilitate', points: 5, affliction: 1.05 },
      UTILITY_ENTRY,
      POTENCY,
    ],
  },
  {
    id: 'hybrid',
    label: 'Hybrid (Melee + Curses)',
    cardTypes: ['melee', 'curse'],
    damageTraits: ['strength', 'scorn'],
    skills: [
      { name: 'Armory (Melee entry)', points: 3 },
      { name: 'Keen Edge', points: 5, damage: 1.25 },
      AFFLICTION_ENTRY,
      MALEDICTION,
      { name: 'Flesh Wound', points: 5, damage: 1.12 },
      { name: 'Overwhelm (Cleave)', points: 1, damage: 1.25 },
      { name: 'Sixfold Curse', points: 1, affliction: 1.25 },
      VIRULENCE,
      MOVEMENT_ENTRY,
      { name: 'Impact (Momentum)', points: 5, damage: 1.08 },
      UTILITY_ENTRY,
      POTENCY,
    ],
  },
];
