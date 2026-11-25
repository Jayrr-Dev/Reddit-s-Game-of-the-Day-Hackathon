// --- SKILL POINTS ---
import type { CharacterState } from './character.ts';

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
    { x: -19, parents: [0] },
    { x: 19, parents: [1] },
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
export const skillPointsLeft = (c: CharacterState) =>
  c.level - (c.skillPicks?.length ?? 0);
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
  return skillPointsLeft(c) > 0 ? null : 'No skill points available';
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
  const owned = (c.skillPicks ?? []).filter(p => p.branch === pick.branch);
  const steps: SkillPick[] = [];
  function fill(tier: number, slot: number, target: number) {
    const rank = skillRank(owned, tier, slot);
    for (let i = rank; i < target; i++) steps.push({ branch: pick.branch, tier, slot });
  }
  if (pick.tier === tiers.length - 1) {
    if (owned.some(p => p.tier === pick.tier))
      return { steps: [], message: skillRequirement(c, pick) ?? 'Fully ranked' };
    fill(0, 0, 1);
    for (let tier = 1; tier < pick.tier; tier++) fill(tier, pick.slot, skillCap(tier));
  } else if (!skillRank(owned, pick.tier, pick.slot)) {
    const plan = planSkillPath(c, pick);
    return { steps: (plan.character.skillPicks ?? []).slice(c.skillPicks?.length ?? 0), message: plan.message };
  }
  steps.push(pick);
  if (steps.length > skillPointsLeft(c)) return { steps: [], message: 'Requires ' + steps.length + (steps.length === 1 ? ' point' : ' points') };
  let next = c;
  for (const step of steps) {
    const blocked = skillRequirement(next, step);
    if (blocked) return { steps: [], message: blocked };
    next = buySkill(next, step);
  }
  return { steps, message: 'Spend ' + steps.length + (steps.length === 1 ? ' point' : ' points') };
}