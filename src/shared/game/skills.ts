// --- SKILL POINTS ---
import type { CharacterState } from './character.ts';
import { REFLEX_DODGE } from './rules.ts';
import type { CardType, Combatant, MeleeEdge } from './types.ts';

export const branchNames = [
  'Movement',
  'Melee',
  'Magic',
  'Utility and Buffs',
  'Afflictions',
] as const;
export type SkillPick = {
  branch: number;
  tier: number;
  slot: number;
};
export type Circle = { x: number; parents: number[] };
export const tiers: Circle[][] = [
  [{ x: 0, parents: [] }],
  [
    { x: -32, parents: [0] },
    { x: 32, parents: [0] },
  ],
  [
    { x: -32, parents: [0] },
    { x: 32, parents: [1] },
  ],
  [
    { x: -32, parents: [0] },
    { x: 32, parents: [1] },
  ],
];
/** Validate coordinates before accepting a purchase from a save or run log. */
export function isSkillPick(v: unknown): v is SkillPick {
  if (!v || typeof v !== 'object') return false;
  const index = (n: unknown, limit: number): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < limit;
  return (
    'branch' in v &&
    index(v.branch, branchNames.length) &&
    'tier' in v &&
    index(v.tier, tiers.length) &&
    'slot' in v &&
    index(v.slot, tiers[v.tier]!.length) &&
    !('option' in v)
  );
}
export const skillCap = (tier: number) => (tier % 3 === 0 ? 1 : 5);
/** ENTRY COST: a path's entry circle costs this many points; every other rank costs 1. */
export const ENTRY_SKILL_COST = 3;
/** Points one rank of a circle on `tier` costs. */
export const skillCost = (tier: number): number =>
  tier === 0 ? ENTRY_SKILL_COST : 1;
export const skillPointsLeft = (c: CharacterState) =>
  c.level -
  (c.skillPicks ?? []).reduce((spent, pick) => spent + skillCost(pick.tier), 0);

// --- SKILL EFFECTS ---
/** A circle that does something in combat: its name and rules text. */
export type SkillEffect = { name: string; description: string };
/** What each live circle does, keyed "branch-tier-slot". Others are blank for now. */
export const SKILL_EFFECTS: Readonly<Record<string, SkillEffect>> = {
  '0-0-0': {
    name: 'Endurance',
    description: 'Charge and Back Step cost 1 less energy',
  },
  '0-1-0': {
    name: 'Bull Rush',
    description: '+5% Momentum bonus per rank (up to +25%)',
  },
  '0-1-1': {
    name: 'Light Feet',
    description: '+5% Reflex dodge per rank (up to +25%)',
  },
  '0-2-0': {
    name: 'Shield Rush',
    description: 'Each Charge gives +1 Guard per rank (up to +5)',
  },
  '0-2-1': {
    name: 'Skirmisher',
    description: '+5% Range damage per rank at heroes on Line 2 (up to +25%)',
  },
  '1-0-0': {
    name: 'Armory',
    description: 'Melee cards are 30% more likely in card offers',
  },
  '2-0-0': {
    name: 'Quiver',
    description: 'Range cards are 30% more likely in card offers',
  },
  '3-0-0': {
    name: 'Apothecary',
    description: 'Utility and Buff cards are 30% more likely in card offers',
  },
  '3-1-0': {
    name: 'Empower',
    description:
      'Buffs (Wrath, Might, Surge, Hone, Reinforce) are 2% stronger per rank (up to +10%)',
  },
  '4-0-0': {
    name: 'Grimoire',
    description:
      'Cards that apply an affliction are 30% more likely in card offers',
  },
  '2-1-0': {
    name: 'Battlemage',
    description:
      'Magic cards deal +5% damage per rank to heroes on Line 1 (up to +25%)',
  },
  '2-1-1': {
    name: 'Sniper',
    description:
      'Range cards deal +5% damage per rank to heroes past Line 1 (up to +25%)',
  },
  '2-2-1': {
    name: 'Steady Aim',
    description: 'Range cards are +5% more accurate per rank (up to +25%)',
  },
  '2-2-0': {
    name: 'Arcane Focus',
    description: 'Magic cards are +5% more accurate per rank (up to +25%)',
  },
  '2-3-0': {
    name: 'Spellpierce',
    description:
      'After a Back Step, Magic cards ignore Guard, Armor and Protection for the rest of the turn',
  },
  '2-3-1': {
    name: 'Volley',
    description:
      'After a Back Step, Range cards hit 1 more time for the rest of the turn',
  },
  '3-3-0': {
    name: 'Everlasting',
    description: 'Stacked Buffs (Protection, Instinct) last 1 more turn',
  },
  '3-3-1': {
    name: 'Overflow',
    description:
      'Buffs you gain from cards get +1 stack. Utility cards have Hold',
  },
  '1-1-0': {
    name: 'Heavy Hands',
    description: 'Blunt Melee cards deal +5% damage per rank (up to +25%)',
  },
  '1-1-1': {
    name: 'Keen Edge',
    description: 'Sharp Melee cards deal +5% damage per rank (up to +25%)',
  },
  '1-2-0': {
    name: 'Guard Break',
    description:
      'Blunt Melee cards deal +5% damage per rank to heroes with Guard or Armor (up to +25%)',
  },
  '1-2-1': {
    name: 'Flesh Wound',
    description:
      'Sharp Melee cards deal +5% damage per rank to heroes with no Guard or Armor (up to +25%)',
  },
  '1-3-0': {
    name: 'Shockwave',
    description:
      'While you have Momentum, Melee strikes Cleave: they hit every hero in reach',
  },
  '1-3-1': {
    name: 'Lunge',
    description: 'Melee cards can target one line further (Line 2)',
  },
  '0-3-0': {
    name: 'Battle Rush',
    description: 'After a kill with Momentum, gain 1 energy',
  },
  '0-3-1': {
    name: 'Invincibility Frames',
    description:
      'Each Back Step adds 1 Invincible (stacks): each stack blocks one hit of damage',
  },
};
/** Ranks bought in one circle of any path (0 when not taken). */
const ranksIn = (
  picks: readonly SkillPick[] = [],
  branch: number,
  tier: number,
  slot: number
): number =>
  picks.filter((p) => p.branch === branch && p.tier === tier && p.slot === slot)
    .length;
/** True when the picks hold that circle (any rank). */
const hasSkill = (
  picks: readonly SkillPick[] = [],
  branch: number,
  tier: number,
  slot: number
): boolean =>
  picks.some((p) => p.branch === branch && p.tier === tier && p.slot === slot);
/** BULL RUSH: Momentum bonus added per rank (Charge line, first circle). */
export const BULL_RUSH_PER_RANK = 0.05;
/** Extra Momentum bonus from Bull Rush's ranks (0 to 0.25). */
export const momentumSkillBonusOf = (
  picks: readonly SkillPick[] = []
): number =>
  picks.filter((p) => p.branch === 0 && p.tier === 1 && p.slot === 0).length *
  BULL_RUSH_PER_RANK;
/** LIGHT FEET: Reflex dodge added per rank (Back Step line, first circle). */
export const LIGHT_FEET_PER_RANK = 0.05;
/** The dodge Reflex gives this unit: the base plus Light Feet's ranks. */
export const reflexDodgeOf = (unit: {
  skillPicks?: readonly SkillPick[];
}): number =>
  REFLEX_DODGE +
  (unit.skillPicks ?? []).filter(
    (p) => p.branch === 0 && p.tier === 1 && p.slot === 1
  ).length *
    LIGHT_FEET_PER_RANK;
/** Ranks bought in one circle (0 when not taken). */
const ranksOf = (
  picks: readonly SkillPick[] = [],
  tier: number,
  slot: number
): number =>
  picks.filter((p) => p.branch === 0 && p.tier === tier && p.slot === slot)
    .length;
/** SHIELD RUSH (Charge line, second circle): Guard gained per Charge. */
export const chargeGuardOf = (picks?: readonly SkillPick[]): number =>
  ranksOf(picks, 2, 0);
/** SKIRMISHER: Range damage added per rank at a hero on Line 2. */
export const SKIRMISHER_PER_RANK = 0.05;
/** Extra Range damage at Line 2 from Skirmisher (Back Step line, 0 to 0.2). */
export const lineTwoRangeBonusOf = (picks?: readonly SkillPick[]): number =>
  ranksOf(picks, 2, 1) * SKIRMISHER_PER_RANK;
/** HEAVY HANDS / KEEN EDGE: damage added per rank to one Melee edge. */
export const EDGE_DAMAGE_PER_RANK = 0.05;
/** Extra damage for a Blunt (top line) or Sharp (bottom line) Melee card. */
export const edgeDamageBonusOf = (
  picks: readonly SkillPick[] = [],
  edge: MeleeEdge
): number =>
  picks.filter(
    (p) =>
      p.branch === 1 && p.tier === 1 && p.slot === (edge === 'blunt' ? 0 : 1)
  ).length * EDGE_DAMAGE_PER_RANK;
/** GUARD BREAK (Blunt line): extra Blunt damage at a hero with Guard. */
export const guardBreakBonusOf = (picks: readonly SkillPick[] = []): number =>
  picks.filter((p) => p.branch === 1 && p.tier === 2 && p.slot === 0).length *
  EDGE_DAMAGE_PER_RANK;
/** FLESH WOUND (Sharp line): extra Sharp damage at an unprotected hero. */
export const fleshWoundBonusOf = (picks: readonly SkillPick[] = []): number =>
  picks.filter((p) => p.branch === 1 && p.tier === 2 && p.slot === 1).length *
  EDGE_DAMAGE_PER_RANK;
// --- CARD OFFER ODDS ---
/** ARMORY / QUIVER / GRIMOIRE: offer weight added by a path's entry (10% per point). */
export const ENTRY_CARD_CHANCE = 0.3;
/** Which path's entry circle raises which card type's offer odds. */
const CARD_CHANCE_ENTRIES: Partial<Record<CardType, number>> = {
  melee: 1,
  range: 2,
  utility: 3,
  buff: 3,
};
/** GRIMOIRE (Afflictions entry): cards that lay an affliction, +30%. */
export const afflictionChanceBonusOf = (
  picks?: readonly SkillPick[]
): number => (hasSkill(picks, 4, 0, 0) ? ENTRY_CARD_CHANCE : 0);
/** How much more often a card of `type` is offered (0.3 = +30%). */
export const cardChanceBonusOf = (
  picks: readonly SkillPick[] = [],
  type: CardType
): number => {
  const branch = CARD_CHANCE_ENTRIES[type];
  return branch !== undefined && hasSkill(picks, branch, 0, 0)
    ? ENTRY_CARD_CHANCE
    : 0;
};
/** BATTLEMAGE (Magic line): extra Magic damage at Line 1, +5% per rank. */
export const battlemageBonusOf = (picks?: readonly SkillPick[]): number =>
  ranksIn(picks, 2, 1, 0) * EDGE_DAMAGE_PER_RANK;
/** SNIPER (Arrows line): extra Range damage past Line 1, +5% per rank. */
export const sniperBonusOf = (picks?: readonly SkillPick[]): number =>
  ranksIn(picks, 2, 1, 1) * EDGE_DAMAGE_PER_RANK;
/** STEADY AIM (Arrows line): extra Range accuracy, +5% per rank. */
export const rangeAccuracyBonusOf = (picks?: readonly SkillPick[]): number =>
  ranksIn(picks, 2, 2, 1) * EDGE_DAMAGE_PER_RANK;
/** ARCANE FOCUS (Magic line): extra Magic accuracy, +5% per rank. */
export const magicAccuracyBonusOf = (picks?: readonly SkillPick[]): number =>
  ranksIn(picks, 2, 2, 0) * EDGE_DAMAGE_PER_RANK;
/** SPELLPIERCE (Magic capstone): Magic hits ignore Guard and Armor. */
export const magicPiercesOf = (picks?: readonly SkillPick[]): boolean =>
  hasSkill(picks, 2, 3, 0);
/**
 * True once the villain has Back Stepped this turn: Reflex comes only
 * from a Back Step and clears when the villain's next turn starts.
 */
const hasBackStepped = (unit: Combatant): boolean => unit.statuses.reflex > 0;
/** SPELLPIERCE: true while it applies (Magic, after a Back Step). */
export const isSpellpierceOn = (unit: Combatant, type: CardType): boolean =>
  type === 'magic' && hasBackStepped(unit) && magicPiercesOf(unit.skillPicks);
/** VOLLEY (Arrows capstone): after a Back Step, every Range card hits once more. */
export const volleyHitsOf = (
  hits: number,
  type: CardType,
  unit?: Combatant
): number =>
  unit &&
  type === 'range' &&
  hasBackStepped(unit) &&
  hasSkill(unit.skillPicks, 2, 3, 1)
    ? hits + 1
    : hits;
/** EVERLASTING (Utility and Buffs capstone): extra turns for Stacked Buffs. */
export const stackedBuffTurnsOf = (picks?: readonly SkillPick[]): number =>
  hasSkill(picks, 3, 3, 0) ? 1 : 0;
/** OVERFLOW (Utility capstone): extra stacks on each buff a card gives. */
export const buffStackBonusOf = (picks?: readonly SkillPick[]): number =>
  hasSkill(picks, 3, 3, 1) ? 1 : 0;
/** OVERFLOW also gives every Utility card Hold (stays in hand at end of turn). */
export const utilityHoldsOf = (picks?: readonly SkillPick[]): boolean =>
  hasSkill(picks, 3, 3, 1);
/** EMPOWER: buff strength added per rank (Utility and Buffs, top line). */
export const EMPOWER_PER_RANK = 0.02;
/** How much stronger buffs' flat bonuses are (0 to 0.1). */
export const buffPowerBonusOf = (picks?: readonly SkillPick[]): number =>
  ranksIn(picks, 3, 1, 0) * EMPOWER_PER_RANK;
/** SHOCKWAVE (Blunt capstone): Momentum turns Melee strikes into Cleaves. */
export const hasMomentumCleave = (picks?: readonly SkillPick[]): boolean =>
  hasSkill(picks, 1, 3, 0);
/** LUNGE (Sharp capstone): extra rows Melee reaches past Line 1. */
export const meleeReachOf = (picks?: readonly SkillPick[]): number =>
  hasSkill(picks, 1, 3, 1) ? 1 : 0;
/** BATTLE RUSH (Charge capstone): energy gained when a play kills. */
export const rageEnergyOf = (picks?: readonly SkillPick[]): number =>
  hasSkill(picks, 0, 3, 0) ? 1 : 0;
/** INVINCIBILITY FRAMES (Back Step capstone): Invincible stacks per Back Step. */
export const iFramesOf = (picks?: readonly SkillPick[]): number =>
  hasSkill(picks, 0, 3, 1) ? 1 : 0;
/** The effect of a circle, if it has one. */
export const skillEffectOf = (pick: SkillPick): SkillEffect | undefined =>
  SKILL_EFFECTS[`${pick.branch}-${pick.tier}-${pick.slot}`];
/** ENDURANCE: energy taken off Charge and Back Step (0 or 1). */
export const movementDiscountOf = (picks: readonly SkillPick[] = []): number =>
  picks.some((p) => p.branch === 0 && p.tier === 0 && p.slot === 0) ? 1 : 0;
export const skillRank = (picks: SkillPick[], tier: number, slot: number) =>
  picks.filter((p) => p.tier === tier && p.slot === slot).length;

/** Required investment in this branch before buying a milestone. */
function requiredInvestment(tier: number) {
  return tier === 3 ? 10 : 0;
}

export function skillRequirement(
  c: CharacterState,
  pick: SkillPick
): string | null {
  if (!isSkillPick(pick)) return 'Unknown circle';
  const { branch, tier, slot } = pick;
  const picks = (c.skillPicks ?? []).filter((p) => p.branch === branch);
  if (skillRank(picks, tier, slot) >= skillCap(tier)) return 'Fully ranked';
  const required = requiredInvestment(tier);
  if (picks.length < required)
    return 'Requires ' + required + ' points in this path';
  if (
    tier &&
    !tiers[tier]![slot]!.parents.some((parent) =>
      skillRank(picks, tier - 1, parent)
    )
  )
    return 'Requires one rank in a connected circle below';
  return skillPointsLeft(c) >= skillCost(tier)
    ? null
    : 'Needs ' + skillCost(tier) + ' skill points';
}
/** Append valid purchases in order for deterministic replay. */
export function buySkill(c: CharacterState, pick: SkillPick): CharacterState {
  return skillRequirement(c, pick)
    ? c
    : { ...c, skillPicks: [...(c.skillPicks ?? []), pick] };
}

/** Toggle a circle atomically, keeping dependent purchases valid after a refund. */
export function planSkillPath(
  c: CharacterState,
  pick: SkillPick
): { character: CharacterState; message: string } {
  if (!isSkillPick(pick)) return { character: c, message: 'Unknown circle' };
  const picks = c.skillPicks ?? [];
  const local = picks.filter((p) => p.branch === pick.branch);
  if (skillRank(local, pick.tier, pick.slot)) {
    let next: CharacterState = {
      ...c,
      skillPicks: picks.filter((p) => p.branch !== pick.branch),
    };
    let waiting = local.filter(
      (p) => p.tier !== pick.tier || p.slot !== pick.slot
    );
    // Retry deferred nodes so an alternative parent bought later can keep its descendants.
    while (waiting.length) {
      const deferred: SkillPick[] = [];
      for (const p of waiting) {
        const result = buySkill(next, p);
        if (result === next) deferred.push(p);
        else next = result;
      }
      if (waiting.length === deferred.length) break;
      waiting = deferred;
    }
    const count = picks.length - (next.skillPicks?.length ?? 0);
    return {
      character: next,
      message: 'Refund ' + count + (count === 1 ? ' point' : ' points'),
    };
  }
  /** Enumerate connected routes from existing ranks to the requested circle. */
  function routes(p: SkillPick): SkillPick[][] {
    if (skillRank(local, p.tier, p.slot)) return [[]];
    if (!p.tier) return [[p]];
    return tiers[p.tier]![p.slot]!.parents.flatMap((slot) =>
      routes({ branch: p.branch, tier: p.tier - 1, slot }).map((route) => [
        ...route,
        p,
      ])
    );
  }
  let best: CharacterState | undefined;
  let fewest = Infinity;
  let reason = '';
  for (const route of routes(pick)) {
    let next = c;
    for (const step of route) {
      let invested = (next.skillPicks ?? []).filter(
        (p) => p.branch === pick.branch
      );
      const gate = requiredInvestment(step.tier);
      while (invested.length < gate && skillPointsLeft(next) > 0) {
        // Rank owned circles first. Open another connected circle only when necessary.
        const candidates = tiers
          .slice(0, step.tier)
          .flatMap((row, tier) =>
            skillCap(tier) === 1
              ? []
              : row.map((_, slot) => ({ branch: pick.branch, tier, slot }))
          );
        const open = candidates.filter((p) => !skillRequirement(next, p));
        const candidate =
          open.find((p) => skillRank(invested, p.tier, p.slot)) ?? open[0];
        if (!candidate) break;
        next = buySkill(next, candidate);
        invested = [...invested, candidate];
      }
      const blocked = skillRequirement(next, step);
      if (blocked) {
        reason ||= blocked;
        next = c;
        break;
      }
      next = buySkill(next, step);
    }
    if (next === c) continue;
    const added = next.skillPicks!.slice(picks.length);
    const circles = new Set(
      added
        .filter((p) => !skillRank(local, p.tier, p.slot))
        .map((p) => p.tier + '-' + p.slot)
    ).size;
    if (
      circles < fewest ||
      (circles === fewest &&
        added.length < best!.skillPicks!.length - picks.length)
    ) {
      best = next;
      fewest = circles;
    }
  }
  if (!best) return { character: c, message: reason };
  const count = best.skillPicks!.length - picks.length;
  return {
    character: best,
    message: 'Spend ' + count + (count === 1 ? ' point' : ' points'),
  };
}

/** Resolve a node click into individual purchases that can be replayed in order. */
export function skillPurchases(c: CharacterState, pick: SkillPick) {
  const owned = (c.skillPicks ?? []).filter((p) => p.branch === pick.branch);
  const steps: SkillPick[] = [];
  function fill(tier: number, slot: number, target: number) {
    const rank = skillRank(owned, tier, slot);
    for (let i = rank; i < target; i++)
      steps.push({ branch: pick.branch, tier, slot });
  }
  if (pick.tier === tiers.length - 1) {
    if (owned.some((p) => p.tier === pick.tier))
      return {
        steps: [],
        message: skillRequirement(c, pick) ?? 'Fully ranked',
      };
    fill(0, 0, 1);
    for (let tier = 1; tier < pick.tier; tier++)
      fill(tier, pick.slot, skillCap(tier));
  } else if (!skillRank(owned, pick.tier, pick.slot)) {
    const plan = planSkillPath(c, pick);
    return {
      steps: (plan.character.skillPicks ?? []).slice(c.skillPicks?.length ?? 0),
      message: plan.message,
    };
  }
  steps.push(pick);
  if (steps.length > skillPointsLeft(c))
    return {
      steps: [],
      message:
        'Requires ' +
        steps.length +
        (steps.length === 1 ? ' point' : ' points'),
    };
  let next = c;
  for (const step of steps) {
    const blocked = skillRequirement(next, step);
    if (blocked) return { steps: [], message: blocked };
    next = buySkill(next, step);
  }
  return {
    steps,
    message:
      'Spend ' + steps.length + (steps.length === 1 ? ' point' : ' points'),
  };
}
