// --- SKILL POINTS ---
import type { CharacterState } from './character.ts';
import { REFLEX_DODGE } from './rules.ts';
import type { CardType } from './types.ts';

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
    name: 'Brawler',
    description: '+10% chance per rank to be offered Melee cards (up to +50%)',
  },
  '0-2-1': {
    name: 'Marksman',
    description: '+10% chance per rank to be offered Range cards (up to +50%)',
  },
  '0-3-0': { name: 'Rage', description: 'After a kill, gain 1 energy' },
  '0-3-1': {
    name: 'Invincibility Frames',
    description:
      'Each Back Step gives Invincible 1: the next damage you take is 0',
  },
};
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
// --- CARD OFFER ODDS ---
/** BRAWLER / MARKSMAN: offer weight added per rank to a card type. */
export const CARD_CHANCE_PER_RANK = 0.1;
/** Which second-tier circle raises which card type's offer odds. */
const CARD_CHANCE_CIRCLES: readonly { slot: number; type: CardType }[] = [
  { slot: 0, type: 'melee' },
  { slot: 1, type: 'range' },
];
/**
 * How much more often a card of `type` is offered (0.1 = +10%): the
 * ranks of its circle on the Movement branch's second tier.
 */
export const cardChanceBonusOf = (
  picks: readonly SkillPick[] = [],
  type: CardType
): number => {
  const circle = CARD_CHANCE_CIRCLES.find((c) => c.type === type);
  if (!circle) return 0;
  const ranks = picks.filter(
    (p) => p.branch === 0 && p.tier === 2 && p.slot === circle.slot
  ).length;
  return ranks * CARD_CHANCE_PER_RANK;
};
/** RAGE (Charge capstone): energy gained when a play kills. */
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
  if (tier === 3 && picks.some((p) => p.tier === tier))
    return 'Other specialization chosen';
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
